/* Moteur de planification des équipes postées (5×8), exécuté dans le navigateur, sans dépendance.

   Rôle : recalculer en quelques millisecondes le planning publié quand une absence arrive,
   en modifiant le moins possible ce qui a déjà été annoncé aux équipes. Le planning de départ est
   celui calculé par le moteur de référence OR-Tools (output/planning.csv).

   Règles DURES (identiques au moteur OR-Tools) :
     habilitation au poste ; aucune affectation pendant une absence ; un quart par jour ;
     11 h de repos entre deux quarts (interdits : A→M, N→M, N→A) ; 6 jours et 3 nuits de suite
     au maximum ; plafond de quarts sur l'horizon. Les jours précédant l'horizon suivent le cycle.

   Pour chaque poste à pourvoir, le moteur choisit au moindre coût :
     1. un volant habilité (charge et nuits réparties équitablement) ;
     2. un échange en chaîne (un collègue du même quart change de poste, un autre reprend le sien) ;
     3. un titulaire sur un jour de repos du cycle (quart supplémentaire) ;
     4. si la seule personne possible a atteint son plafond de quarts : un de ses autres quarts est
        confié à quelqu'un d'autre pour lui libérer de la place ;
     sinon le poste est signalé non couvert, jamais caché.
   Un contrôle indépendant revérifie ensuite toutes les règles. */
(function (global) {
  "use strict";

  const QUARTS = ["M", "A", "N"];
  const REPOS = "R";

  // ------------------------------------------------------------------ dates (UTC, sans fuseau)
  function versDate(iso) { const [a, m, j] = iso.split("-").map(Number); return new Date(Date.UTC(a, m - 1, j)); }
  function ajouterJours(iso, n) { const d = versDate(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  const jourSemaine = (iso) => versDate(iso).getUTCDay();
  const ecart = (a, b) => Math.round((versDate(b) - versDate(a)) / 86400000);
  const cle = (id, jour) => `${id}|${jour}`;

  // ------------------------------------------------------------------ contexte
  function preparer(donnees, absences) {
    const jours = [];
    for (let i = 0; i < donnees.horizon.nb_jours; i++) jours.push(ajouterJours(donnees.horizon.debut, i));
    const dansHorizon = new Set(jours);
    const collab = Object.fromEntries(donnees.collaborateurs.map((c) => [c.id, c]));
    const joursAbsence = new Set();
    for (const a of absences) for (let j = a.debut; j <= a.fin; j = ajouterJours(j, 1)) joursAbsence.add(cle(a.id, j));
    const demandes = new Set(donnees.demandes_repos.map((d) => cle(d.id, d.jour)));
    const interdites = new Set(donnees.transitions_interdites.map(([a, b]) => a + b));
    const cyc = donnees.cycle;

    function quartPrevu(id, jour) {
      const eq = collab[id].equipe;
      if (!(eq in cyc.decalage_equipes)) return REPOS;                 // volants : pas de cycle
      const n = cyc.motif.length;
      const idx = (((ecart(cyc.date_reference, jour) + cyc.decalage_equipes[eq]) % n) + n) % n;
      return cyc.motif[idx];
    }
    return {
      donnees, jours, dansHorizon, collab, quartPrevu,
      volant: (id) => !(collab[id].equipe in cyc.decalage_equipes),
      absent: (id, j) => joursAbsence.has(cle(id, j)),
      demande: (id, j) => demandes.has(cle(id, j)),
      interdit: (q1, q2) => interdites.has(q1 + q2),
      besoin: (q, p) => (donnees.besoins[q] && donnees.besoins[q][p]) || 0,
    };
  }

  // Quart tenu un jour donné : dans l'horizon, le planning ; avant l'horizon, le cycle
  function quartLe(ctx, plan, id, jour) {
    if (ctx.dansHorizon.has(jour)) { const a = plan.get(cle(id, jour)); return a ? a.q : REPOS; }
    if (jour < ctx.jours[0]) return ctx.quartPrevu(id, jour);
    return REPOS;                                                         // après l'horizon : inconnu
  }
  function serie(ctx, plan, id, jour, test) {
    // longueur de la série de jours satisfaisant `test` si l'on ajoute `jour`
    let n = 1;
    for (let j = ajouterJours(jour, -1), k = 0; k < 10 && test(quartLe(ctx, plan, id, j)); j = ajouterJours(j, -1), k++) n++;
    for (let j = ajouterJours(jour, 1), k = 0; k < 10 && ctx.dansHorizon.has(j) && test(quartLe(ctx, plan, id, j)); j = ajouterJours(j, 1), k++) n++;
    return n;
  }
  function nbQuarts(plan, id) { let n = 0; for (const k of plan.keys()) if (k.startsWith(id + "|")) n++; return n; }
  function nbNuits(plan, id) { let n = 0; for (const [k, a] of plan) if (k.startsWith(id + "|") && a.q === "N") n++; return n; }
  function effectif(ctx, plan, jour, q, p) {
    let n = 0;
    for (const c of ctx.donnees.collaborateurs) { const a = plan.get(cle(c.id, jour)); if (a && a.q === q && a.p === p) n++; }
    return n;
  }

  // ------------------------------------------------------------------ faisabilité et coût d'une affectation
  function peutTravailler(ctx, plan, id, jour, q, p, ignorerPlafond = false) {
    const R = ctx.donnees.regles;
    const c = ctx.collab[id];
    if (!c.habilitations.includes(p) || ctx.absent(id, jour) || plan.has(cle(id, jour))) return false;
    const avant = quartLe(ctx, plan, id, ajouterJours(jour, -1));
    const apres = quartLe(ctx, plan, id, ajouterJours(jour, 1));
    if (avant !== REPOS && ctx.interdit(avant, q)) return false;              // repos de 11 h
    if (apres !== REPOS && ctx.interdit(q, apres)) return false;
    if (serie(ctx, plan, id, jour, (x) => x !== REPOS) > R.max_jours_consecutifs) return false;
    if (q === "N" && serie(ctx, plan, id, jour, (x) => x === "N") > R.max_nuits_consecutives) return false;
    if (!ignorerPlafond && nbQuarts(plan, id) + 1 > R.max_quarts_horizon) return false;
    return true;
  }
  function cout(ctx, plan, id, jour, q, p) {
    const c = ctx.collab[id];
    let v;
    if (ctx.volant(id)) v = 10 + 2 * nbQuarts(plan, id) + (q === "N" ? 3 * nbNuits(plan, id) : 0);   // équité des volants
    else v = ctx.quartPrevu(id, jour) === REPOS ? 100 : 30;                  // quart supplémentaire / hors cycle
    if (ctx.demande(id, jour)) v += 40;                                       // demande de repos
    if (c.habilitations[0] !== p) v += 2;                                     // poste différent de l'habituel
    return v;
  }
  function meilleurCandidat(ctx, plan, jour, q, p, exclu = null) {
    let meilleur = null;
    for (const c of ctx.donnees.collaborateurs) {
      if (c.id === exclu || !peutTravailler(ctx, plan, c.id, jour, q, p)) continue;
      const v = cout(ctx, plan, c.id, jour, q, p);
      if (!meilleur || v < meilleur.cout) meilleur = { id: c.id, cout: v };
    }
    return meilleur;
  }

  // Couvre UN poste manquant (jour, quart q, poste p). Renvoie true si c'est fait.
  function combler(ctx, plan, jour, q, p) {
    const direct = meilleurCandidat(ctx, plan, jour, q, p);
    let chaine = null;
    for (const c of ctx.donnees.collaborateurs) {                             // échange en chaîne, même quart
      const a = plan.get(cle(c.id, jour));
      if (!a || a.q !== q || a.p === p || !c.habilitations.includes(p)) continue;
      if (effectif(ctx, plan, jour, a.q, a.p) > ctx.besoin(a.q, a.p)) {       // son poste est en surnombre
        const v = 1;
        if (!chaine || v < chaine.cout) chaine = { cout: v, x: c.id, ancien: a, y: null };
        continue;
      }
      plan.delete(cle(c.id, jour));
      const remplacant = meilleurCandidat(ctx, plan, jour, a.q, a.p, c.id);
      plan.set(cle(c.id, jour), a);
      if (remplacant && (!chaine || remplacant.cout + 2 < chaine.cout)) chaine = { cout: remplacant.cout + 2, x: c.id, ancien: a, y: remplacant.id };
    }
    if (direct && (!chaine || direct.cout <= chaine.cout)) { plan.set(cle(direct.id, jour), { q, p }); return true; }
    if (chaine) {
      plan.set(cle(chaine.x, jour), { q, p });
      if (chaine.y) plan.set(cle(chaine.y, jour), chaine.ancien);
      return true;
    }
    return libererPlafond(ctx, plan, jour, q, p);
  }

  /* Dernière manœuvre avant de déclarer un poste non couvert : une personne habilitée ne peut pas
     prendre ce quart uniquement parce qu'elle a atteint le plafond de quarts sur l'horizon.
     On confie alors un de ses autres quarts à quelqu'un d'autre pour lui libérer de la place. */
  function libererPlafond(ctx, plan, jour, q, p) {
    let meilleur = null;
    for (const c of ctx.donnees.collaborateurs) {
      if (!peutTravailler(ctx, plan, c.id, jour, q, p, true) || peutTravailler(ctx, plan, c.id, jour, q, p)) continue;
      for (const [k, a] of [...plan.entries()]) {
        if (!k.startsWith(c.id + "|")) continue;
        const autreJour = k.split("|")[1];
        plan.delete(k);
        const remplacant = meilleurCandidat(ctx, plan, autreJour, a.q, a.p, c.id);
        if (remplacant) {
          plan.set(cle(remplacant.id, autreJour), a);
          const possible = peutTravailler(ctx, plan, c.id, jour, q, p);
          const v = cout(ctx, plan, c.id, jour, q, p) + remplacant.cout + 5;
          plan.delete(cle(remplacant.id, autreJour));
          if (possible && (!meilleur || v < meilleur.cout)) meilleur = { cout: v, id: c.id, k, a, autreJour, y: remplacant.id };
        }
        plan.set(k, a);
      }
    }
    if (!meilleur) return false;
    plan.delete(meilleur.k);
    plan.set(cle(meilleur.y, meilleur.autreJour), meilleur.a);
    plan.set(cle(meilleur.id, jour), { q, p });
    return true;
  }

  function comblerTout(ctx, plan) {
    const trous = [];
    for (const jour of ctx.jours) for (const q of QUARTS) for (const p of Object.keys(ctx.donnees.besoins[q])) {
      while (effectif(ctx, plan, jour, q, p) < ctx.besoin(q, p)) {
        if (combler(ctx, plan, jour, q, p)) continue;
        trous.push({ jour, q, p, manquants: ctx.besoin(q, p) - effectif(ctx, plan, jour, q, p) });
        break;
      }
    }
    return trous;
  }

  // ------------------------------------------------------------------ génération et replanification
  function generer(donnees, absences) {
    const t0 = maintenant();
    const ctx = preparer(donnees, absences);
    const plan = new Map();
    for (const jour of ctx.jours) {                                           // 1. chacun suit son cycle
      for (const c of donnees.collaborateurs) {
        const q = ctx.quartPrevu(c.id, jour);
        if (q !== REPOS && peutTravailler(ctx, plan, c.id, jour, q, c.habilitations[0])) plan.set(cle(c.id, jour), { q, p: c.habilitations[0] });
      }
    }
    const trous = comblerTout(ctx, plan);                                     // 2. remplacements
    return { plan, trous, duree_ms: maintenant() - t0 };
  }
  function replanifier(donnees, publie, absences) {
    const t0 = maintenant();
    const ctx = preparer(donnees, absences);
    const plan = new Map(publie);
    for (const k of [...plan.keys()]) { const [id, jour] = k.split("|"); if (ctx.absent(id, jour)) plan.delete(k); }
    const trous = comblerTout(ctx, plan);
    return { plan, trous, duree_ms: maintenant() - t0 };
  }

  // ------------------------------------------------------------------ contrôle indépendant
  function controler(donnees, plan, absences) {
    const ctx = preparer(donnees, absences);
    const R = donnees.regles;
    const anomalies = [];
    const ano = (regle, detail, id = "", jour = "") => anomalies.push({ regle, detail, id, jour });
    for (const [k, a] of plan) {
      const [id, jour] = k.split("|");
      const c = ctx.collab[id];
      if (!c) { ano("COLLABORATEUR", "matricule inconnu", id, jour); continue; }
      if (!QUARTS.includes(a.q)) ano("QUART", `quart inconnu ${a.q}`, id, jour);
      if (!c.habilitations.includes(a.p)) ano("HABILITATION", `non habilité au poste ${a.p}`, id, jour);
      if (ctx.absent(id, jour)) ano("ABSENCE", "affecté pendant une absence", id, jour);
    }
    for (const c of donnees.collaborateurs) {
      let prec = quartLe(ctx, plan, c.id, ajouterJours(ctx.jours[0], -1));
      let jours = 0, nuits = 0;
      for (let k = 1; k <= 10; k++) {                                          // historique avant l'horizon
        const x = quartLe(ctx, plan, c.id, ajouterJours(ctx.jours[0], -k));
        if (x === REPOS) break; jours++;
      }
      for (let k = 1; k <= 10; k++) {
        const x = quartLe(ctx, plan, c.id, ajouterJours(ctx.jours[0], -k));
        if (x !== "N") break; nuits++;
      }
      for (const j of ctx.jours) {
        const q = quartLe(ctx, plan, c.id, j);
        if (prec !== REPOS && q !== REPOS && ctx.interdit(prec, q)) ano("REPOS_11H", `${prec} puis ${q}`, c.id, j);
        jours = q !== REPOS ? jours + 1 : 0;
        nuits = q === "N" ? nuits + 1 : 0;
        if (jours > R.max_jours_consecutifs) ano("JOURS_CONSECUTIFS", `${jours} jours de suite`, c.id, j);
        if (nuits > R.max_nuits_consecutives) ano("NUITS_CONSECUTIVES", `${nuits} nuits de suite`, c.id, j);
        prec = q;
      }
      const total = nbQuarts(plan, c.id);
      if (total > R.max_quarts_horizon) ano("PLAFOND_QUARTS", `${total} quarts sur l'horizon`, c.id);
    }
    for (const jour of ctx.jours) for (const q of QUARTS) for (const p of Object.keys(donnees.besoins[q])) {
      const n = effectif(ctx, plan, jour, q, p);
      if (n < ctx.besoin(q, p)) ano("COUVERTURE", `${q} / ${p} : ${n} sur ${ctx.besoin(q, p)} requis`, "", jour);
    }
    return anomalies;
  }

  // ------------------------------------------------------------------ indicateurs, origine, différences
  function origine(ctx, id, jour, a) {
    if (ctx.volant(id)) return "VOLANT";
    const prevu = ctx.quartPrevu(id, jour);
    if (prevu === REPOS) return "SUPPLEMENTAIRE";
    return prevu === a.q ? "CYCLE" : "ECHANGE";
  }
  function indicateurs(donnees, plan, absences) {
    const ctx = preparer(donnees, absences);
    let requis = 0, couverts = 0, volants = 0, supplementaires = 0;
    for (const jour of ctx.jours) for (const q of QUARTS) for (const p of Object.keys(donnees.besoins[q])) {
      requis += ctx.besoin(q, p);
      couverts += Math.min(ctx.besoin(q, p), effectif(ctx, plan, jour, q, p));
    }
    const parPersonne = {};
    for (const c of donnees.collaborateurs) parPersonne[c.id] = { quarts: 0, nuits: 0 };
    for (const [k, a] of plan) {
      const [id, jour] = k.split("|");
      const o = origine(ctx, id, jour, a);
      if (o === "VOLANT") volants++;
      if (o === "SUPPLEMENTAIRE") supplementaires++;
      if (parPersonne[id]) { parPersonne[id].quarts++; if (a.q === "N") parPersonne[id].nuits++; }
    }
    return {
      requis, couverts, volants, supplementaires, parPersonne,
      demandesRespectees: donnees.demandes_repos.filter((d) => !plan.has(cle(d.id, d.jour))).length,
      demandesTotal: donnees.demandes_repos.length,
    };
  }
  function differences(avant, apres) {
    const liste = [];
    for (const k of new Set([...avant.keys(), ...apres.keys()])) {
      const a = avant.get(k), b = apres.get(k);
      if (a && b && a.q === b.q && a.p === b.p) continue;
      const [id, jour] = k.split("|");
      liste.push({ id, jour, avant: a || null, apres: b || null });
    }
    return liste.sort((x, y) => (x.jour < y.jour ? -1 : x.jour > y.jour ? 1 : x.id < y.id ? -1 : 1));
  }
  function maintenant() { return typeof performance !== "undefined" ? performance.now() : Date.now(); }

  const api = { generer, replanifier, controler, indicateurs, differences, origine, preparer, cle, ajouterJours, jourSemaine, QUARTS, REPOS };
  if (typeof module !== "undefined") module.exports = api;
  global.MoteurPlanning = api;
})(typeof window !== "undefined" ? window : globalThis);
