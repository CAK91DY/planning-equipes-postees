// Vérifie le moteur et l'assistant de la démo interactive (docs/velo) ; affiche un résumé JSON.
const path = require("path");
const racine = path.resolve(__dirname, "..", "..", "docs", "velo");
const D = require(path.join(racine, "donnees.js"));
const M = require(path.join(racine, "moteur.js"));
const A = require(path.join(racine, "assistant.js"));

const valid = D.absences.filter((a) => a.statut === "validee").map((a) => ({ id: a.id, debut: a.debut, fin: a.fin }));
const dm = Object.assign({}, D, { absences: valid });
const g = M.generer(dm);
const indG = M.indicateurs(dm, g.plan, valid);

// Scénario : arrêt imprévu d'un mécanicien après publication
const nouvelle = { id: "C02", debut: "2026-12-15", fin: "2026-12-17" };
nouvelle.jours_retires = [];
for (let j = nouvelle.debut; j <= nouvelle.fin; j = M.ajouterJours(j, 1)) if (g.plan.has(M.cle("C02", j))) nouvelle.jours_retires.push(j);
const apres = valid.concat([nouvelle]);
const r = M.replanifier(dm, g.plan, apres);
const absentPlanifie = [...r.plan.keys()].some((k) => k.startsWith("C02|") && k.split("|")[1] >= nouvelle.debut && k.split("|")[1] <= nouvelle.fin);

const phrases = {
  "Karim est malade du 15 au 17 décembre": A.interpreter("Karim est malade du 15 au 17 décembre", D),
  "RTT pour Thomas le 23/12": A.interpreter("RTT pour Thomas le 23/12", D),
  "Qui est disponible le 15 pour l'atelier ?": A.interpreter("Qui est disponible le 15 pour l'atelier ?", D),
  "Combien de congés reste-t-il à Chloé ?": A.interpreter("Combien de congés reste-t-il à Chloé ?", D),
};

console.log(JSON.stringify({
  generation: { anomalies: M.controler(dm, g.plan, valid).length, requis: indG.requis, couverts: indG.couverts,
                demandes: [indG.demandesRespectees, indG.demandesTotal] },
  replanification: { anomalies: M.controler(dm, r.plan, apres).length, trous: r.trous.length,
                     changements: M.differences(g.plan, r.plan).length, absentPlanifie },
  phrases,
}));
