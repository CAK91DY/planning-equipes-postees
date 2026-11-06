// Vérifie le moteur et l'assistant du planning interactif (docs/interactif) ; affiche un résumé JSON.
const path = require("path");
const racine = path.resolve(__dirname, "..", "..", "docs", "interactif");
const D = require(path.join(racine, "donnees.js"));
const M = require(path.join(racine, "moteur.js"));
const A = require(path.join(racine, "assistant.js"));

const valid = D.absences.filter((a) => a.statut === "validee");
const ref = new Map(D.planning_reference.map(([id, j, q, p]) => [M.cle(id, j), { q, p }]));
const indRef = M.indicateurs(D, ref, valid);

// Scénario de référence : E009 absent du 23 au 25/12 (même cas que output/replanif)
const apres = valid.concat([{ id: "E009", debut: "2026-12-23", fin: "2026-12-25" }]);
const r = M.replanifier(D, ref, apres);
const ajouts = M.differences(ref, r.plan).filter((d) => d.apres).map((d) => [d.id, d.jour, d.apres.q, d.apres.p]);

// Cas impossible : le seul volant chef de quart absent les 15 et 16/12
const dur = valid.concat([{ id: "E021", debut: "2026-12-15", fin: "2026-12-16" }]);
const rd = M.replanifier(D, ref, dur);

const g = M.generer(D, valid);
console.log(JSON.stringify({
  reference: { anomalies: M.controler(D, ref, valid).length, couverts: indRef.couverts, requis: indRef.requis,
               volants: indRef.volants, supplementaires: indRef.supplementaires },
  replanification: { anomalies: M.controler(D, r.plan, apres).length, trous: r.trous.length, ajouts },
  impossible: { trous: rd.trous.length, anomalies_couverture: M.controler(D, rd.plan, dur).filter((a) => a.regle === "COUVERTURE").length },
  generation: { anomalies: M.controler(D, g.plan, valid).length, trous: g.trous.length },
  phrases: {
    arret: A.interpreter("Antoine est en arrêt du 23 au 25 décembre", D),
    rtt: A.interpreter("RTT pour Camille le 26/12", D),
    dispo: A.interpreter("Qui peut remplacer le chef de quart de nuit le 15 ?", D),
    solde: A.interpreter("Combien de congés reste-t-il à Manon ?", D),
    matricule: A.interpreter("E009 absent du 23 au 25/12", D),
  },
}));
