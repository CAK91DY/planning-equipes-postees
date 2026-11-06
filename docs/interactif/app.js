/* Planning des équipes postées — application : affichage, absences et congés, assistant, validation.
   Calcul : moteur.js. Compréhension des demandes : assistant.js. Données : donnees.js.
   Principe : tout changement passe par une PROPOSITION que le manager valide ou abandonne. */
(function () {
  "use strict";
  const M = window.MoteurPlanning;
  const A = window.AssistantPlanning;
  const CLE_STOCKAGE = "planning-postes-v2";   // v2 : équipe resserrée (17 personnes)
  const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const JOURS_LONGS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const LETTRES = ["D", "L", "M", "M", "J", "V", "S"];
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const EXEMPLES = [
    "Antoine est en arrêt du 23 au 25 décembre",
    "RTT pour Camille le 26/12",
    "Qui peut remplacer le chef de quart de nuit le 15 ?",
    "Combien de congés reste-t-il à Manon ?",
    "Quel est le planning de Damien ?",
  ];

  // ------------------------------------------------------------------ utilitaires
  const e = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const copie = (o) => JSON.parse(JSON.stringify(o));
  const nombre = (x, d = 0) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
  const jjmm = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
  const dateLongue = (iso) => `${JOURS_LONGS[M.jourSemaine(iso)]} ${Number(iso.slice(8))} ${MOIS[Number(iso.slice(5, 7)) - 1]}`;
  const dateTitre = (iso) => `${Number(iso.slice(8))} ${MOIS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
  const jourCourt = (iso) => `${JOURS_COURTS[M.jourSemaine(iso)]} ${jjmm(iso)}`;
  const $ = (sel) => document.querySelector(sel);

  let etat = null;
  let cible = null;
  const CLE_REPLIES = "planning-postes-replies";
  const ABREGE = { CHEF_QUART: "Chef", OP_TABLEAU: "Tab.", OP_EXTERIEUR: "Ext." };
  let replies = new Set();
  try { replies = new Set(JSON.parse(localStorage.getItem(CLE_REPLIES) || "[]")); } catch (err) { /* sans mémoire */ }
  const CLE_DENSITE = "planning-postes-densite";
  let densite = "compact";
  try { densite = localStorage.getItem(CLE_DENSITE) === "confortable" ? "confortable" : "compact"; } catch (err) { /* compact */ }
  const appliquerDensite = () => document.body.classList.toggle("confortable", densite === "confortable");
  const memoriserReplies = () => { try { localStorage.setItem(CLE_REPLIES, JSON.stringify([...replies])); } catch (err) { /* rien */ } };
  const messages = [];

  const collab = (id) => etat.donnees.collaborateurs.find((c) => c.id === id);
  const typeAbs = (t) => etat.donnees.types_absence[t];
  const quartTxt = (q) => `${etat.donnees.quarts[q].libelle.toLowerCase()} (${etat.donnees.quarts[q].horaire})`;
  const posteTxt = (p) => etat.donnees.postes[p].toLowerCase();
  const nomEquipe = (eq) => (eq === "VOLANT" ? "volant" : `équipe ${eq}`);
  const periode = (a) => (a.debut === a.fin ? `le ${jjmm(a.debut)}` : `du ${jjmm(a.debut)} au ${jjmm(a.fin)}`);
  const pluriel = (n, mot, motPluriel = mot + "s") => `${nombre(n)} ${n > 1 ? motPluriel : mot}`;

  // ------------------------------------------------------------------ état, enregistrement local
  function absencesValidees(liste = etat.donnees.absences) {
    return liste.filter((a) => a.statut === "validee").map((a) => ({ id: a.id, debut: a.debut, fin: a.fin }));
  }
  function initialiser() {
    const donnees = copie(DONNEES_PLANNING);                     // défini dans donnees.js
    const publie = new Map(donnees.planning_reference.map(([id, j, q, p]) => [M.cle(id, j), { q, p }]));
    delete donnees.planning_reference;
    etat = { version: 1, donnees, publie, historique: [], proposition: null, dernierCalcul: null };
    journal("Planning de référence chargé (calculé par le moteur d'optimisation OR-Tools).");
  }
  function enregistrer() {
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify(Object.assign({}, etat, { publie: [...etat.publie.entries()], proposition: null })));
    } catch (err) { /* stockage indisponible : la page fonctionne sans */ }
  }
  function charger() {
    try {
      const lu = JSON.parse(localStorage.getItem(CLE_STOCKAGE) || "null");
      if (!lu || lu.version !== 1) return false;
      etat = Object.assign(lu, { publie: new Map(lu.publie), proposition: null });
      return true;
    } catch (err) { return false; }
  }
  function journal(texte) { etat.historique.unshift({ quand: new Date().toISOString(), texte }); }

  // ------------------------------------------------------------------ calculs d'appoint
  const contexte = (absences = absencesValidees()) => M.preparer(etat.donnees, absences);
  function quartsPlanifies(id, debut, fin) {
    const liste = [];
    for (let j = debut; j <= fin; j = M.ajouterJours(j, 1)) if (etat.publie.has(M.cle(id, j))) liste.push(j);
    return liste;
  }
  // Quarts couverts par une absence : décompte enregistré, sinon quarts planifiés (demande),
  // sinon quarts prévus par le cycle (absence connue avant le calcul du planning)
  function quartsAbsence(a) {
    if (a.quarts != null) return a.quarts;
    if (a.statut !== "validee") return quartsPlanifies(a.id, a.debut, a.fin).length;
    const ctx = contexte([]);
    if (ctx.volant(a.id)) return "—";
    return ctx.jours.filter((j) => j >= a.debut && j <= a.fin && ctx.quartPrevu(a.id, j) !== M.REPOS).length;
  }
  function absenceDu(id, jour, liste, statuts) {
    return liste.find((a) => a.id === id && statuts.includes(a.statut) && a.debut <= jour && jour <= a.fin);
  }
  const chevauchement = (id, debut, fin) =>
    etat.donnees.absences.find((a) => a.id === id && a.statut !== "refusee" && a.debut <= fin && debut <= a.fin);
  const prochainNumero = () => Math.max(0, ...etat.donnees.absences.map((a) => a.num)) + 1;

  // ------------------------------------------------------------------ propositions
  function proposer({ description, actions, absencesApres, regenerer = false, donneesApres = etat.donnees }) {
    const res = regenerer ? M.generer(donneesApres, absencesApres) : M.replanifier(donneesApres, etat.publie, absencesApres);
    const anomalies = M.controler(donneesApres, res.plan, absencesApres);
    const ind = M.indicateurs(donneesApres, res.plan, absencesApres);
    const avant = M.indicateurs(etat.donnees, etat.publie, absencesValidees());
    etat.proposition = {
      description, actions, plan: res.plan, absences: absencesApres, donnees: donneesApres, duree: res.duree_ms,
      diff: M.differences(etat.publie, res.plan), anomalies, ind,
      deltaSup: ind.supplementaires - avant.supplementaires, deltaVolants: ind.volants - avant.volants,
      trous: anomalies.filter((a) => a.regle === "COUVERTURE").length,
    };
    etat.proposition.changements = regrouper(etat.proposition.diff);
    etat.dernierCalcul = res.duree_ms;
    afficherOnglet("planning");
    rendreTout();
    return etat.proposition;
  }
  // Un changement = un poste (jour, quart, poste) qui change de titulaire
  function regrouper(diff) {
    const postes = new Map();
    const ajouter = (jour, a, cote, id) => {
      const k = `${jour}|${a.q}|${a.p}`;
      if (!postes.has(k)) postes.set(k, { jour, q: a.q, p: a.p, avant: [], apres: [] });
      postes.get(k)[cote].push(id);
    };
    for (const d of diff) {
      if (d.avant) ajouter(d.jour, d.avant, "avant", d.id);
      if (d.apres) ajouter(d.jour, d.apres, "apres", d.id);
    }
    return [...postes.values()].sort((x, y) => (x.jour < y.jour ? -1 : x.jour > y.jour ? 1 : "MAN".indexOf(x.q) - "MAN".indexOf(y.q)));
  }
  const decrireNoms = (ids) => ids.map((id) => `${collab(id).nom} (${id})`).join(", ") || "personne";
  function decrireChangement(c) {
    const qui = c.avant.length && c.apres.length ? `${decrireNoms(c.avant)} → ${decrireNoms(c.apres)}`
      : c.apres.length ? `ajout : ${decrireNoms(c.apres)}` : `${decrireNoms(c.avant)} retiré, poste non pourvu`;
    return { quand: `${jourCourt(c.jour)} · ${etat.donnees.quarts[c.q].libelle}`, quoi: `${etat.donnees.postes[c.p]} : ${qui}` };
  }

  function validerProposition() {
    const p = etat.proposition;
    if (!p) return;
    etat.donnees = p.donnees;
    for (const act of p.actions) {
      if (act.type === "nouvelle_absence") { etat.donnees.absences.push(Object.assign({}, act.absence, { statut: "validee" })); decompter(act.absence); }
      if (act.type === "valider_absence") {
        const a = etat.donnees.absences.find((x) => x.num === act.num);
        if (a) { a.statut = "validee"; a.quarts = act.quarts; decompter(a); }
      }
    }
    etat.publie = p.plan;
    journal(`Publié : ${p.description} — ${pluriel(p.changements.length, "poste réaffecté", "postes réaffectés")}, ${pluriel(p.anomalies.length, "anomalie")}.`);
    etat.proposition = null;
    enregistrer();
    rendreTout();
    direAssistant("Planning publié. Pensez à prévenir les personnes dont le quart change.");
  }
  function abandonnerProposition() {
    if (!etat.proposition) return;
    journal(`Proposition abandonnée : ${etat.proposition.description}.`);
    etat.proposition = null;
    enregistrer();
    rendreTout();
  }
  // Congés payés et RTT : décomptés en quarts planifiés pendant la période
  function decompter(abs) {
    const t = typeAbs(abs.type);
    if (t && t.compteur) collab(abs.id).soldes[t.compteur] = (collab(abs.id).soldes[t.compteur] || 0) - (abs.quarts || 0);
  }

  function preparerAbsence(id, type, debut, fin, source) {
    const h = contexte([]).jours;
    if (!collab(id)) return { erreur: "Collaborateur introuvable." };
    if (!typeAbs(type)) return { erreur: "Type d'absence inconnu." };
    if (!debut || !fin || debut > fin) return { erreur: "La date de fin doit suivre la date de début." };
    if (fin < h[0] || debut > h[h.length - 1]) return { erreur: `Cette période est hors du planning (${jjmm(h[0])} au ${jjmm(h[h.length - 1])}).` };
    const deja = chevauchement(id, debut, fin);
    if (deja) return { erreur: `${collab(id).nom} a déjà une absence sur cette période (${typeAbs(deja.type).libelle.toLowerCase()} ${periode(deja)}).` };
    const quarts = quartsPlanifies(id, debut, fin).length;
    const t = typeAbs(type);
    if (t.compteur && (collab(id).soldes[t.compteur] || 0) < quarts) {
      return { erreur: `Solde insuffisant : ${collab(id).nom} dispose de ${pluriel(collab(id).soldes[t.compteur] || 0, "jour")} de ${t.libelle}, pour ${pluriel(quarts, "quart")} demandés.` };
    }
    return { absence: { num: prochainNumero(), id, type, debut, fin, statut: "en_attente", source, quarts }, quarts };
  }
  function proposerAbsence(abs) {
    const t = typeAbs(abs.type);
    return proposer({ description: `${t.libelle} de ${collab(abs.id).nom} ${periode(abs)}`,
      actions: [{ type: "nouvelle_absence", absence: abs }], absencesApres: absencesValidees().concat([abs]) });
  }
  function proposerValidationDemande(num) {
    const a = etat.donnees.absences.find((x) => x.num === num);
    const t = typeAbs(a.type);
    const quarts = quartsPlanifies(a.id, a.debut, a.fin).length;
    if (t.compteur && (collab(a.id).soldes[t.compteur] || 0) < quarts) { messageFormulaire(`Solde de ${t.libelle} insuffisant pour ${collab(a.id).nom}.`); return null; }
    return proposer({ description: `demande de ${t.libelle} de ${collab(a.id).nom} ${periode(a)}`,
      actions: [{ type: "valider_absence", num, quarts }], absencesApres: absencesValidees().concat([a]) });
  }
  function absencesApresProposition(p) {
    if (!p) return etat.donnees.absences;
    const aValider = new Set(p.actions.filter((x) => x.type === "valider_absence").map((x) => x.num));
    return etat.donnees.absences.map((a) => (aValider.has(a.num) ? Object.assign({}, a, { statut: "validee" }) : a))
      .concat(p.actions.filter((x) => x.type === "nouvelle_absence").map((x) => Object.assign({}, x.absence, { statut: "validee" })));
  }

  // ------------------------------------------------------------------ rendu
  function rendreTout() {
    const h = contexte([]).jours;
    $("#periode").textContent = `Du ${dateTitre(h[0])} au ${dateTitre(h[h.length - 1])} · cycle 5×8, 5 équipes et volants`;
    const attente = etat.donnees.absences.filter((a) => a.statut === "en_attente").length;
    $("#nb-attente").hidden = attente === 0;
    $("#nb-attente").textContent = attente;
    rendreProposition(); rendrePlanning(); rendreAbsences(); rendreEquipe(); rendreHistorique();
  }

  function rendreProposition() {
    const zone = $("#proposition");
    const p = etat.proposition;
    zone.hidden = !p;
    if (!p) { zone.innerHTML = ""; return; }
    const signe = (n) => (n > 0 ? `+${nombre(n)}` : nombre(n));
    zone.innerHTML = `
      <p class="etiquette">Proposition à valider</p>
      <h2>${e(p.description.charAt(0).toUpperCase() + p.description.slice(1))}</h2>
      <ul class="chiffres">
        <li><b>${p.changements.length}</b> ${p.changements.length > 1 ? "postes réaffectés" : "poste réaffecté"}</li>
        <li>Volants : <b>${signe(p.deltaVolants)}</b> quart(s)</li>
        <li>Quarts supplémentaires : <b>${signe(p.deltaSup)}</b></li>
        <li class="${p.trous ? "manque" : ""}">Postes non couverts : <b>${p.trous}</b></li>
        <li>Contrôle des règles : <b>${p.anomalies.length ? pluriel(p.anomalies.length, "anomalie") : "conforme"}</b></li>
        <li>Calcul : <b>${nombre(p.duree, 1)} ms</b></li>
      </ul>
      <ul class="changements">${p.changements.slice(0, 30).map((c) => { const d = decrireChangement(c); return `<li><span class="quand">${e(d.quand)}</span><span>${e(d.quoi)}</span></li>`; }).join("") || "<li><span></span><span>Aucun quart à modifier.</span></li>"}</ul>
      ${p.changements.length > 30 ? `<p class="note">… et ${p.changements.length - 30} autre(s), visibles en pointillés dans le planning.</p>` : ""}
      ${p.anomalies.length ? `<p class="message-form erreur">${e(p.anomalies.slice(0, 3).map((a) => `${a.detail}${a.jour ? " le " + jjmm(a.jour) : ""}`).join(" · "))}</p>` : ""}
      <div class="actions">
        <button type="button" class="principal" data-action="valider-prop">${p.trous ? `Publier malgré ${pluriel(p.trous, "poste non couvert", "postes non couverts")}` : "Valider et publier"}</button>
        <button type="button" class="secondaire" data-action="abandonner-prop">Abandonner</button>
      </div>`;
  }

  function rendrePlanning() {
    const p = etat.proposition;
    const plan = p ? p.plan : etat.publie;
    const absences = p ? p.absences : absencesValidees();
    const donnees = p ? p.donnees : etat.donnees;
    const ctx = M.preparer(donnees, absences);
    const ind = p ? p.ind : M.indicateurs(donnees, plan, absences);
    const anomalies = p ? p.anomalies : M.controler(donnees, plan, absences);
    const modifies = new Set(p ? p.diff.map((d) => M.cle(d.id, d.jour)) : []);
    const affichees = absencesApresProposition(p);
    const attente = etat.donnees.absences.filter((a) => a.statut === "en_attente");
    const nbAbs = affichees.filter((a) => a.statut === "validee").length;

    const kpi = (titre, valeur, detail, alerte = false) =>
      `<article class="kpi${alerte ? " alerte" : ""}"><h3>${e(titre)}</h3><p class="valeur">${e(valeur)}</p><p class="detail">${e(detail)}</p></article>`;
    const nbQuarts = Object.keys(donnees.quarts).length;
    const postesParQuart = Object.values(donnees.besoins.M).reduce((s, x) => s + x, 0);
    $("#onglet-planning").innerHTML = `
      <div class="kpis" aria-label="Indicateurs clés">
        ${kpi("Postes couverts", `${nombre(ind.couverts)} / ${nombre(ind.requis)}`, `${nbQuarts * postesParQuart} postes par jour`, ind.couverts < ind.requis)}
        ${kpi("Règles respectées", anomalies.length ? pluriel(anomalies.length, "anomalie") : "100 %", "contrôle indépendant", anomalies.length > 0)}
        ${kpi("Absences", nombre(nbAbs), `${pluriel(attente.length, "demande")} en attente`)}
        ${kpi("Remplacements", pluriel(ind.volants, "quart"), "tenus par les volants")}
        ${kpi("Quarts supplémentaires", nombre(ind.supplementaires), "sur des jours de repos")}
        ${kpi("Dernier calcul", etat.dernierCalcul == null ? "OR-Tools" : `${nombre(etat.dernierCalcul, 1)} ms`, etat.dernierCalcul == null ? "planning de départ" : "dans le navigateur")}
      </div>
      <div class="carte">
        <div class="titre-grille">
          <h2>${p ? "Planning proposé, non publié" : "Planning publié"}</h2>
          <p class="note">Cliquez sur une case pour la modifier.</p>
          <div class="outils-grille">
            <span class="groupe-boutons" role="group" aria-label="Affichage">
              <button type="button" class="secondaire petit" data-action="densite" data-valeur="compact" aria-pressed="${densite === "compact"}">Compact</button>
              <button type="button" class="secondaire petit" data-action="densite" data-valeur="confortable" aria-pressed="${densite === "confortable"}">Confortable</button>
            </span>
            <button type="button" class="secondaire petit" data-action="replier-tout">Tout replier</button>
            <button type="button" class="secondaire petit" data-action="deplier-tout">Tout déplier</button>
          </div>
        </div>
        ${!p && anomalies.length ? `<p class="message-form erreur">Le planning publié comporte ${pluriel(anomalies.length, "anomalie")}. <button type="button" class="secondaire petit" data-action="corriger">Proposer une correction</button></p>` : ""}
        <div class="defile" tabindex="0" role="region" aria-label="Planning par opérateur et par jour">
          <table class="grille"><thead><tr>${entete(ctx)}</tr></thead><tbody>${lignes(ctx, donnees, plan, ind, anomalies, modifies, affichees)}</tbody></table>
        </div>
        <ul class="legende">
          ${Object.entries(donnees.quarts).map(([q, d]) => `<li><span class="q${q}">${q}</span>${e(d.libelle)} ${e(d.horaire.replace(/ h–/, "–"))}</li>`).join("")}
          <li><span class="repos"></span>Repos</li>
          <li><span class="absence">CP</span>Absence</li>
          <li><span class="qM attente">M</span>Demande en attente</li>
          <li><span class="qM volant">M</span>Volant</li>
          <li><span class="qM sup">M</span>Quart sup.</li>
          <li><span class="qM modifie">M</span>Modifié</li>
          <li><span class="repos we"></span>Week-end</li>
          <li><span class="repos ferie"></span>Férié</li>
        </ul>
      </div>`;
  }
  function entete(ctx) {
    return `<th class="col-eq" scope="col" title="Équipe">Éq.</th><th class="col-nom" scope="col">Opérateur</th>` + ctx.jours.map((j) => {
      const js = M.jourSemaine(j);
      const ferie = (ctx.donnees.feries || []).includes(j);
      return `<th scope="col" class="${js === 0 || js === 6 ? "we" : ""}${js === 1 ? " lundi" : ""}${ferie ? " ferie" : ""}" title="${e(dateLongue(j))}${ferie ? " · jour férié" : ""}"><span>${LETTRES[js]}</span>${Number(j.slice(8))}</th>`;
    }).join("") + `<th class="col-total" scope="col" title="Quarts travaillés sur le mois, dont nuits">Quarts<br>nuits</th>`;
  }
  function lignes(ctx, donnees, plan, ind, anomalies, modifies, affichees) {
    const equipes = [...new Set(donnees.collaborateurs.map((c) => c.equipe))].sort((a, b) => (a === "VOLANT") - (b === "VOLANT") || (a < b ? -1 : 1));
    let html = "";
    for (const eq of equipes) {
      const membres = donnees.collaborateurs.filter((x) => x.equipe === eq);
      const ouvert = !replies.has(eq);
      const nomGroupe = eq === "VOLANT" ? "Volants" : `Équipe ${eq}`;
      // Colonne d'équipe : lettre + bouton pour replier ou déplier le groupe
      const bascule = `<button type="button" class="bascule" data-action="replier" data-equipe="${e(eq)}" aria-expanded="${ouvert}"
        title="${ouvert ? "Replier" : "Déplier"} : ${e(nomGroupe)}" aria-label="${ouvert ? "Replier" : "Déplier"} ${e(nomGroupe)}">${eq === "VOLANT" ? "V" : e(eq)}</button>`;
      html += `<tr class="espace"><td colspan="${ctx.jours.length + 3}"></td></tr>`;
      if (!ouvert) {
        html += `<tr class="replie"><th class="col-eq" scope="rowgroup">${bascule}</th><th class="col-nom" scope="row">${e(nomGroupe)}<small>${membres.length} pers. · replié</small></th><td colspan="${ctx.jours.length + 1}"></td></tr>`;
        continue;
      }
      membres.forEach((c, rang) => {
        const cases = ctx.jours.map((j) => {
          const js = M.jourSemaine(j);
          const lundi = (js === 1 ? " lundi" : "") + (js === 0 || js === 6 ? " we" : "") + ((donnees.feries || []).includes(j) ? " ferie" : "");
          const k = M.cle(c.id, j);
          const absV = absenceDu(c.id, j, affichees, ["validee"]);
          const absA = absV ? null : absenceDu(c.id, j, affichees, ["en_attente"]);
          const a = plan.get(k);
          let classe = "repos", texte = "", info = "Repos";
          if (absV) { classe = "absence"; texte = typeAbs(absV.type).court; info = typeAbs(absV.type).libelle; }
          else if (a) {
            const o = M.origine(ctx, c.id, j, a);
            classe = `q${a.q}` + (o === "VOLANT" ? " volant" : o === "SUPPLEMENTAIRE" ? " sup" : "");
            texte = a.q;
            info = `${donnees.quarts[a.q].libelle} ${donnees.quarts[a.q].horaire} · ${donnees.postes[a.p]}` +
              (o === "VOLANT" ? " · remplacement" : o === "SUPPLEMENTAIRE" ? " · quart supplémentaire" : o === "ECHANGE" ? " · hors cycle" : "");
          }
          if (absA) { classe += " attente"; info += ` · demande de ${typeAbs(absA.type).libelle} en attente`; }
          if (modifies.has(k)) { classe += " modifie"; info += " · modifié par la proposition"; }
          const bulle = `${c.nom} (${c.id}) · ${dateLongue(j)} · ${info}`;
          return `<td class="case ${classe}${lundi}"><button type="button" data-action="case" data-id="${c.id}" data-jour="${j}" title="${e(bulle)}" aria-label="${e(bulle)}">${e(texte)}</button></td>`;
        }).join("");
        const pp = ind.parPersonne[c.id] || { quarts: 0, nuits: 0 };
        const colEquipe = rang === 0 ? `<th class="col-eq" scope="rowgroup" rowspan="${membres.length}">${bascule}</th>` : "";
        html += `<tr>${colEquipe}<th class="col-nom" scope="row" title="${e(c.nom)} · ${e(c.id)} · ${e(donnees.postes[c.habilitations[0]])}">${e(c.nom)}<small>${e(c.id)} · ${e(ABREGE[c.habilitations[0]] || donnees.postes[c.habilitations[0]])}</small></th>${cases}<td class="col-total">${pp.quarts} · ${pp.nuits}</td></tr>`;
      });
    }
    const couverture = ctx.jours.map((j) => {
      const lundi = M.jourSemaine(j) === 1 ? " lundi" : "";
      const manque = anomalies.filter((x) => x.regle === "COUVERTURE" && x.jour === j).reduce((s, x) => {
        const m = x.detail.match(/: (\d+) sur (\d+)/); return s + Number(m[2]) - Number(m[1]);
      }, 0);
      return manque ? `<td class="manque-cellule${lundi}" title="${pluriel(manque, "poste non couvert", "postes non couverts")}">−${manque}</td>`
        : `<td class="ok${lundi}" title="Tous les postes sont couverts">✓</td>`;
    }).join("");
    return html + `<tr class="espace"><td colspan="${ctx.jours.length + 3}"></td></tr><tr class="couverture"><th class="col-eq"></th><th class="col-nom" scope="row">Postes couverts</th>${couverture}<td></td></tr>`;
  }

  function rendreAbsences() {
    const d = etat.donnees;
    const h = contexte([]).jours;
    const bloque = etat.proposition ? ' disabled title="Validez ou abandonnez d\'abord la proposition en cours"' : "";
    const attente = d.absences.filter((a) => a.statut === "en_attente");
    const ligne = (a, actions) => {
      const q = quartsAbsence(a);
      return `<tr><td>${e(collab(a.id).nom)} <small>(${e(a.id)})</small></td><td>${e(typeAbs(a.type).libelle)}</td><td>${e(periode(a))}</td>
        <td class="num">${q}</td><td><span class="statut ${a.statut}">${{ validee: "Validée", en_attente: "En attente", refusee: "Refusée" }[a.statut]}</span></td>
        <td>${e({ manager: "Manager", collaborateur: "Collaborateur", assistant: "Assistant" }[a.source] || a.source)}</td><td>${actions}</td></tr>`;
    };
    const entetes = `<tr><th>Collaborateur</th><th>Type</th><th>Période</th><th class="num">Quarts</th><th>Statut</th><th>Origine</th><th></th></tr>`;
    $("#onglet-absences").innerHTML = `
      <div class="carte">
        <h2>Déclarer une absence ou poser des congés</h2>
        <p class="note">Le planning est recalculé et présenté sous forme de proposition. Les congés payés et les RTT sont décomptés à la publication, en quarts planifiés sur la période.</p>
        <form id="form-absence" class="formulaire">
          <label>Collaborateur<select id="abs-collab">${d.collaborateurs.map((c) => `<option value="${c.id}">${e(c.nom)} — ${e(c.id)}, ${e(nomEquipe(c.equipe))}</option>`).join("")}</select></label>
          <label>Type<select id="abs-type">${Object.entries(d.types_absence).map(([k, t]) => `<option value="${k}">${e(t.libelle)}</option>`).join("")}</select></label>
          <label>Du<input id="abs-debut" type="date" min="${h[0]}" max="${h[h.length - 1]}" value="${h[0]}"></label>
          <label>Au<input id="abs-fin" type="date" min="${h[0]}" max="${h[h.length - 1]}" value="${h[0]}"></label>
        </form>
        <div class="boutons">
          <button type="submit" form="form-absence" class="principal"${bloque}>Recalculer le planning</button>
          <button type="button" class="secondaire" data-action="enregistrer-demande"${bloque}>Enregistrer comme demande</button>
        </div>
        <p id="message-absence" class="message-form" aria-live="polite"></p>
      </div>
      <div class="carte">
        <h2>Demandes en attente</h2>
        ${attente.length ? `<div class="defile"><table class="tableau"><thead>${entetes}</thead><tbody>${attente.map((a) => ligne(a,
          `<button type="button" class="principal petit" data-action="valider-abs" data-num="${a.num}"${bloque}>Étudier</button>
           <button type="button" class="danger petit" data-action="refuser-abs" data-num="${a.num}"${bloque}>Refuser</button>`)).join("")}</tbody></table></div>`
          : `<p class="note">Aucune demande en attente.</p>`}
      </div>
      <div class="carte">
        <h2>Compteurs</h2>
        <div class="defile"><table class="tableau"><thead><tr><th>Collaborateur</th><th>Équipe</th><th class="num">Congés payés</th><th class="num">RTT</th><th class="num">En attente</th></tr></thead>
        <tbody>${d.collaborateurs.map((c) => {
          const enAttente = attente.filter((a) => a.id === c.id).reduce((s, a) => s + quartsPlanifies(a.id, a.debut, a.fin).length, 0);
          return `<tr><td>${e(c.nom)} <small>(${e(c.id)})</small></td><td>${e(nomEquipe(c.equipe))}</td><td class="num">${nombre(c.soldes.CP || 0)} j</td><td class="num">${nombre(c.soldes.RTT || 0)} j</td><td class="num">${enAttente ? enAttente + " q." : "—"}</td></tr>`;
        }).join("")}</tbody></table></div>
      </div>
      <div class="carte">
        <h2>Toutes les absences</h2>
        <div class="defile"><table class="tableau"><thead>${entetes}</thead>
        <tbody>${d.absences.slice().sort((x, y) => (x.debut < y.debut ? -1 : 1)).map((a) => ligne(a, "")).join("")}</tbody></table></div>
      </div>`;
  }

  function rendreEquipe() {
    const d = etat.donnees;
    const bloque = etat.proposition ? ' disabled title="Validez ou abandonnez d\'abord la proposition en cours"' : "";
    const postes = Object.keys(d.postes);
    $("#onglet-equipe").innerHTML = `
      <div class="carte">
        <h2>Effectif requis par quart</h2>
        <p class="note">Chaque quart doit être tenu par ces effectifs, 7 jours sur 7.</p>
        <div class="defile"><table class="tableau"><thead><tr><th>Poste</th>${Object.entries(d.quarts).map(([q, x]) => `<th class="num">${e(x.libelle)} (${e(x.horaire)})</th>`).join("")}</tr></thead><tbody>
        ${postes.map((p) => `<tr><td>${e(d.postes[p])}</td>${Object.keys(d.quarts).map((q) => `<td class="num"><input type="number" min="0" max="6" id="b-${q}-${p}" value="${d.besoins[q][p] || 0}" aria-label="${e(d.postes[p])}, ${e(d.quarts[q].libelle)}"></td>`).join("")}</tr>`).join("")}
        </tbody></table></div>
      </div>
      <div class="carte">
        <h2>Habilitations</h2>
        <p class="note">Le premier poste est le poste habituel. Un volant n'a pas de cycle : il est mobilisé pour remplacer.</p>
        <div class="defile"><table class="tableau"><thead><tr><th>Collaborateur</th><th>Équipe</th>${postes.map((p) => `<th>${e(d.postes[p])}</th>`).join("")}</tr></thead><tbody>
        ${d.collaborateurs.map((c) => `<tr><td>${e(c.nom)} <small>(${e(c.id)})</small></td><td>${e(nomEquipe(c.equipe))}</td>
          ${postes.map((p) => `<td><input type="checkbox" id="h-${c.id}-${p}" ${c.habilitations.includes(p) ? "checked" : ""} aria-label="${e(c.nom)} habilité ${e(d.postes[p])}"></td>`).join("")}</tr>`).join("")}
        </tbody></table></div>
        <div class="boutons"><button type="button" class="principal" data-action="generer-regles"${bloque}>Recalculer tout le planning avec ces règles</button></div>
        <p id="message-equipe" class="message-form" aria-live="polite"></p>
      </div>
      <div class="carte">
        <h2>Règles garanties</h2>
        <ul class="regles">
          <li>Cycle 5×8 : ${e(d.cycle.motif.join(" "))} (R = repos), décalé de 2 jours d'une équipe à l'autre.</li>
          <li>${d.regles.repos_min_heures} h de repos minimum entre deux quarts : jamais d'après-midi ou de nuit suivi d'un matin, ni de nuit suivie d'un après-midi.</li>
          <li>${d.regles.max_jours_consecutifs} jours et ${d.regles.max_nuits_consecutives} nuits de suite au maximum ; ${d.regles.max_quarts_horizon} quarts au maximum sur ${contexte([]).jours.length} jours.</li>
          <li>Chacun ne tient que les postes pour lesquels il est habilité ; personne n'est planifié pendant une absence validée.</li>
          <li>Remplacements : un volant d'abord, puis un échange entre collègues du même quart, puis un quart supplémentaire en dernier recours.</li>
          <li>Les demandes de repos sont respectées autant que possible.</li>
        </ul>
      </div>`;
  }

  function rendreHistorique() {
    $("#onglet-historique").innerHTML = `<div class="carte"><h2>Historique des décisions</h2>
      <ul class="historique">${etat.historique.map((h) => {
        const d = new Date(h.quand);
        return `<li><time datetime="${h.quand}">${d.toLocaleDateString("fr-FR")} · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time><span>${e(h.texte)}</span></li>`;
      }).join("")}</ul></div>`;
  }

  function afficherOnglet(nom) {
    document.querySelectorAll(".onglets button").forEach((b) => b.setAttribute("aria-selected", b.dataset.onglet === nom ? "true" : "false"));
    document.querySelectorAll(".onglet").forEach((s) => { s.hidden = s.id !== `onglet-${nom}`; });
  }
  function messageFormulaire(texte, classe = "erreur") {
    const zone = $("#message-absence");
    if (zone) { zone.textContent = texte; zone.className = `message-form ${classe}`; }
  }

  // ------------------------------------------------------------------ fenêtre d'une case
  function ouvrirCase(id, jour) {
    const c = collab(id);
    cible = { id, jour };
    $("#fenetre-titre").textContent = `${c.nom} (${c.id}) — ${dateLongue(jour)}`;
    if (etat.proposition) {
      $("#fenetre-corps").innerHTML = `<p>Une proposition est en attente. Validez-la ou abandonnez-la avant de modifier le planning.</p>`;
    } else {
      const a = etat.publie.get(M.cle(id, jour));
      const abs = absenceDu(id, jour, etat.donnees.absences, ["validee"]);
      const actuel = abs ? `${typeAbs(abs.type).libelle} ${periode(abs)}` : a ? `${quartTxt(a.q)}, ${posteTxt(a.p)}` : "repos";
      $("#fenetre-corps").innerHTML = abs
        ? `<p>Actuellement : <b>${e(actuel)}</b>.</p><p class="note">Pour modifier cette absence, passez par l'onglet « Absences et congés ».</p>`
        : `<p>Actuellement : <b>${e(actuel)}</b>.</p>
          <p class="note">Changer le quart de ce jour. La modification est vérifiée par le contrôle des règles.</p>
          <div class="choix">${Object.keys(etat.donnees.quarts).flatMap((q) => c.habilitations.map((p) =>
            `<button type="button" class="secondaire petit" data-action="affecter" data-q="${q}" data-p="${p}">${e(etat.donnees.quarts[q].libelle)} · ${e(etat.donnees.postes[p])}</button>`)).join("")}
            <button type="button" class="secondaire petit" data-action="affecter-repos">Repos</button></div>
          <p class="note">Ou déclarer une absence ce jour-là :</p>
          <div class="choix"><select id="fenetre-type" aria-label="Type d'absence">${Object.entries(etat.donnees.types_absence).map(([k, t]) => `<option value="${k}">${e(t.libelle)}</option>`).join("")}</select>
            <button type="button" class="principal petit" data-action="absence-jour">Recalculer</button></div>
          <p id="fenetre-message" class="message-form erreur"></p>`;
    }
    $("#fenetre").showModal();
  }
  function affecterManuellement(q, p) {
    const k = M.cle(cible.id, cible.jour);
    const avant = etat.publie.get(k);
    if (q) etat.publie.set(k, { q, p }); else etat.publie.delete(k);
    const anomalies = M.controler(etat.donnees, etat.publie, absencesValidees());
    journal(`Modification manuelle : ${collab(cible.id).nom} le ${jjmm(cible.jour)}, ${avant ? `${etat.donnees.quarts[avant.q].libelle.toLowerCase()} ${posteTxt(avant.p)}` : "repos"} → ${q ? `${etat.donnees.quarts[q].libelle.toLowerCase()} ${posteTxt(p)}` : "repos"}${anomalies.length ? ` (${pluriel(anomalies.length, "anomalie")} à corriger)` : ""}.`);
    enregistrer();
    $("#fenetre").close();
    rendreTout();
    if (anomalies.length) direAssistant(`Attention : cette modification crée ${pluriel(anomalies.length, "anomalie")} (${anomalies[0].detail}${anomalies[0].jour ? " le " + jjmm(anomalies[0].jour) : ""}). Le bouton « Proposer une correction » prépare un recalcul.`);
  }

  // ------------------------------------------------------------------ assistant
  function direAssistant(texte, actions = []) { messages.push({ qui: "assistant", texte, actions }); rendreMessages(); }
  function rendreMessages() {
    const zone = $("#messages");
    zone.innerHTML = messages.map((m, i) => `<div class="bulle ${m.qui === "manager" ? "manager" : "assistant-msg"}">${e(m.texte)}${
      m.actions.length && i === messages.length - 1 && etat.proposition
        ? `<div class="actions">${m.actions.map((a) => `<button type="button" class="${a.style || "secondaire"} petit" data-action="${a.action}">${e(a.libelle)}</button>`).join("")}</div>` : ""}</div>`).join("");
    zone.scrollTop = zone.scrollHeight;
  }
  const BOUTONS = [{ action: "valider-prop", libelle: "Valider et publier", style: "principal" }, { action: "abandonner-prop", libelle: "Abandonner" }];

  function resumer(p) {
    const lignes = p.changements.slice(0, 6).map((c) => { const d = decrireChangement(c); return `• ${d.quand} — ${d.quoi}`; });
    if (p.changements.length > 6) lignes.push(`• … et ${p.changements.length - 6} autre(s)`);
    return `${pluriel(p.changements.length, "poste réaffecté", "postes réaffectés")} :\n${lignes.join("\n") || "• aucun quart à modifier"}\n` +
      `Quarts supplémentaires : ${p.deltaSup > 0 ? "+" : ""}${p.deltaSup} · postes non couverts : ${p.trous} · calcul en ${nombre(p.duree, 1)} ms.\n` +
      (p.anomalies.length ? "Le contrôle signale des points à traiter avant publication." : "Toutes les règles sont respectées.");
  }

  function traiterDemande(texte) {
    messages.push({ qui: "manager", texte, actions: [] });
    const it = A.interpreter(texte, etat.donnees);
    const h = contexte([]).jours;
    if (["absence", "generer"].includes(it.type) && etat.proposition) {
      direAssistant("Une proposition est déjà en attente. Validez-la ou abandonnez-la d'abord.", BOUTONS);
      return;
    }
    switch (it.type) {
      case "absence": {
        const t = typeAbs(it.absenceType), c = collab(it.id);
        const prep = preparerAbsence(it.id, it.absenceType, it.debut, it.fin, "assistant");
        if (prep.erreur) { direAssistant(prep.erreur); return; }
        if (prep.quarts === 0) { direAssistant(`${c.nom} n'a aucun quart prévu ${periode(prep.absence)} : le planning ne change pas${t.compteur ? " et rien n'est décompté" : ""}.`); return; }
        const p = proposerAbsence(prep.absence);
        const libelle = t.libelle === t.libelle.toUpperCase() ? t.libelle : t.libelle.toLowerCase();
        const solde = t.compteur ? `\nDécompte : ${pluriel(prep.quarts, "quart")} ; solde de ${t.libelle} après validation : ${nombre(c.soldes[t.compteur] - prep.quarts)} j.` : "";
        const conseil = p.trous && t.sur_demande ? `\n\nAccorder cette demande laisserait ${pluriel(p.trous, "poste non couvert", "postes non couverts")}. Mieux vaut proposer une autre date.` : "";
        direAssistant(`${c.nom} (${c.id}, ${nomEquipe(c.equipe)}) : ${libelle} ${periode(prep.absence)}, soit ${pluriel(prep.quarts, "quart")} à remplacer.${solde}\n\n${resumer(p)}${conseil}`, BOUTONS);
        return;
      }
      case "disponibles": {
        const ctx = contexte();
        const quarts = it.quart ? [it.quart] : Object.keys(etat.donnees.quarts);
        const postes = it.poste ? [it.poste] : Object.keys(etat.donnees.postes);
        const lignesDispo = [];
        for (const c of etat.donnees.collaborateurs) {
          if (ctx.absent(c.id, it.jour) || etat.publie.has(M.cle(c.id, it.jour))) continue;
          const possibles = quarts.filter((q) => postes.some((p) => c.habilitations.includes(p) && peutPrendre(c.id, it.jour, q, p)));
          if (!possibles.length) continue;
          const statut = ctx.volant(c.id) ? "volant" : ctx.quartPrevu(c.id, it.jour) === "R" ? "repos du cycle : quart supplémentaire" : "disponible";
          lignesDispo.push(`• ${c.nom} (${c.id}, ${nomEquipe(c.equipe)}) — ${statut} ; possible : ${possibles.map((q) => etat.donnees.quarts[q].libelle.toLowerCase()).join(", ")}`);
        }
        const cadre = `${it.poste ? etat.donnees.postes[it.poste].toLowerCase() : "tout poste"}${it.quart ? `, ${quartTxt(it.quart)}` : ""}`;
        direAssistant(lignesDispo.length
          ? `Personnes qui peuvent prendre ce quart le ${dateLongue(it.jour)} (${cadre}), dans le respect des règles de repos :\n${lignesDispo.join("\n")}`
          : `Personne ne peut prendre ce quart le ${dateLongue(it.jour)} (${cadre}) sans enfreindre une règle de repos ou d'habilitation.`);
        return;
      }
      case "solde": {
        const c = collab(it.id);
        const attente = etat.donnees.absences.filter((a) => a.id === c.id && a.statut === "en_attente");
        direAssistant(`${c.nom} (${c.id}) : ${pluriel(c.soldes.CP || 0, "jour")} de congés payés et ${pluriel(c.soldes.RTT || 0, "jour")} de RTT restants.` +
          (attente.length ? `\nEn attente : ${attente.map((a) => `${typeAbs(a.type).libelle} ${periode(a)}`).join(", ")}.` : ""));
        return;
      }
      case "planning_personne": {
        const c = collab(it.id);
        const ctx = contexte();
        const semaines = [];
        for (let i = 0; i < ctx.jours.length; i += 7) {
          const jours = ctx.jours.slice(i, i + 7);
          const txt = jours.map((j) => {
            const a = etat.publie.get(M.cle(c.id, j));
            const abs = absenceDu(c.id, j, etat.donnees.absences, ["validee"]);
            return abs ? `${JOURS_COURTS[M.jourSemaine(j)]} ${Number(j.slice(8))} ${typeAbs(abs.type).court}` : a ? `${JOURS_COURTS[M.jourSemaine(j)]} ${Number(j.slice(8))} ${a.q}` : null;
          }).filter(Boolean);
          semaines.push(`Semaine du ${jjmm(jours[0])} : ${txt.join(", ") || "repos"}`);
        }
        direAssistant(`Planning de ${c.nom} (${c.id}, ${nomEquipe(c.equipe)}) — M matin, A après-midi, N nuit :\n${semaines.join("\n")}`);
        return;
      }
      case "generer": {
        const p = proposer({ description: "nouveau planning calculé à partir du cycle et des règles", actions: [], absencesApres: absencesValidees(), regenerer: true });
        direAssistant(`Nouveau planning calculé à partir du cycle 5×8, des règles et des absences validées.\n${resumer(p)}`, BOUTONS);
        return;
      }
      default: {
        const debut = { personne: "De quel collaborateur s'agit-il ? Indiquez son prénom ou son matricule.",
          date: `Pour quelle date ? Par exemple « du 23 au 25 décembre » ou « le 26/12 » (planning du ${jjmm(h[0])} au ${jjmm(h[h.length - 1])}).` }[it.raison]
          || "Voici ce que je sais traiter :";
        direAssistant(`${debut}\n• Antoine est en arrêt du 23 au 25 décembre\n• RTT pour Camille le 26/12\n• Qui peut remplacer le chef de quart de nuit le 15 ?\n• Combien de congés reste-t-il à Manon ?\n• Quel est le planning de Damien ?\n• Recalcule le planning`);
      }
    }
  }
  // Vérifie qu'une personne peut prendre ce quart sans enfreindre de règle (repos, séries, plafond)
  function peutPrendre(id, jour, q, p) {
    const essai = new Map(etat.publie);
    essai.set(M.cle(id, jour), { q, p });
    return !M.controler(etat.donnees, essai, absencesValidees()).some((a) => a.id === id);
  }

  // ------------------------------------------------------------------ actions
  function lireRegles() {
    const d = copie(etat.donnees);
    for (const q of Object.keys(d.quarts)) for (const p of Object.keys(d.postes)) {
      const v = Number($(`#b-${q}-${p}`).value);
      if (!Number.isInteger(v) || v < 0 || v > 6) return { erreur: "Les effectifs requis doivent être des nombres entiers entre 0 et 6." };
      d.besoins[q][p] = v;
    }
    for (const c of d.collaborateurs) {
      const coches = Object.keys(d.postes).filter((p) => $(`#h-${c.id}-${p}`).checked);
      if (!coches.length) return { erreur: `${c.nom} doit être habilité à au moins un poste.` };
      const principal = coches.includes(c.habilitations[0]) ? c.habilitations[0] : coches[0];
      c.habilitations = [principal].concat(coches.filter((p) => p !== principal));
    }
    return { donnees: d };
  }

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-action], [data-onglet]");
    if (!el) return;
    if (el.dataset.onglet) { afficherOnglet(el.dataset.onglet); return; }
    switch (el.dataset.action) {
      case "case": ouvrirCase(el.dataset.id, el.dataset.jour); break;
      case "replier": {
        const eq = el.dataset.equipe;
        if (replies.has(eq)) replies.delete(eq); else replies.add(eq);
        memoriserReplies(); rendrePlanning();
        break;
      }
      case "densite":
        densite = el.dataset.valeur === "confortable" ? "confortable" : "compact";
        try { localStorage.setItem(CLE_DENSITE, densite); } catch (err) { /* rien */ }
        appliquerDensite(); rendrePlanning();
        break;
      case "replier-tout": etat.donnees.collaborateurs.forEach((c) => replies.add(c.equipe)); memoriserReplies(); rendrePlanning(); break;
      case "deplier-tout": replies.clear(); memoriserReplies(); rendrePlanning(); break;
      case "valider-prop": validerProposition(); break;
      case "abandonner-prop": abandonnerProposition(); direAssistant("Proposition abandonnée : le planning publié reste inchangé."); break;
      case "corriger": {
        const p = proposer({ description: "correction du planning publié", actions: [], absencesApres: absencesValidees() });
        direAssistant(`Correction préparée.\n${resumer(p)}`, BOUTONS);
        break;
      }
      case "valider-abs": {
        const p = proposerValidationDemande(Number(el.dataset.num));
        if (p) direAssistant(`Étude de la ${p.description}.\n${resumer(p)}`, BOUTONS);
        break;
      }
      case "refuser-abs": {
        const a = etat.donnees.absences.find((x) => x.num === Number(el.dataset.num));
        a.statut = "refusee";
        journal(`Demande refusée : ${typeAbs(a.type).libelle} de ${collab(a.id).nom} ${periode(a)}.`);
        enregistrer(); rendreTout(); afficherOnglet("absences");
        break;
      }
      case "enregistrer-demande": {
        const prep = preparerAbsence($("#abs-collab").value, $("#abs-type").value, $("#abs-debut").value, $("#abs-fin").value, "manager");
        if (prep.erreur) { messageFormulaire(prep.erreur); break; }
        etat.donnees.absences.push(prep.absence);
        journal(`Demande enregistrée : ${typeAbs(prep.absence.type).libelle} de ${collab(prep.absence.id).nom} ${periode(prep.absence)}.`);
        enregistrer(); rendreTout(); afficherOnglet("absences");
        messageFormulaire("Demande enregistrée : elle figure dans les demandes en attente.", "succes");
        break;
      }
      case "affecter": affecterManuellement(el.dataset.q, el.dataset.p); break;
      case "affecter-repos": affecterManuellement(null, null); break;
      case "absence-jour": {
        const prep = preparerAbsence(cible.id, $("#fenetre-type").value, cible.jour, cible.jour, "manager");
        if (prep.erreur) { $("#fenetre-message").textContent = prep.erreur; break; }
        $("#fenetre").close();
        const p = proposerAbsence(prep.absence);
        direAssistant(`Absence déclarée depuis le planning.\n${resumer(p)}`, BOUTONS);
        break;
      }
      case "generer-regles": {
        const lu = lireRegles();
        if (lu.erreur) { $("#message-equipe").textContent = lu.erreur; $("#message-equipe").className = "message-form erreur"; break; }
        const p = proposer({ description: "nouveau planning calculé avec les règles modifiées", actions: [], absencesApres: absencesValidees(), regenerer: true, donneesApres: lu.donnees });
        direAssistant(`Nouveau planning calculé avec vos règles.\n${resumer(p)}`, BOUTONS);
        break;
      }
      case "exemple": $("#question").value = el.dataset.texte; $("#question").focus(); break;
      default: break;
    }
  });

  function envoyer() {
    const texte = $("#question").value.trim();
    if (!texte) return;
    $("#question").value = "";
    traiterDemande(texte);
  }
  document.addEventListener("submit", (ev) => {
    if (ev.target.id === "form-assistant") { ev.preventDefault(); envoyer(); return; }
    if (ev.target.id === "form-absence") {
      ev.preventDefault();
      const prep = preparerAbsence($("#abs-collab").value, $("#abs-type").value, $("#abs-debut").value, $("#abs-fin").value, "manager");
      if (prep.erreur) { messageFormulaire(prep.erreur); return; }
      if (prep.quarts === 0) { messageFormulaire(`${collab(prep.absence.id).nom} n'a aucun quart prévu sur cette période : rien à recalculer.`, ""); return; }
      const p = proposerAbsence(prep.absence);
      direAssistant(`Absence saisie dans le formulaire.\n${resumer(p)}`, BOUTONS);
    }
  });
  $("#question").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); envoyer(); }
  });
  $("#reinitialiser").addEventListener("click", () => {
    try { localStorage.removeItem(CLE_STOCKAGE); } catch (err) { /* rien */ }
    initialiser(); messages.length = 0; accueil(); rendreTout(); afficherOnglet("planning");
  });

  function accueil() {
    direAssistant("Bonjour. Indiquez une absence, un congé ou un remplacement : je prépare une proposition conforme aux règles, que vous validez.");
  }

  // ------------------------------------------------------------------ démarrage
  if (!charger()) { initialiser(); enregistrer(); }
  $("#exemples").innerHTML = EXEMPLES.map((t) => `<button type="button" data-action="exemple" data-texte="${e(t)}">${e(t)}</button>`).join("");
  appliquerDensite();
  accueil();
  rendreTout();
  window.__planning = { etat: () => etat, traiterDemande };
})();
