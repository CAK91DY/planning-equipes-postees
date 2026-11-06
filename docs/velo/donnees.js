/* Données FICTIVES — commerce et atelier vélo (exemple de démonstration).
   Toutes les valeurs sont des hypothèses à remplacer par l'organisation réelle :
   horaires, effectifs minimum, contrats, habilitations, compteurs, absences. */
const DONNEES_PLANNING = {
  horizon: { debut: "2026-12-07", nb_jours: 28 },          // commence un lundi
  feries: ["2026-12-25", "2027-01-01"],                    // magasin fermé
  jours_fermes_semaine: [0],                               // 0 = dimanche

  creneaux: {
    O: { libelle: "Ouverture", horaire: "9 h–17 h", heures: 7 },   // 8 h d'amplitude dont 1 h de pause
    F: { libelle: "Fermeture", horaire: "11 h–19 h", heures: 7 },
  },
  roles: { MECA: "Atelier", VENTE: "Magasin" },

  // Effectif MINIMUM par créneau et par rôle
  besoins: {
    semaine: { O: { MECA: 1, VENTE: 1 }, F: { MECA: 1, VENTE: 1 } },
    samedi:  { O: { MECA: 1, VENTE: 2 }, F: { MECA: 1, VENTE: 2 } },   // affluence du samedi
  },

  regles: {
    max_jours_semaine: 6,          // jamais plus de 6 jours travaillés dans la semaine
    max_jours_consecutifs: 6,      // repos hebdomadaire garanti
  },

  // Types d'absence. « compteur » : solde décompté en jours ouvrés ; « sur_demande » : validation du manager
  types_absence: {
    CP:        { libelle: "Congés payés",              court: "CP",    compteur: "CP",  sur_demande: true },
    RTT:       { libelle: "RTT",                       court: "RTT",   compteur: "RTT", sur_demande: true },
    FORMATION: { libelle: "Formation",                 court: "Form.", compteur: null,  sur_demande: false },
    ARRET:     { libelle: "Arrêt / absence imprévue",  court: "Abs.",  compteur: null,  sur_demande: false },
  },

  // habilitations[0] = poste principal ; jours_contrat = jours par semaine (7 h par jour)
  // soldes = jours restants (après les absences déjà validées ci-dessous)
  collaborateurs: [
    { id: "C01", nom: "Inès R.",   fonction: "Responsable de magasin",  habilitations: ["VENTE"],         jours_contrat: 5, soldes: { CP: 14, RTT: 3 } },
    { id: "C02", nom: "Karim B.",  fonction: "Mécanicien cycle",        habilitations: ["MECA"],          jours_contrat: 5, soldes: { CP: 9,  RTT: 2 } },
    { id: "C03", nom: "Lucas M.",  fonction: "Mécanicien cycle",        habilitations: ["MECA"],          jours_contrat: 5, soldes: { CP: 6,  RTT: 4 } },
    { id: "C04", nom: "Sofia D.",  fonction: "Mécanicienne-vendeuse",   habilitations: ["MECA", "VENTE"], jours_contrat: 5, soldes: { CP: 11, RTT: 1 } },
    { id: "C05", nom: "Thomas L.", fonction: "Conseiller de vente",     habilitations: ["VENTE"],         jours_contrat: 5, soldes: { CP: 12, RTT: 2 } },
    { id: "C06", nom: "Chloé P.",  fonction: "Conseillère de vente",    habilitations: ["VENTE"],         jours_contrat: 5, soldes: { CP: 3,  RTT: 3 } },
    { id: "C07", nom: "Yanis G.",  fonction: "Conseiller de vente (temps partiel)", habilitations: ["VENTE"], jours_contrat: 3, soldes: { CP: 5, RTT: 0 } },
  ],

  // statut : "validee" (prise en compte dans le planning), "en_attente" (à valider), "refusee"
  absences: [
    { num: 1, id: "C05", type: "FORMATION", debut: "2026-12-10", fin: "2026-12-10", statut: "validee",    source: "manager" },
    { num: 2, id: "C03", type: "CP",        debut: "2026-12-21", fin: "2026-12-26", statut: "validee",    source: "collaborateur" },
    { num: 3, id: "C06", type: "CP",        debut: "2026-12-28", fin: "2027-01-02", statut: "validee",    source: "collaborateur" },
    { num: 4, id: "C05", type: "RTT",       debut: "2026-12-23", fin: "2026-12-23", statut: "en_attente", source: "collaborateur" },
    { num: 5, id: "C02", type: "CP",        debut: "2026-12-30", fin: "2026-12-31", statut: "en_attente", source: "collaborateur" },
  ],
  demandes_repos: [
    { id: "C01", jour: "2026-12-24" },
    { id: "C04", jour: "2026-12-31" },
    { id: "C07", jour: "2026-12-19" },
  ],
};

if (typeof module !== "undefined") module.exports = DONNEES_PLANNING;
