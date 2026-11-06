/* Planning interactif — application (affichage, gestion des absences, assistant, validation).
   Le calcul est fait par moteur.js ; l'analyse des demandes écrites par assistant.js.
   Règle de conduite : tout changement de planning passe par une PROPOSITION que le manager
   valide ou abandonne. Rien n'est publié automatiquement. */
(function () {
  "use strict";
  const M = window.MoteurPlanning;
  const A = window.AssistantPlanning;
  const CLE_STOCKAGE = "planning-velo-demo-v1";
  const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const JOURS_LONGS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const LETTRES = ["D", "L", "M", "M", "J", "V", "S"];

  // ------------------------------------------------------------------ utilitaires
  const e = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const copie = (o) => JSON.parse(JSON.stringify(o));
  const nombre = (x, d = 0) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
  const jjmm = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
  const dateLongue = (iso) => `${JOURS_LONGS[M.jourSemaine(iso)]} ${Number(iso.slice(8))} ${MOIS[Number(iso.slice(5, 7)) - 1]}`;
  const dateTitre = (iso) => `${Number(iso.slice(8))} ${MOIS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
  const $ = (sel) => document.querySelector(sel);

  let etat = null;          // données, planning publié, historique, proposition en cours
  let cible = null;         // case ouverte dans la fenêtre de modification
  const messages = [];      // conversation avec l'assistant (non enregistrée)

  const collab = (id) => etat.donnees.collaborateurs.find((c) => c.id === id);
  const typeAbs = (t) => etat.donnees.types_absence[t];
  const libelleCreneau = (c) => `${etat.donnees.creneaux[c].libelle.toLowerCase()}`;
  const libelleAffectation = (a) => `${libelleCreneau(a.c)}, ${etat.donnees.roles[a.r].toLowerCase()}`;

  // ------------------------------------------------------------------ état et enregistrement local
  function absencesValidees(liste = etat.donnees.absences) {
    return liste.filter((a) => a.statut === "validee").map(versMoteur);
  }
  // Absence au format du moteur ; jours_retires = jours où la personne était planifiée (absence après publication)
  function versMoteur(a) {
    const r = { id: a.id, debut: a.debut, fin: a.fin };
    if (a.jours_retires) r.jours_retires = a.jours_retires;
    return r;
  }
  function joursPlanifies(id, debut, fin) {
    const liste = [];
    for (let j = debut; j <= fin; j = M.ajouterJours(j, 1)) if (etat.publie && etat.publie.has(M.cle(id, j))) liste.push(j);
    return liste;
  }
  function donneesMoteur(absences, donnees = etat.donnees) {
    return Object.assign({}, donnees, { absences });
  }
  const versListe = (plan) => [...plan.entries()];
  const versPlan = (liste) => new Map(liste);

  function initialiser() {
    const donnees = copie(DONNEES_PLANNING)   // défini dans donnees.js;
    etat = { version: 1, donnees, publie: null, historique: [], proposition: null, dernierCalcul: 0 };
    const g = M.generer(donneesMoteur(absencesValidees(donnees.absences), donnees));
    etat.publie = g.plan;
    etat.dernierCalcul = g.duree_ms;
    journal(`Planning généré automatiquement à partir des règles et des absences validées (${nombre(g.duree_ms)} ms).`);
  }
  function enregistrer() {
    try {
      const a_garder = Object.assign({}, etat, { publie: versListe(etat.publie), proposition: null });
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify(a_garder));
    } catch (err) { /* stockage indisponible : la démo fonctionne sans */ }
  }
  function charger() {
    try {
      const brut = localStorage.getItem(CLE_STOCKAGE);
      if (!brut) return false;
      const lu = JSON.parse(brut);
      if (lu.version !== 1) return false;
      etat = Object.assign(lu, { publie: versPlan(lu.publie), proposition: null });
      return true;
    } catch (err) { return false; }
  }
  function journal(texte) {
    etat.historique.unshift({ quand: new Date().toISOString(), texte });
  }

  // ------------------------------------------------------------------ calculs d'appoint
  function contexte(absences = absencesValidees()) { return M.preparer(donneesMoteur(absences), absences); }
  function joursOuvres(debut, fin) {
    const ctx = contexte([]);
    let n = 0;
    for (let j = debut; j <= fin; j = M.ajouterJours(j, 1)) if (ctx.ouvert(j)) n++;
    return n;
  }
  function absenceDu(id, jour, liste = etat.donnees.absences, statuts = ["validee"]) {
    return liste.find((a) => a.id === id && statuts.includes(a.statut) && a.debut <= jour && jour <= a.fin);
  }
  function chevauchement(id, debut, fin) {
    return etat.donnees.absences.find((a) => a.id === id && a.statut !== "refusee" && a.debut <= fin && debut <= a.fin);
  }
  function prochainNumero() { return Math.max(0, ...etat.donnees.absences.map((a) => a.num)) + 1; }

  // ------------------------------------------------------------------ propositions (jamais publiées sans validation)
  function proposer({ description, actions, absencesApres, regenerer = false, donneesApres = etat.donnees }) {
    const dm = donneesMoteur(absencesApres, donneesApres);
    let plan, duree;
    if (regenerer) { const g = M.generer(dm); plan = g.plan; duree = g.duree_ms; }
    else { const r = M.replanifier(dm, etat.publie, absencesApres); plan = r.plan; duree = r.duree_ms; }
    const anomalies = M.controler(dm, plan, absencesApres);
    const ind = M.indicateurs(dm, plan, absencesApres);
    const avant = M.indicateurs(donneesMoteur(absencesValidees()), etat.publie, absencesValidees());
    etat.proposition = {
      description, actions, plan, absences: absencesApres, donnees: donneesApres, duree,
      diff: M.differences(etat.publie, plan), anomalies, ind,
      deltaHeuresSup: ind.heuresSup - avant.heuresSup,
      trous: anomalies.filter((a) => a.regle === "COUVERTURE").length,
    };
    etat.dernierCalcul = duree;
    afficherOnglet("planning");
    rendreTout();
    return etat.proposition;
  }

  function validerProposition() {
    const p = etat.proposition;
    if (!p) return;
    etat.donnees = p.donnees;
    for (const act of p.actions) {
      if (act.type === "nouvelle_absence") {
        etat.donnees.absences.push(Object.assign({}, act.absence, { statut: "validee" }));
        decompter(act.absence);
      } else if (act.type === "valider_absence") {
        const a = etat.donnees.absences.find((x) => x.num === act.num);
        if (a) { a.statut = "validee"; decompter(a); }
      }
    }
    etat.publie = p.plan;
    journal(`Publié par le manager : ${p.description} — ${p.diff.length} changement(s), ${p.anomalies.length} anomalie(s).`);
    etat.proposition = null;
    enregistrer();
    rendreTout();
    direAssistant("Planning publié. Les collaborateurs concernés peuvent être prévenus.");
  }
  function abandonnerProposition() {
    if (!etat.proposition) return;
    journal(`Proposition abandonnée : ${etat.proposition.description}.`);
    etat.proposition = null;
    enregistrer();
    rendreTout();
  }
  function decompter(abs) {
    const t = typeAbs(abs.type);
    if (!t || !t.compteur) return;
    const c = collab(abs.id);
    c.soldes[t.compteur] = (c.soldes[t.compteur] || 0) - joursOuvres(abs.debut, abs.fin);
  }

  // Préparer une absence (contrôles communs au formulaire et à l'assistant)
  function preparerAbsence(id, type, debut, fin, source) {
    const h = contexte([]).jours;
    if (!collab(id)) return { erreur: "Collaborateur inconnu." };
    if (!typeAbs(type)) return { erreur: "Type d'absence inconnu." };
    if (!debut || !fin || debut > fin) return { erreur: "Dates invalides : la date de fin doit suivre la date de début." };
    if (fin < h[0] || debut > h[h.length - 1]) return { erreur: `Période hors du planning (${jjmm(h[0])} au ${jjmm(h[h.length - 1])}).` };
    const deja = chevauchement(id, debut, fin);
    if (deja) return { erreur: `${collab(id).nom} a déjà une absence (${typeAbs(deja.type).libelle}, ${jjmm(deja.debut)}–${jjmm(deja.fin)}) sur cette période.` };
    const n = joursOuvres(debut, fin);
    const t = typeAbs(type);
    if (t.compteur && (collab(id).soldes[t.compteur] || 0) < n) {
      return { erreur: `Solde insuffisant : ${collab(id).nom} a ${nombre(collab(id).soldes[t.compteur] || 0)} jour(s) de ${t.libelle} pour ${n} jour(s) ouvrés demandés.` };
    }
    return { absence: { num: prochainNumero(), id, type, debut, fin, statut: "en_attente", source }, joursOuvres: n };
  }

  function proposerAbsence(abs, description) {
    abs.jours_retires = joursPlanifies(abs.id, abs.debut, abs.fin);
    const apres = absencesValidees().concat([versMoteur(abs)]);
    return proposer({ description, actions: [{ type: "nouvelle_absence", absence: abs }], absencesApres: apres });
  }
  function proposerValidationDemande(num) {
    const a = etat.donnees.absences.find((x) => x.num === num);
    const t = typeAbs(a.type);
    if (t.compteur && (collab(a.id).soldes[t.compteur] || 0) < joursOuvres(a.debut, a.fin)) {
      alerteFormulaire(`Solde de ${t.libelle} insuffisant pour ${collab(a.id).nom}.`);
      return null;
    }
    a.jours_retires = joursPlanifies(a.id, a.debut, a.fin);
    const apres = absencesValidees().concat([versMoteur(a)]);
    return proposer({ description: `validation de la demande de ${t.libelle} de ${collab(a.id).nom} (${periode(a)})`,
      actions: [{ type: "valider_absence", num }], absencesApres: apres });
  }
  const periode = (a) => (a.debut === a.fin ? `le ${jjmm(a.debut)}` : `du ${jjmm(a.debut)} au ${jjmm(a.fin)}`);

  function absencesApresProposition(p) {
    if (!p) return etat.donnees.absences;
    const aValider = new Set(p.actions.filter((x) => x.type === "valider_absence").map((x) => x.num));
    return etat.donnees.absences.map((a) => (aValider.has(a.num) ? Object.assign({}, a, { statut: "validee" }) : a))
      .concat(p.actions.filter((x) => x.type === "nouvelle_absence").map((x) => Object.assign({}, x.absence, { statut: "validee" })));
  }

  function decrireChangement(d) {
    const nom = collab(d.id) ? collab(d.id).nom : d.id;
    if (!d.avant) return `${nom} : ajouté le ${jjmm(d.jour)} (${libelleAffectation(d.apres)})`;
    if (!d.apres) return `${nom} : retiré le ${jjmm(d.jour)}`;
    return `${nom} le ${jjmm(d.jour)} : ${libelleAffectation(d.avant)} → ${libelleAffectation(d.apres)}`;
  }

  // ------------------------------------------------------------------ rendu
  function rendreTout() {
    const h = contexte([]).jours;
    $("#titre").textContent = `Planning de l'équipe — ${dateTitre(h[0])} au ${dateTitre(h[h.length - 1])}`;
    const attente = etat.donnees.absences.filter((a) => a.statut === "en_attente").length;
    $("#nb-attente").hidden = attente === 0;
    $("#nb-attente").textContent = attente;
    rendreProposition();
    rendrePlanning();
    rendreAbsences();
    rendreEquipe();
    rendreHistorique();
  }

  function rendreProposition() {
    const zone = $("#proposition");
    const p = etat.proposition;
    zone.hidden = !p;
    if (!p) { zone.innerHTML = ""; return; }
    const hs = p.deltaHeuresSup;
    zone.innerHTML = `
      <h2>Proposition à valider : ${e(p.description)}</h2>
      <p class="resume"><b>${p.diff.length}</b> changement(s) · heures supplémentaires : ${hs > 0 ? "+" : ""}${nombre(hs)} h ·
        <b class="${p.trous ? "manque" : ""}">${p.trous}</b> poste(s) non couvert(s) · ${p.anomalies.length} anomalie(s) au contrôle ·
        calcul en ${nombre(p.duree, 1)} ms</p>
      <details ${p.diff.length <= 8 ? "open" : ""}><summary>Détail des changements (cases en pointillés dans le planning)</summary>
        <ul>${p.diff.slice(0, 40).map((d) => `<li>${e(decrireChangement(d))}</li>`).join("") || "<li>Aucun changement de planning.</li>"}</ul>
        ${p.diff.length > 40 ? `<p class="note">… et ${p.diff.length - 40} autre(s).</p>` : ""}</details>
      ${p.anomalies.length ? `<p class="message-form erreur">Attention : ${e(p.anomalies.map((a) => a.detail + (a.jour ? " le " + jjmm(a.jour) : "")).slice(0, 4).join(" ; "))}</p>` : ""}
      <div class="actions">
        <button type="button" class="principal" data-action="valider-prop">${p.trous ? `Publier malgré ${p.trous} poste(s) non couvert(s)` : "Valider et publier"}</button>
        <button type="button" class="secondaire" data-action="abandonner-prop">Abandonner</button>
      </div>`;
  }

  function rendrePlanning() {
    const p = etat.proposition;
    const plan = p ? p.plan : etat.publie;
    const absences = p ? p.absences : absencesValidees();
    const donnees = p ? p.donnees : etat.donnees;
    const dm = donneesMoteur(absences, donnees);
    const ctx = M.preparer(dm, absences);
    const ind = p ? p.ind : M.indicateurs(dm, plan, absences);
    const anomalies = p ? p.anomalies : M.controler(dm, plan, absences);
    const modifies = new Set(p ? p.diff.map((d) => M.cle(d.id, d.jour)) : []);
    const attente = etat.donnees.absences.filter((a) => a.statut === "en_attente");
    const nbValidees = etat.donnees.absences.filter((a) => a.statut === "validee").length;
    // Absences telles qu'elles seront APRÈS la proposition (nouvelle absence ou demande validée)
    const affichees = absencesApresProposition(p);

    const kpi = (titre, valeur, detail, alerte = false) =>
      `<article class="kpi${alerte ? " alerte" : ""}"><h3>${e(titre)}</h3><p class="valeur">${e(valeur)}</p><p class="detail">${e(detail)}</p></article>`;
    const kpis = [
      kpi("Postes couverts", `${nombre(ind.couverts)} / ${nombre(ind.requis)}`, "effectif minimum par créneau", ind.couverts < ind.requis),
      kpi("Règles respectées", anomalies.length ? `${anomalies.length} anomalie(s)` : "100 %", "contrôle indépendant", anomalies.length > 0),
      kpi("Absences", nombre(nbValidees), `${attente.length} demande(s) en attente`),
      kpi("Heures supplémentaires", `${nombre(ind.heuresSup)} h`, "au-delà des contrats"),
      kpi("Demandes de repos", `${ind.demandesRespectees} / ${ind.demandesTotal}`, "respectées"),
      kpi("Dernier calcul", `${nombre(etat.dernierCalcul, 1)} ms`, "dans le navigateur"),
    ].join("");

    // En-tête des jours
    const entete = `<th class="col-nom" scope="col">Collaborateur</th>` + ctx.jours.map((j) => {
      const js = M.jourSemaine(j);
      return `<th scope="col" class="${ctx.ouvert(j) ? "" : "ferme"} ${js === 1 ? "lundi" : ""}" title="${e(dateLongue(j))}${ctx.ouvert(j) ? "" : " — fermé"}"><span>${LETTRES[js]}</span>${Number(j.slice(8))}</th>`;
    }).join("") + `<th class="col-total" scope="col">Jours / contrat</th>`;

    // Lignes par groupe (poste principal)
    const groupes = [["MECA", "Atelier"], ["VENTE", "Magasin"]];
    let lignes = "";
    for (const [role, nomGroupe] of groupes) {
      const membres = donnees.collaborateurs.filter((c) => c.habilitations[0] === role);
      if (!membres.length) continue;
      lignes += `<tr class="groupe"><th class="col-nom" scope="rowgroup">${e(nomGroupe)}</th><td colspan="${ctx.jours.length + 1}"></td></tr>`;
      for (const c of membres) {
        const cases = ctx.jours.map((j) => {
          const lundi = M.jourSemaine(j) === 1 ? " lundi" : "";
          if (!ctx.ouvert(j)) return `<td class="case ferme${lundi}" title="Magasin fermé">–</td>`;
          const k = M.cle(c.id, j);
          const absV = absenceDu(c.id, j, affichees, ["validee"]);
          const absA = !absV ? absenceDu(c.id, j, affichees, ["en_attente"]) : null;
          const a = plan.get(k);
          let classe = "repos", texte = "", info = "Repos";
          if (absV) { classe = "absence"; texte = typeAbs(absV.type).court; info = typeAbs(absV.type).libelle; }
          else if (a) {
            classe = `c${a.c}`;
            texte = a.c;
            info = `${donnees.creneaux[a.c].libelle} ${donnees.creneaux[a.c].horaire} · ${donnees.roles[a.r]}`;
          }
          if (absA) { classe += " attente"; info += ` · demande de ${typeAbs(absA.type).libelle} en attente`; }
          if (modifies.has(k)) { classe += " modifie"; info += " · modifié par la proposition"; }
          const bulle = `${c.nom} · ${dateLongue(j)} · ${info}`;
          const secondaire = a && !absV && a.r !== c.habilitations[0] ? ' class="secondaire-poste"' : "";
          return `<td class="case ${classe}${lundi}"><button type="button"${secondaire} data-action="case" data-id="${c.id}" data-jour="${j}" title="${e(bulle)}" aria-label="${e(bulle)}">${e(texte)}</button></td>`;
        }).join("");
        const pp = ind.parPersonne[c.id] || { jours: 0, contrat: 0, sup: 0 };
        lignes += `<tr><th class="col-nom" scope="row">${e(c.nom)}<small>${e(c.fonction)}</small></th>${cases}
          <td class="col-total">${pp.jours} / ${pp.contrat}${pp.sup ? ` <b title="jours en heures supplémentaires">(+${pp.sup})</b>` : ""}</td></tr>`;
      }
    }
    // Ligne de couverture : postes minimum manquants par jour
    const couverture = ctx.jours.map((j) => {
      const lundi = M.jourSemaine(j) === 1 ? " lundi" : "";
      if (!ctx.ouvert(j)) return `<td class="${lundi}"></td>`;
      const manque = anomalies.filter((x) => x.regle === "COUVERTURE" && x.jour === j)
        .reduce((s, x) => s + (Number(x.detail.match(/(\d+) requis/)[1]) - Number(x.detail.match(/: (\d+) sur/)[1])), 0);
      return manque ? `<td class="manque${lundi}" title="${manque} poste(s) non couvert(s)">−${manque}</td>` : `<td class="ok${lundi}" title="Effectif minimum atteint">✓</td>`;
    }).join("");
    lignes += `<tr class="couverture"><th class="col-nom" scope="row">Effectif minimum</th>${couverture}<td></td></tr>`;

    const corriger = !p && anomalies.length
      ? `<p class="message-form erreur">Le planning publié comporte ${anomalies.length} anomalie(s). <button type="button" class="secondaire petit" data-action="corriger">Proposer une correction automatique</button></p>` : "";

    $("#onglet-planning").innerHTML = `
      <div class="kpis" aria-label="Indicateurs clés">${kpis}</div>
      <div class="carte">
        <h2>${p ? "Planning proposé (non publié)" : "Planning publié"}</h2>
        <p class="note">Cliquez sur une case pour changer un créneau ou déclarer une absence. O = ouverture ${e(donnees.creneaux.O.horaire)}, F = fermeture ${e(donnees.creneaux.F.horaire)}.</p>
        ${corriger}
        <div class="defile" tabindex="0" role="region" aria-label="Planning par collaborateur et par jour">
          <table class="grille"><thead><tr>${entete}</tr></thead><tbody>${lignes}</tbody></table>
        </div>
        <ul class="legende">
          <li><span class="cO">O</span>Ouverture</li>
          <li><span class="cF">F</span>Fermeture</li>
          <li><span class="cO secondaire-poste">O</span>Poste secondaire (polyvalence)</li>
          <li><span class="repos"></span>Repos</li>
          <li><span class="absence">CP</span>Absence validée (CP, RTT, formation…)</li>
          <li><span class="cO attente">O</span>Demande en attente</li>
          <li><span class="cO modifie">O</span>Modifié par la proposition</li>
          <li><span class="ferme">–</span>Magasin fermé</li>
        </ul>
      </div>`;
  }

  function rendreAbsences() {
    const d = etat.donnees;
    const h = contexte([]).jours;
    const optionsCollab = d.collaborateurs.map((c) => `<option value="${c.id}">${e(c.nom)} — ${e(c.fonction)}</option>`).join("");
    const optionsType = Object.entries(d.types_absence).map(([k, t]) => `<option value="${k}">${e(t.libelle)}</option>`).join("");
    const ligneAbs = (a, actions) => `<tr><td>${e(collab(a.id).nom)}</td><td>${e(typeAbs(a.type).libelle)}</td>
      <td>${e(periode(a))}</td><td class="num">${joursOuvres(a.debut, a.fin)}</td>
      <td><span class="statut ${a.statut}">${{ validee: "Validée", en_attente: "En attente", refusee: "Refusée" }[a.statut]}</span></td>
      <td>${e({ manager: "Manager", collaborateur: "Collaborateur", assistant: "Assistant" }[a.source] || a.source)}</td><td>${actions}</td></tr>`;
    const attente = d.absences.filter((a) => a.statut === "en_attente");
    const bloque = etat.proposition ? " disabled title=\"Validez ou abandonnez d'abord la proposition en cours\"" : "";

    $("#onglet-absences").innerHTML = `
      <div class="carte">
        <h2>Déclarer une absence ou poser des congés</h2>
        <form id="form-absence" class="formulaire">
          <label>Collaborateur<select id="abs-collab">${optionsCollab}</select></label>
          <label>Type<select id="abs-type">${optionsType}</select></label>
          <label>Du<input id="abs-debut" type="date" min="${h[0]}" max="${h[h.length - 1]}" value="${h[0]}"></label>
          <label>Au<input id="abs-fin" type="date" min="${h[0]}" max="${h[h.length - 1]}" value="${h[0]}"></label>
          <button type="submit" class="principal"${bloque}>Valider et recalculer</button>
          <button type="button" class="secondaire" data-action="enregistrer-demande"${bloque}>Enregistrer comme demande</button>
        </form>
        <p id="message-absence" class="message-form" aria-live="polite"></p>
        <p class="note">« Valider et recalculer » prépare une proposition de planning à valider. Les congés payés et RTT sont décomptés des soldes à la publication (jours ouvrés, hors dimanches et fériés).</p>
      </div>
      <div class="carte">
        <h2>Demandes en attente (${attente.length})</h2>
        ${attente.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Collaborateur</th><th>Type</th><th>Période</th><th>Jours ouvrés</th><th>Statut</th><th>Origine</th><th></th></tr></thead>
          <tbody>${attente.map((a) => ligneAbs(a, `<button type="button" class="principal petit" data-action="valider-abs" data-num="${a.num}"${bloque}>Valider</button>
            <button type="button" class="danger petit" data-action="refuser-abs" data-num="${a.num}"${bloque}>Refuser</button>`)).join("")}</tbody></table></div>`
          : `<p class="note">Aucune demande en attente.</p>`}
      </div>
      <div class="carte">
        <h2>Compteurs</h2>
        <div class="defile"><table class="tableau"><thead><tr><th>Collaborateur</th><th>Contrat</th><th>Congés payés restants</th><th>RTT restants</th><th>Demandé (en attente)</th></tr></thead>
        <tbody>${d.collaborateurs.map((c) => {
          const enAttente = attente.filter((a) => a.id === c.id).reduce((s, a) => s + joursOuvres(a.debut, a.fin), 0);
          return `<tr><td>${e(c.nom)}</td><td>${c.jours_contrat} j / sem.</td><td class="num">${nombre(c.soldes.CP || 0)} j</td>
            <td class="num">${nombre(c.soldes.RTT || 0)} j</td><td class="num">${enAttente ? enAttente + " j" : "—"}</td></tr>`;
        }).join("")}</tbody></table></div>
      </div>
      <div class="carte">
        <h2>Toutes les absences</h2>
        <div class="defile"><table class="tableau"><thead><tr><th>Collaborateur</th><th>Type</th><th>Période</th><th>Jours ouvrés</th><th>Statut</th><th>Origine</th><th></th></tr></thead>
        <tbody>${d.absences.slice().sort((x, y) => (x.debut < y.debut ? -1 : 1)).map((a) => ligneAbs(a, "")).join("")}</tbody></table></div>
      </div>`;
  }

  function rendreEquipe() {
    const d = etat.donnees;
    const b = d.besoins;
    const champ = (type, c, r) => `<input type="number" min="0" max="6" step="1" id="b-${type}-${c}-${r}" value="${b[type][c][r]}" aria-label="Effectif minimum ${type} ${c} ${r}">`;
    const bloque = etat.proposition ? " disabled title=\"Validez ou abandonnez d'abord la proposition en cours\"" : "";
    $("#onglet-equipe").innerHTML = `
      <div class="carte">
        <h2>Effectif minimum par créneau</h2>
        <p class="note">Le moteur garantit ces minimums, puis complète les jours du contrat de chacun en renfort.</p>
        <div class="defile"><table class="tableau"><thead><tr><th>Créneau</th><th>Poste</th><th>Lundi → vendredi</th><th>Samedi</th></tr></thead><tbody>
        ${["O", "F"].map((c) => Object.keys(d.roles).map((r) => `<tr><td>${e(d.creneaux[c].libelle)} (${e(d.creneaux[c].horaire)})</td><td>${e(d.roles[r])}</td>
          <td>${champ("semaine", c, r)}</td><td>${champ("samedi", c, r)}</td></tr>`).join("")).join("")}
        </tbody></table></div>
      </div>
      <div class="carte">
        <h2>Équipe</h2>
        <div class="defile"><table class="tableau"><thead><tr><th>Nom</th><th>Fonction</th><th>Poste principal</th><th>Polyvalent</th><th>Jours / semaine</th></tr></thead><tbody>
        ${d.collaborateurs.map((c) => `<tr>
          <td><input type="text" id="n-${c.id}" value="${e(c.nom)}" aria-label="Nom"></td>
          <td><input type="text" id="f-${c.id}" value="${e(c.fonction)}" aria-label="Fonction"></td>
          <td><select id="p-${c.id}" aria-label="Poste principal">${Object.entries(d.roles).map(([r, l]) => `<option value="${r}" ${c.habilitations[0] === r ? "selected" : ""}>${e(l)}</option>`).join("")}</select></td>
          <td><input type="checkbox" id="v-${c.id}" ${c.habilitations.length > 1 ? "checked" : ""} aria-label="Peut tenir l'autre poste"></td>
          <td><input type="number" id="j-${c.id}" min="1" max="6" step="1" value="${c.jours_contrat}" aria-label="Jours par semaine"></td></tr>`).join("")}
        </tbody></table></div>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button type="button" class="secondaire" data-action="ajouter-collab"${bloque}>Ajouter un collaborateur</button>
          <button type="button" class="principal" data-action="generer-regles"${bloque}>Générer un nouveau planning avec ces règles</button>
        </div>
        <p id="message-equipe" class="message-form" aria-live="polite"></p>
      </div>
      <div class="carte">
        <h2>Règles appliquées</h2>
        <ul class="note">
          <li>Magasin fermé le dimanche et les jours fériés (${d.feries.map(jjmm).join(", ")}).</li>
          <li>Deux créneaux : ouverture ${e(d.creneaux.O.horaire)}, fermeture ${e(d.creneaux.F.horaire)} (7 h de travail, 11 h de repos toujours respectées entre deux journées).</li>
          <li>${d.regles.max_jours_semaine} jours travaillés au maximum par semaine et ${d.regles.max_jours_consecutifs} jours de suite au maximum.</li>
          <li>Chacun ne tient que les postes pour lesquels il est habilité ; personne n'est planifié pendant une absence validée.</li>
          <li>Les jours de contrat sont respectés ; au-delà, le jour compte en heures supplémentaires et n'est utilisé qu'en dernier recours.</li>
          <li>Les demandes de repos sont respectées autant que possible.</li>
        </ul>
      </div>`;
  }

  function rendreHistorique() {
    $("#onglet-historique").innerHTML = `<div class="carte"><h2>Historique des décisions</h2>
      <ul class="historique">${etat.historique.map((h) => {
        const d = new Date(h.quand);
        return `<li><time datetime="${h.quand}">${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time>${e(h.texte)}</li>`;
      }).join("")}</ul></div>`;
  }

  function afficherOnglet(nom) {
    document.querySelectorAll(".onglets button").forEach((b) => b.setAttribute("aria-selected", b.dataset.onglet === nom ? "true" : "false"));
    document.querySelectorAll(".onglet").forEach((s) => { s.hidden = s.id !== `onglet-${nom}`; });
  }
  function alerteFormulaire(texte, ok = false) {
    const zone = $("#message-absence");
    if (zone) { zone.textContent = texte; zone.className = "message-form" + (ok ? "" : " erreur"); }
  }

  // ------------------------------------------------------------------ fenêtre de modification d'une case
  function ouvrirCase(id, jour) {
    const c = collab(id);
    cible = { id, jour };
    $("#fenetre-titre").textContent = `${c.nom} — ${dateLongue(jour)}`;
    if (etat.proposition) {
      $("#fenetre-corps").innerHTML = `<p>Une proposition est en attente : validez-la ou abandonnez-la avant de modifier le planning.</p>`;
    } else {
      const a = etat.publie.get(M.cle(id, jour));
      const abs = absenceDu(id, jour);
      const actuel = abs ? `${typeAbs(abs.type).libelle} (${periode(abs)})` : a ? `${etat.donnees.creneaux[a.c].libelle} ${etat.donnees.creneaux[a.c].horaire} · ${etat.donnees.roles[a.r]}` : "Repos";
      const boutons = ["O", "F"].flatMap((cr) => c.habilitations.map((r) =>
        `<button type="button" class="secondaire" data-action="affecter" data-c="${cr}" data-r="${r}">${e(etat.donnees.creneaux[cr].libelle)} · ${e(etat.donnees.roles[r])}</button>`)).join("");
      $("#fenetre-corps").innerHTML = abs
        ? `<p>Actuellement : <b>${e(actuel)}</b>.</p><p class="note">Pour modifier cette absence, passez par l'onglet « Absences et congés ».</p>`
        : `<p>Actuellement : <b>${e(actuel)}</b>.</p>
          <p class="note">Changer l'affectation de ce jour (modification manuelle, contrôlée par les règles) :</p>
          <div class="choix">${boutons}<button type="button" class="secondaire" data-action="affecter-repos">Repos</button></div>
          <p class="note">Ou déclarer une absence ce jour-là (le planning sera recalculé) :</p>
          <div class="choix"><select id="fenetre-type" aria-label="Type d'absence">${Object.entries(etat.donnees.types_absence).map(([k, t]) => `<option value="${k}">${e(t.libelle)}</option>`).join("")}</select>
          <button type="button" class="principal" data-action="absence-jour">Déclarer et recalculer</button></div>
          <p id="fenetre-message" class="message-form erreur"></p>`;
    }
    $("#fenetre").showModal();
  }
  function affecterManuellement(c, r) {
    const k = M.cle(cible.id, cible.jour);
    const avant = etat.publie.get(k);
    if (c) etat.publie.set(k, { c, r }); else etat.publie.delete(k);
    const anomalies = M.controler(donneesMoteur(absencesValidees()), etat.publie, absencesValidees());
    journal(`Modification manuelle : ${collab(cible.id).nom} le ${jjmm(cible.jour)} — ${avant ? libelleAffectation(avant) : "repos"} → ${c ? libelleAffectation({ c, r }) : "repos"}${anomalies.length ? ` (${anomalies.length} anomalie(s) à corriger)` : ""}.`);
    enregistrer();
    $("#fenetre").close();
    rendreTout();
  }

  // ------------------------------------------------------------------ assistant
  function direAssistant(texte, actions = []) {
    messages.push({ qui: "assistant", texte, actions });
    rendreMessages();
  }
  function rendreMessages() {
    const zone = $("#messages");
    zone.innerHTML = messages.map((m, i) => `<div class="bulle ${m.qui === "manager" ? "manager" : "assistant-msg"}">${e(m.texte)}${
      m.actions && m.actions.length && i === messages.length - 1 && etat.proposition
        ? `<div class="actions">${m.actions.map((a) => `<button type="button" class="${a.style || "secondaire"} petit" data-action="${a.action}">${e(a.libelle)}</button>`).join("")}</div>` : ""}</div>`).join("");
    zone.scrollTop = zone.scrollHeight;
  }
  const BOUTONS_PROPOSITION = [
    { action: "valider-prop", libelle: "Valider et publier", style: "principal" },
    { action: "abandonner-prop", libelle: "Abandonner" },
  ];

  function resumerProposition(p) {
    const lignes = p.diff.slice(0, 6).map((d) => "• " + decrireChangement(d));
    if (p.diff.length > 6) lignes.push(`• … et ${p.diff.length - 6} autre(s)`);
    const hs = p.deltaHeuresSup;
    return `${p.diff.length} changement(s) :\n${lignes.join("\n") || "• aucun"}\n` +
      `Heures supplémentaires : ${hs > 0 ? "+" : ""}${nombre(hs)} h · postes non couverts : ${p.trous} · anomalies : ${p.anomalies.length} · calcul en ${nombre(p.duree, 1)} ms.\n` +
      `${p.anomalies.length ? "⚠ Le contrôle signale des points à traiter avant publication." : "Toutes les règles sont respectées."} Validez-vous ?`;
  }

  function traiterDemande(texte) {
    messages.push({ qui: "manager", texte });
    const intention = A.interpreter(texte, etat.donnees);
    const h = contexte([]).jours;
    if (["absence", "generer"].includes(intention.type) && etat.proposition) {
      direAssistant("Une proposition est déjà en attente : validez-la ou abandonnez-la d'abord.", BOUTONS_PROPOSITION);
      return;
    }
    switch (intention.type) {
      case "absence": {
        const t = typeAbs(intention.absenceType);
        const c = collab(intention.id);
        const prep = preparerAbsence(intention.id, intention.absenceType, intention.debut, intention.fin, "assistant");
        if (prep.erreur) { direAssistant(prep.erreur); return; }
        const p = proposerAbsence(prep.absence, `${t.libelle} de ${c.nom} (${periode(prep.absence)})`);
        const solde = t.compteur ? `\nDécompte : ${prep.joursOuvres} jour(s) ouvré(s) de ${t.libelle} ; solde après validation : ${nombre(c.soldes[t.compteur] - prep.joursOuvres)} j.` : "";
        const libelle = t.libelle === t.libelle.toUpperCase() ? t.libelle : t.libelle.toLowerCase();
        const conseil = p.trous && t.sur_demande
          ? `\n\n⚠ Accorder cette demande laisserait ${p.trous} poste(s) non couvert(s). Je vous conseille de proposer une autre date au collaborateur, ou de l'enregistrer comme demande et de la refuser.` : "";
        direAssistant(`J'ai compris : ${c.nom}, ${libelle} ${periode(prep.absence)} (${prep.joursOuvres} jour(s) ouvré(s)).${solde}\n\nProposition de planning — ${resumerProposition(p)}${conseil}`, BOUTONS_PROPOSITION);
        return;
      }
      case "disponibles": {
        const ctx = contexte();
        const j = intention.jour;
        if (!ctx.ouvert(j)) { direAssistant(`Le magasin est fermé le ${dateLongue(j)}.`); return; }
        const s = ctx.semaine(j);
        const libres = etat.donnees.collaborateurs.filter((c) => (!intention.role || c.habilitations.includes(intention.role)) &&
          !ctx.absent(c.id, j) && !etat.publie.has(M.cle(c.id, j)));
        const poste = intention.role ? ` pour le poste ${etat.donnees.roles[intention.role].toLowerCase()}` : "";
        if (!libres.length) { direAssistant(`Personne n'est libre le ${dateLongue(j)}${poste} : tout le monde travaille ou est absent.`); return; }
        direAssistant(`Libres le ${dateLongue(j)}${poste} :\n` + libres.map((c) => {
          const n = [...etat.publie.keys()].filter((k) => k.startsWith(c.id + "|") && ctx.semaine(k.split("|")[1]) === s).length;
          return `• ${c.nom} (${c.fonction}) — ${n} jour(s) cette semaine sur ${ctx.objectif(c.id, s)}${n >= ctx.objectif(c.id, s) ? " : ce serait en heures supplémentaires" : ""}`;
        }).join("\n"));
        return;
      }
      case "solde": {
        const c = collab(intention.id);
        const attente = etat.donnees.absences.filter((a) => a.id === c.id && a.statut === "en_attente");
        direAssistant(`${c.nom} : ${nombre(c.soldes.CP || 0)} jour(s) de congés payés et ${nombre(c.soldes.RTT || 0)} RTT restants.` +
          (attente.length ? `\nEn attente : ${attente.map((a) => `${typeAbs(a.type).libelle} ${periode(a)}`).join(", ")}.` : ""));
        return;
      }
      case "planning_personne": {
        const c = collab(intention.id);
        const ctx = contexte();
        const parSemaine = [];
        for (let s = 0; s < ctx.nbSemaines; s++) {
          const jours = ctx.jours.filter((j) => ctx.semaine(j) === s);
          const lignes = jours.map((j) => {
            const a = etat.publie.get(M.cle(c.id, j));
            const abs = absenceDu(c.id, j);
            return abs ? `${JOURS[M.jourSemaine(j)]} ${Number(j.slice(8))} ${typeAbs(abs.type).court}` : a ? `${JOURS[M.jourSemaine(j)]} ${Number(j.slice(8))} ${a.c}` : null;
          }).filter(Boolean);
          parSemaine.push(`Semaine du ${jjmm(jours[0])} : ${lignes.join(", ") || "repos"}`);
        }
        direAssistant(`Planning de ${c.nom} (O = ouverture, F = fermeture) :\n${parSemaine.join("\n")}`);
        return;
      }
      case "generer": {
        const p = proposer({ description: "nouveau planning généré à partir des règles actuelles", actions: [], absencesApres: absencesValidees(), regenerer: true });
        direAssistant(`Nouveau planning calculé à partir des règles, des contrats et des absences validées.\n${resumerProposition(p)}`, BOUTONS_PROPOSITION);
        return;
      }
      default: {
        const aide = {
          personne: "De quel collaborateur s'agit-il ? Indiquez son prénom.",
          date: `Pour quelle date ? Par exemple « du 15 au 17 décembre » ou « le 22/12 » (planning du ${jjmm(h[0])} au ${jjmm(h[h.length - 1])}).`,
        }[intention.raison] || "Je sais traiter des demandes comme :";
        direAssistant(`${aide}\n• Karim est malade du 15 au 17 décembre\n• RTT pour Sofia le 22/12\n• Qui est disponible le 19 pour l'atelier ?\n• Combien de congés reste-t-il à Chloé ?\n• Quel est le planning de Yanis ?\n• Génère le planning`);
      }
    }
  }

  const EXEMPLES = ["Karim est malade du 15 au 17 décembre", "RTT pour Sofia le 22/12", "Qui est disponible le 19 pour l'atelier ?", "Combien de congés reste-t-il à Chloé ?"];

  // ------------------------------------------------------------------ actions de l'interface
  function lireRegles() {
    const d = copie(etat.donnees);
    for (const type of ["semaine", "samedi"]) for (const c of ["O", "F"]) for (const r of Object.keys(d.roles)) {
      const v = Number($(`#b-${type}-${c}-${r}`).value);
      if (!Number.isInteger(v) || v < 0 || v > 6) return { erreur: "Les effectifs minimum doivent être des nombres entiers entre 0 et 6." };
      d.besoins[type][c][r] = v;
    }
    for (const c of d.collaborateurs) {
      const nom = $(`#n-${c.id}`).value.trim(), jours = Number($(`#j-${c.id}`).value);
      if (!nom) return { erreur: "Chaque collaborateur doit avoir un nom." };
      if (!Number.isInteger(jours) || jours < 1 || jours > 6) return { erreur: `${nom} : le contrat doit compter de 1 à 6 jours par semaine.` };
      const principal = $(`#p-${c.id}`).value;
      const autres = Object.keys(d.roles).filter((r) => r !== principal);
      Object.assign(c, { nom, fonction: $(`#f-${c.id}`).value.trim() || c.fonction, jours_contrat: jours,
        habilitations: [principal].concat($(`#v-${c.id}`).checked ? autres : []) });
    }
    return { donnees: d };
  }

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-action], [data-onglet]");
    if (!el) return;
    if (el.dataset.onglet) { afficherOnglet(el.dataset.onglet); return; }
    switch (el.dataset.action) {
      case "case": ouvrirCase(el.dataset.id, el.dataset.jour); break;
      case "valider-prop": validerProposition(); break;
      case "abandonner-prop": abandonnerProposition(); direAssistant("Proposition abandonnée : le planning publié est inchangé."); break;
      case "corriger": {
        const p = proposer({ description: "correction automatique des anomalies du planning publié", actions: [], absencesApres: absencesValidees() });
        direAssistant(`Correction proposée.\n${resumerProposition(p)}`, BOUTONS_PROPOSITION);
        break;
      }
      case "valider-abs": {
        const p = proposerValidationDemande(Number(el.dataset.num));
        if (p) direAssistant(`Proposition pour la ${p.description}.\n${resumerProposition(p)}`, BOUTONS_PROPOSITION);
        break;
      }
      case "refuser-abs": {
        const a = etat.donnees.absences.find((x) => x.num === Number(el.dataset.num));
        a.statut = "refusee";
        journal(`Demande refusée : ${typeAbs(a.type).libelle} de ${collab(a.id).nom} (${periode(a)}).`);
        enregistrer(); rendreTout(); afficherOnglet("absences");
        break;
      }
      case "enregistrer-demande": {
        const prep = preparerAbsence($("#abs-collab").value, $("#abs-type").value, $("#abs-debut").value, $("#abs-fin").value, "manager");
        if (prep.erreur) { alerteFormulaire(prep.erreur); break; }
        etat.donnees.absences.push(prep.absence);
        journal(`Demande enregistrée : ${typeAbs(prep.absence.type).libelle} de ${collab(prep.absence.id).nom} (${periode(prep.absence)}).`);
        enregistrer(); rendreTout(); afficherOnglet("absences");
        alerteFormulaire("Demande enregistrée : elle apparaît en attente de validation.", true);
        break;
      }
      case "affecter": affecterManuellement(el.dataset.c, el.dataset.r); break;
      case "affecter-repos": affecterManuellement(null, null); break;
      case "absence-jour": {
        const prep = preparerAbsence(cible.id, $("#fenetre-type").value, cible.jour, cible.jour, "manager");
        if (prep.erreur) { $("#fenetre-message").textContent = prep.erreur; break; }
        $("#fenetre").close();
        const t = typeAbs(prep.absence.type);
        const p = proposerAbsence(prep.absence, `${t.libelle} de ${collab(cible.id).nom} (${periode(prep.absence)})`);
        direAssistant(`Absence déclarée depuis le planning.\n${resumerProposition(p)}`, BOUTONS_PROPOSITION);
        break;
      }
      case "ajouter-collab": {
        const num = etat.donnees.collaborateurs.length + 1;
        const id = `C${String(num).padStart(2, "0")}`;
        etat.donnees.collaborateurs.push({ id, nom: `Nouveau collaborateur ${num}`, fonction: "Conseiller de vente", habilitations: ["VENTE"], jours_contrat: 5, soldes: { CP: 0, RTT: 0 } });
        journal(`Collaborateur ajouté à l'équipe : ${id}. Générez un nouveau planning pour l'intégrer.`);
        enregistrer(); rendreTout(); afficherOnglet("equipe");
        break;
      }
      case "generer-regles": {
        const lu = lireRegles();
        if (lu.erreur) { $("#message-equipe").textContent = lu.erreur; $("#message-equipe").className = "message-form erreur"; break; }
        const p = proposer({ description: "nouveau planning généré avec les règles et l'équipe modifiées", actions: [], absencesApres: absencesValidees(), regenerer: true, donneesApres: lu.donnees });
        direAssistant(`Nouveau planning calculé avec vos règles.\n${resumerProposition(p)}`, BOUTONS_PROPOSITION);
        break;
      }
      case "exemple": $("#question").value = el.dataset.texte; $("#question").focus(); break;
      default: break;
    }
  });

  document.addEventListener("submit", (ev) => {
    if (ev.target.id === "form-assistant") {
      ev.preventDefault();
      const texte = $("#question").value.trim();
      if (!texte) return;
      $("#question").value = "";
      traiterDemande(texte);
    } else if (ev.target.id === "form-absence") {
      ev.preventDefault();
      const prep = preparerAbsence($("#abs-collab").value, $("#abs-type").value, $("#abs-debut").value, $("#abs-fin").value, "manager");
      if (prep.erreur) { alerteFormulaire(prep.erreur); return; }
      const t = typeAbs(prep.absence.type);
      const p = proposerAbsence(prep.absence, `${t.libelle} de ${collab(prep.absence.id).nom} (${periode(prep.absence)})`);
      direAssistant(`Absence saisie dans le formulaire.\n${resumerProposition(p)}`, BOUTONS_PROPOSITION);
    }
  });

  $("#reinitialiser").addEventListener("click", () => {
    try { localStorage.removeItem(CLE_STOCKAGE); } catch (err) { /* rien */ }
    initialiser();
    messages.length = 0;
    accueil();
    rendreTout();
  });

  function accueil() {
    direAssistant("Bonjour, je prépare le planning à partir de vos demandes : absences, congés, RTT, disponibilités. Je propose, vous validez.\nEssayez une phrase ci-dessous.");
  }

  // ------------------------------------------------------------------ démarrage
  if (!charger()) { initialiser(); enregistrer(); }
  $("#exemples").innerHTML = EXEMPLES.map((t) => `<button type="button" data-action="exemple" data-texte="${e(t)}">${e(t)}</button>`).join("");
  accueil();
  rendreTout();
  window.__planning = { etat: () => etat, traiterDemande };   // accès pour les tests automatisés
})();
