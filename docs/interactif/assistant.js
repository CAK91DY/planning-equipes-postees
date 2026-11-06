/* Assistant de planification — compréhension de demandes écrites en français.

   L'analyse se fait par règles, dans le navigateur : aucune donnée ne sort du poste et aucune clé
   d'API ne figure dans la page. Le même rôle peut être confié à Claude via un serveur
   (src/planning/assistant.py). Dans tous les cas, l'assistant PROPOSE ; le manager valide.

   interpreter(texte, donnees) renvoie une intention :
     { type: "absence", id, absenceType, debut, fin }
     { type: "disponibles", jour, quart, poste }
     { type: "solde", id }
     { type: "planning_personne", id }
     { type: "generer" }
     { type: "ajout_collaborateur" }
     { type: "aide", raison } */
(function (global) {
  "use strict";

  const MOIS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8,
                 septembre: 9, octobre: 10, novembre: 11, decembre: 12 };

  const normaliser = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ");

  function ajouterJours(iso, n) {
    const [a, m, j] = iso.split("-").map(Number);
    const d = new Date(Date.UTC(a, m - 1, j + n));
    return d.toISOString().slice(0, 10);
  }
  function joursHorizon(donnees) {
    const liste = [];
    for (let i = 0; i < donnees.horizon.nb_jours; i++) liste.push(ajouterJours(donnees.horizon.debut, i));
    return liste;
  }

  // « 15 », « 15/12 », « 15 décembre » -> date ISO dans l'horizon (null si absente)
  function versDate(jourTxt, moisTxt, donnees) {
    const jour = Number(jourTxt);
    let mois = null;
    if (moisTxt) mois = /^\d+$/.test(moisTxt) ? Number(moisTxt) : MOIS[moisTxt] || null;
    const candidats = joursHorizon(donnees).filter((iso) => Number(iso.slice(8)) === jour &&
      (mois === null || Number(iso.slice(5, 7)) === mois));
    return candidats[0] || null;
  }

  const MOT_MOIS = "(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)";
  const DATE = `(\\d{1,2})(?:\\s*(?:\\/|\\.)\\s*(\\d{1,2})(?:\\s*(?:\\/|\\.)\\s*\\d{2,4})?|\\s+${MOT_MOIS})?`;

  function extraireDates(t, donnees) {
    const plage = new RegExp(`(?:du|de|entre le|entre)\\s+(?:lundi |mardi |mercredi |jeudi |vendredi |samedi )?${DATE}\\s+(?:au|a|et|jusqu au)\\s+(?:le )?(?:lundi |mardi |mercredi |jeudi |vendredi |samedi )?${DATE}`);
    let m = t.match(plage);
    if (m) {
      // si le premier jour n'a pas de mois, il prend celui du second (« du 15 au 17 décembre »)
      const fin = versDate(m[4], m[5] || m[6], donnees);
      let debut = versDate(m[1], m[2] || m[3] || (m[5] || m[6]), donnees);
      if (!debut) debut = versDate(m[1], null, donnees);
      return debut && fin ? { debut, fin: fin < debut ? debut : fin } : null;
    }
    m = t.match(new RegExp(`(?:le|pour le|ce|samedi|lundi|mardi|mercredi|jeudi|vendredi)\\s+(?:lundi |mardi |mercredi |jeudi |vendredi |samedi )?${DATE}`)) ||
        t.match(new RegExp(`\\b${DATE}`));
    if (m) {
      const d = versDate(m[1], m[2] || m[3], donnees);
      return d ? { debut: d, fin: d } : null;
    }
    return null;
  }

  function extrairePersonne(t, donnees) {
    for (const c of donnees.collaborateurs) {
      const prenom = normaliser(c.nom.split(" ")[0]);
      const numero = Number(c.id.slice(1));                                 // « E009 », « e9 », « opérateur 9 »
      if (new RegExp(`\\b${prenom}\\b`).test(t) || new RegExp(`\\b${c.id.toLowerCase()}\\b`).test(t) ||
          new RegExp(`\\b(e|matricule |operateur )0*${numero}\\b`).test(t)) return c.id;
    }
    return null;
  }
  function extrairePoste(t) {
    if (/\bchef\b/.test(t)) return "CHEF_QUART";
    if (/\b(tableau|panneau|salle de controle|console)\b/.test(t)) return "OP_TABLEAU";
    if (/\b(exterieur|terrain|ronde|rondier)\b/.test(t)) return "OP_EXTERIEUR";
    return null;
  }
  function extraireQuart(t) {
    if (/\bnuit\b/.test(t)) return "N";
    if (/\bapres[ -]?midi\b/.test(t)) return "A";
    if (/\bmatin\b/.test(t)) return "M";
    return null;
  }

  function extraireType(t) {
    if (/\brtt\b/.test(t)) return "RTT";
    if (/\b(conges?|cp|vacances?)\b/.test(t)) return "CP";
    if (/\bformation\b/.test(t)) return "FORMATION";
    if (/\b(malade|maladie|arret|imprevu|absente?|absence|indisponible|empeche|ne (peut|pourra) pas venir)\b/.test(t)) return "ARRET";
    return null;
  }

  function interpreter(texte, donnees) {
    const t = normaliser(texte || "").trim();
    if (!t) return { type: "aide", raison: "vide" };
    const id = extrairePersonne(t, donnees);
    const dates = extraireDates(t, donnees);

    if (!id && /\b(nouveau|nouvelle|ajoute|ajouter|ajout|embauche|embaucher|recrue|recrutement|arrivee|integrer)\b/.test(t) &&
        /\b(collaborateur|collaboratrice|operateur|operatrice|chef|personne|salarie|salariee|equipier|equipiere|volant|recrue)\b/.test(t)) {
      return { type: "ajout_collaborateur" };
    }
    if (/\b(genere|generer|cree|creer|refais|refaire|recalcule|recalculer|construis|construire)\b.*\bplanning\b/.test(t)) {
      return { type: "generer" };
    }
    if (/\b(qui|quelqu un)\b.*\b(dispo|disponibles?|libres?|remplacer|peut venir|peut prendre)\b/.test(t)) {
      return dates ? { type: "disponibles", jour: dates.debut, quart: extraireQuart(t), poste: extrairePoste(t) }
        : { type: "aide", raison: "date" };
    }
    if (id && /\b(solde|soldes|reste|restant|restants|combien|compteur|compteurs)\b/.test(t)) {
      return { type: "solde", id };
    }
    const absenceType = extraireType(t);
    if (absenceType) {
      if (!id) return { type: "aide", raison: "personne" };
      if (!dates) return { type: "aide", raison: "date" };
      return { type: "absence", id, absenceType, debut: dates.debut, fin: dates.fin };
    }
    if (id && /\b(planning|quand|travaille|horaires?|semaine)\b/.test(t)) return { type: "planning_personne", id };
    return { type: "aide", raison: id ? "intention" : "inconnu" };
  }

  const api = { interpreter, normaliser };
  if (typeof module !== "undefined") module.exports = api;
  global.AssistantPlanning = api;
})(typeof window !== "undefined" ? window : globalThis);
