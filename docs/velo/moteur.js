/* Moteur de planning simplifié, exécuté dans le navigateur (JavaScript, sans dépendance).

   Il sert à la démonstration interactive : le manager déclare une absence et voit en
   quelques millisecondes une proposition qui modifie le moins possible le planning publié.
   Le moteur de référence du dépôt reste le modèle OR-Tools en Python (src/planning/).

   Méthode (heuristique gloutonne, transparente) :
   - Génération : pour chaque semaine, on couvre d'abord l'effectif MINIMUM de chaque créneau
     (rôles les plus rares d'abord), puis on complète les jours du contrat de chacun en renfort.
   - Replanification : on retire les affectations des personnes absentes, puis pour chaque poste
     minimum devenu vide on essaie dans l'ordre : déplacer un renfort déjà présent ce jour-là
     (aucune heure en plus), sinon ajouter un jour à la personne la mieux placée (heure sup),
     sinon signaler le poste non couvert.
   - Contrôle : une fonction indépendante revérifie toutes les règles sur le résultat. */
(function (global) {
  "use strict";

  const CRENEAUX = ["O", "F"];

  // ------------------------------------------------------------------ dates (en UTC, sans fuseau)
  function versDate(iso) {
    const [a, m, j] = iso.split("-").map(Number);
    return new Date(Date.UTC(a, m - 1, j));
  }
  function ajouterJours(iso, n) {
    const d = versDate(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const jourSemaine = (iso) => versDate(iso).getUTCDay();          // 0 = dimanche
  const cle = (id, jour) => `${id}|${jour}`;

  // ------------------------------------------------------------------ contexte de calcul
  function preparer(donnees, absences) {
    const jours = [];
    for (let i = 0; i < donnees.horizon.nb_jours; i++) jours.push(ajouterJours(donnees.horizon.debut, i));
    const index = Object.fromEntries(jours.map((j, i) => [j, i]));
    const ouvert = (j) => !donnees.jours_fermes_semaine.includes(jourSemaine(j)) && !donnees.feries.includes(j);
    const semaine = (j) => Math.floor(index[j] / 7);
    const nbSemaines = Math.ceil(jours.length / 7);

    const joursAbsence = new Set();
    // Jours d'absence qui réduisent l'objectif de la semaine : les jours où la personne était
    // planifiée (s'ils sont connus : absence survenue après publication), sinon les jours ouverts.
    const reduction = {};
    for (const a of absences) {
      for (let j = a.debut; j <= a.fin; j = ajouterJours(j, 1)) {
        joursAbsence.add(cle(a.id, j));
        if (!(j in index)) continue;
        const compte = a.jours_retires ? a.jours_retires.includes(j) : ouvert(j);
        if (compte) reduction[`${a.id}|${semaine(j)}`] = (reduction[`${a.id}|${semaine(j)}`] || 0) + 1;
      }
    }
    const demandes = new Set(donnees.demandes_repos.map((d) => cle(d.id, d.jour)));

    // Jours fériés tombant un jour habituellement ouvert : ils réduisent l'objectif de la semaine
    const feriesOuvres = (s) => donnees.feries.filter((f) => f in index && semaine(f) === s &&
      !donnees.jours_fermes_semaine.includes(jourSemaine(f))).length;

    const collab = Object.fromEntries(donnees.collaborateurs.map((c) => [c.id, c]));
    return {
      donnees, jours, ouvert, semaine, nbSemaines, collab,
      joursOuverts: jours.filter(ouvert),
      besoin: (j) => (ouvert(j) ? (jourSemaine(j) === 6 ? donnees.besoins.samedi : donnees.besoins.semaine) : null),
      absent: (id, j) => joursAbsence.has(cle(id, j)),
      demande: (id, j) => demandes.has(cle(id, j)),
      // Objectif de la semaine = jours du contrat - fériés chômés - jours d'absence (congés, RTT… sont payés)
      objectif: (id, s) => Math.max(0, collab[id].jours_contrat - feriesOuvres(s) - (reduction[`${id}|${s}`] || 0)),
      nbHabilites: (r) => donnees.collaborateurs.filter((c) => c.habilitations.includes(r)).length,
    };
  }

  // ------------------------------------------------------------------ comptages sur un planning
  function joursTravailles(ctx, plan, id, s) {
    return ctx.jours.filter((j) => ctx.semaine(j) === s && plan.has(cle(id, j))).length;
  }
  function consecutifsSi(ctx, plan, id, jour) {
    // longueur de la série de jours travaillés si l'on ajoute `jour`
    let n = 1;
    for (let j = ajouterJours(jour, -1); plan.has(cle(id, j)); j = ajouterJours(j, -1)) n++;
    for (let j = ajouterJours(jour, 1); plan.has(cle(id, j)); j = ajouterJours(j, 1)) n++;
    return n;
  }
  function effectif(plan, ctx, jour, c, r) {
    let n = 0;
    for (const p of ctx.donnees.collaborateurs) {
      const a = plan.get(cle(p.id, jour));
      if (a && a.c === c && a.r === r) n++;
    }
    return n;
  }
  function nbCreneau(plan, id, c) {
    let n = 0;
    for (const [k, a] of plan) if (k.startsWith(id + "|") && a.c === c) n++;
    return n;
  }

  // ------------------------------------------------------------------ choix du meilleur candidat
  function meilleurCandidat(ctx, plan, jour, unite, exclu = null) {
    const R = ctx.donnees.regles;
    const s = ctx.semaine(jour);
    const restantsSemaine = ctx.joursOuverts.filter((j) => ctx.semaine(j) === s && j >= jour);
    let meilleur = null;
    for (const p of ctx.donnees.collaborateurs) {
      if (p.id === exclu || !p.habilitations.includes(unite.r)) continue;  // habilitation
      if (ctx.absent(p.id, jour) || plan.has(cle(p.id, jour))) continue;  // absent ou déjà affecté
      const n = joursTravailles(ctx, plan, p.id, s);
      if (n >= R.max_jours_semaine) continue;                            // 6 jours / semaine
      if (consecutifsSi(ctx, plan, p.id, jour) > R.max_jours_consecutifs) continue;
      const obj = ctx.objectif(p.id, s);
      let cout = 0;
      if (n >= obj) cout += 100;                                         // jour en heures supplémentaires
      if (ctx.demande(p.id, jour)) cout += 40;                           // demande de repos
      if (p.habilitations[0] !== unite.r) cout += 8;                     // poste secondaire
      cout += 0.5 * nbCreneau(plan, p.id, unite.c);                      // équilibre ouverture / fermeture
      const aPlacer = obj - n;                                           // urgence : jours de contrat restants
      const possibles = restantsSemaine.filter((j) => !ctx.absent(p.id, j) && !plan.has(cle(p.id, j))).length;
      if (aPlacer > 0) cout -= 5 * aPlacer / Math.max(1, possibles);
      if (!meilleur || cout < meilleur.cout) meilleur = { id: p.id, cout, heureSup: n >= obj };
    }
    return meilleur;
  }

  function unitesMinimum(ctx, jour) {
    const b = ctx.besoin(jour);
    const unites = [];
    for (const c of CRENEAUX) for (const r of Object.keys(b[c])) for (let k = 0; k < b[c][r]; k++) unites.push({ c, r });
    return unites.sort((u, v) => ctx.nbHabilites(u.r) - ctx.nbHabilites(v.r));
  }

  // ------------------------------------------------------------------ génération du planning
  function generer(donnees) {
    const t0 = maintenant();
    const ctx = preparer(donnees, donnees.absences);
    const plan = new Map();
    for (let s = 0; s < ctx.nbSemaines; s++) {
      const joursS = ctx.joursOuverts.filter((j) => ctx.semaine(j) === s);
      // 1. effectif minimum, jour par jour
      for (const jour of joursS) {
        for (const u of unitesMinimum(ctx, jour)) combler(ctx, plan, jour, u.c, u.r);
      }
      // 2. compléter les jours du contrat de chacun (renforts), là où l'équipe est la plus réduite
      for (const p of donnees.collaborateurs) {
        while (joursTravailles(ctx, plan, p.id, s) < ctx.objectif(p.id, s)) {
          const libres = joursS.filter((j) => !plan.has(cle(p.id, j)) && !ctx.absent(p.id, j) &&
            !ctx.demande(p.id, j) && consecutifsSi(ctx, plan, p.id, j) <= donnees.regles.max_jours_consecutifs);
          if (!libres.length) break;
          const presents = (j) => donnees.collaborateurs.filter((q) => plan.has(cle(q.id, j))).length;
          libres.sort((a, b) => presents(a) - presents(b) || (a < b ? -1 : 1));
          const jour = libres[0];
          const r = p.habilitations[0];
          const c = effectif(plan, ctx, jour, "O", r) <= effectif(plan, ctx, jour, "F", r) ? "O" : "F";
          plan.set(cle(p.id, jour), { c, r });
        }
      }
    }
    return { plan, duree_ms: maintenant() - t0 };
  }

  // ------------------------------------------------------------------ replanification
  function replanifier(donnees, publie, absences) {
    const t0 = maintenant();
    const ctx = preparer(donnees, absences);
    const plan = new Map(publie);
    // 1. retirer les affectations tombant pendant une absence
    for (const k of [...plan.keys()]) {
      const [id, jour] = k.split("|");
      if (ctx.absent(id, jour)) plan.delete(k);
    }
    // 2. combler les postes minimum devenus vides
    const trous = [];
    for (const jour of ctx.joursOuverts) {
      const b = ctx.besoin(jour);
      for (const c of CRENEAUX) {
        for (const r of Object.keys(b[c])) {
          while (effectif(plan, ctx, jour, c, r) < b[c][r]) {
            if (combler(ctx, plan, jour, c, r)) continue;
            trous.push({ jour, c, r, manquants: b[c][r] - effectif(plan, ctx, jour, c, r) });
            break;                                                      // poste signalé, jamais caché
          }
        }
      }
    }
    return { plan, trous, duree_ms: maintenant() - t0 };
  }

  /* Couvre UN poste manquant (créneau c, rôle r) le jour donné, au moindre coût :
     a) déplacer un renfort déjà présent ce jour-là (aucune heure en plus) ;
     b) affecter la personne la mieux placée (éventuellement en heures supplémentaires) ;
     c) échange en chaîne : une personne présente et habilitée prend ce poste,
        et quelqu'un d'autre reprend le sien (utile pour les profils polyvalents).
     Renvoie true si le poste est couvert. */
  function combler(ctx, plan, jour, c, r) {
    if (deplacerRenfort(ctx, plan, jour, c, r)) return true;
    const direct = meilleurCandidat(ctx, plan, jour, { c, r });
    let chaine = null;
    for (const p of ctx.donnees.collaborateurs) {
      const a = plan.get(cle(p.id, jour));
      if (!a || !p.habilitations.includes(r) || (a.c === c && a.r === r)) continue;
      plan.delete(cle(p.id, jour));                                    // essai : p libère son poste
      const remplacant = meilleurCandidat(ctx, plan, jour, a, p.id);
      plan.set(cle(p.id, jour), a);                                    // on remet l'état
      if (remplacant && (!chaine || remplacant.cout + 2 < chaine.cout)) {
        chaine = { cout: remplacant.cout + 2, x: p.id, ancien: a, y: remplacant.id };
      }
    }
    if (direct && (!chaine || direct.cout <= chaine.cout)) {
      plan.set(cle(direct.id, jour), { c, r });
      return true;
    }
    if (chaine) {
      plan.set(cle(chaine.x, jour), { c, r });
      plan.set(cle(chaine.y, jour), chaine.ancien);
      return true;
    }
    return false;
  }

  function deplacerRenfort(ctx, plan, jour, c, r) {
    const b = ctx.besoin(jour);
    const candidats = [];
    for (const p of ctx.donnees.collaborateurs) {
      const a = plan.get(cle(p.id, jour));
      if (!a || !p.habilitations.includes(r)) continue;
      if (effectif(plan, ctx, jour, a.c, a.r) <= b[a.c][a.r]) continue;   // il ferait un trou ailleurs
      // préférence : même créneau (simple changement de poste), puis poste principal
      candidats.push({ id: p.id, cout: (a.c === c ? 0 : 2) + (p.habilitations[0] === r ? 0 : 1) });
    }
    if (!candidats.length) return false;
    candidats.sort((x, y) => x.cout - y.cout || (x.id < y.id ? -1 : 1));
    plan.set(cle(candidats[0].id, jour), { c, r });
    return true;
  }

  // ------------------------------------------------------------------ contrôle indépendant
  function controler(donnees, plan, absences) {
    const ctx = preparer(donnees, absences);
    const R = donnees.regles;
    const anomalies = [];
    const ano = (regle, detail, id = "", jour = "") => anomalies.push({ regle, detail, id, jour });

    for (const [k, a] of plan) {
      const [id, jour] = k.split("|");
      const p = ctx.collab[id];
      if (!p) { ano("COLLABORATEUR", "matricule inconnu", id, jour); continue; }
      if (!ctx.ouvert(jour)) ano("MAGASIN_FERME", "affecté un jour de fermeture", id, jour);
      if (!p.habilitations.includes(a.r)) ano("HABILITATION", `non habilité au poste ${a.r}`, id, jour);
      if (ctx.absent(id, jour)) ano("ABSENCE", "affecté pendant une absence", id, jour);
      if (!CRENEAUX.includes(a.c)) ano("CRENEAU", `créneau inconnu ${a.c}`, id, jour);
    }
    for (const p of donnees.collaborateurs) {
      for (let s = 0; s < ctx.nbSemaines; s++) {
        const n = joursTravailles(ctx, plan, p.id, s);
        if (n > R.max_jours_semaine) ano("JOURS_SEMAINE", `${n} jours dans la semaine ${s + 1}`, p.id);
      }
      let serie = 0;
      for (const j of ctx.jours) {
        serie = plan.has(cle(p.id, j)) ? serie + 1 : 0;
        if (serie > R.max_jours_consecutifs) ano("JOURS_CONSECUTIFS", `${serie} jours de suite`, p.id, j);
      }
    }
    for (const jour of ctx.joursOuverts) {
      const b = ctx.besoin(jour);
      for (const c of CRENEAUX) for (const r of Object.keys(b[c])) {
        const n = effectif(plan, ctx, jour, c, r);
        if (n < b[c][r]) ano("COUVERTURE", `${c} / ${r} : ${n} sur ${b[c][r]} requis`, "", jour);
      }
    }
    return anomalies;
  }

  // ------------------------------------------------------------------ indicateurs et différences
  function indicateurs(donnees, plan, absences) {
    const ctx = preparer(donnees, absences);
    let requis = 0, couverts = 0, joursSup = 0;
    for (const jour of ctx.joursOuverts) {
      const b = ctx.besoin(jour);
      for (const c of CRENEAUX) for (const r of Object.keys(b[c])) {
        requis += b[c][r];
        couverts += Math.min(b[c][r], effectif(plan, ctx, jour, c, r));
      }
    }
    const parPersonne = {};
    for (const p of donnees.collaborateurs) {
      let jours = 0, contrat = 0, sup = 0;
      for (let s = 0; s < ctx.nbSemaines; s++) {
        const n = joursTravailles(ctx, plan, p.id, s);
        const obj = ctx.objectif(p.id, s);
        jours += n; contrat += obj; sup += Math.max(0, n - obj);
      }
      joursSup += sup;
      parPersonne[p.id] = { jours, contrat, sup };
    }
    const demandesRespectees = donnees.demandes_repos.filter((d) => !plan.has(cle(d.id, d.jour))).length;
    const absencesHorizon = absences.filter((a) => a.fin >= ctx.jours[0] && a.debut <= ctx.jours[ctx.jours.length - 1]);
    return {
      requis, couverts, joursSup, heuresSup: joursSup * donnees.creneaux.O.heures, parPersonne,
      demandesRespectees, demandesTotal: donnees.demandes_repos.length, nbAbsences: absencesHorizon.length,
    };
  }

  function differences(avant, apres) {
    const cles = new Set([...avant.keys(), ...apres.keys()]);
    const liste = [];
    for (const k of cles) {
      const a = avant.get(k), b = apres.get(k);
      if (a && b && a.c === b.c && a.r === b.r) continue;
      const [id, jour] = k.split("|");
      liste.push({ id, jour, avant: a || null, apres: b || null });
    }
    return liste.sort((x, y) => (x.jour < y.jour ? -1 : x.jour > y.jour ? 1 : x.id < y.id ? -1 : 1));
  }

  function maintenant() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  const api = { generer, replanifier, controler, indicateurs, differences, preparer, cle, ajouterJours, jourSemaine, CRENEAUX };
  if (typeof module !== "undefined") module.exports = api;
  global.MoteurPlanning = api;
})(typeof window !== "undefined" ? window : globalThis);
