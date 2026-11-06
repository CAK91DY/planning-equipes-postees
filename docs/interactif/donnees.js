/* Généré par scripts/generer_donnees_interactif.py — ne pas modifier à la main.
   Planning de départ : output/planning.csv (OR-Tools). Prénoms et compteurs : exemples. */
const DONNEES_PLANNING = {
 "horizon": {
  "debut": "2026-12-07",
  "nb_jours": 28
 },
 "quarts": {
  "M": {
   "libelle": "Matin",
   "horaire": "6 h–14 h"
  },
  "A": {
   "libelle": "Après-midi",
   "horaire": "14 h–22 h"
  },
  "N": {
   "libelle": "Nuit",
   "horaire": "22 h–6 h"
  }
 },
 "postes": {
  "CHEF_QUART": "Chef de quart",
  "OP_TABLEAU": "Opérateur tableau",
  "OP_EXTERIEUR": "Opérateur extérieur"
 },
 "cycle": {
  "date_reference": "2026-12-07",
  "motif": [
   "M",
   "M",
   "A",
   "A",
   "N",
   "N",
   "R",
   "R",
   "R",
   "R"
  ],
  "decalage_equipes": {
   "A": 0,
   "B": 2,
   "C": 4,
   "D": 6,
   "E": 8
  }
 },
 "regles": {
  "repos_min_heures": 11,
  "max_jours_consecutifs": 6,
  "max_nuits_consecutives": 3,
  "max_quarts_horizon": 20
 },
 "transitions_interdites": [
  [
   "A",
   "M"
  ],
  [
   "N",
   "M"
  ],
  [
   "N",
   "A"
  ]
 ],
 "besoins": {
  "M": {
   "CHEF_QUART": 1,
   "OP_TABLEAU": 1,
   "OP_EXTERIEUR": 2
  },
  "A": {
   "CHEF_QUART": 1,
   "OP_TABLEAU": 1,
   "OP_EXTERIEUR": 2
  },
  "N": {
   "CHEF_QUART": 1,
   "OP_TABLEAU": 1,
   "OP_EXTERIEUR": 2
  }
 },
 "types_absence": {
  "CP": {
   "libelle": "Congés payés",
   "court": "CP",
   "compteur": "CP",
   "sur_demande": true
  },
  "RTT": {
   "libelle": "RTT",
   "court": "RTT",
   "compteur": "RTT",
   "sur_demande": true
  },
  "FORMATION": {
   "libelle": "Formation",
   "court": "Form.",
   "compteur": null,
   "sur_demande": false
  },
  "ARRET": {
   "libelle": "Arrêt / absence imprévue",
   "court": "Abs.",
   "compteur": null,
   "sur_demande": false
  }
 },
 "collaborateurs": [
  {
   "id": "E001",
   "nom": "Julien M.",
   "equipe": "A",
   "habilitations": [
    "CHEF_QUART",
    "OP_TABLEAU",
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 8,
    "RTT": 1
   }
  },
  {
   "id": "E002",
   "nom": "Sarah B.",
   "equipe": "A",
   "habilitations": [
    "OP_TABLEAU",
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 15,
    "RTT": 4
   }
  },
  {
   "id": "E003",
   "nom": "Mehdi K.",
   "equipe": "A",
   "habilitations": [
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 22,
    "RTT": 2
   }
  },
  {
   "id": "E004",
   "nom": "Laura T.",
   "equipe": "A",
   "habilitations": [
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 12,
    "RTT": 5
   }
  },
  {
   "id": "E005",
   "nom": "Nicolas F.",
   "equipe": "B",
   "habilitations": [
    "CHEF_QUART",
    "OP_TABLEAU",
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 19,
    "RTT": 3
   }
  },
  {
   "id": "E006",
   "nom": "Camille R.",
   "equipe": "B",
   "habilitations": [
    "OP_TABLEAU",
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 9,
    "RTT": 1
   }
  },
  {
   "id": "E007",
   "nom": "Yassine D.",
   "equipe": "B",
   "habilitations": [
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 16,
    "RTT": 4
   }
  },
  {
   "id": "E008",
   "nom": "Élodie P.",
   "equipe": "B",
   "habilitations": [
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 23,
    "RTT": 2
   }
  },
  {
   "id": "E009",
   "nom": "Antoine L.",
   "equipe": "C",
   "habilitations": [
    "CHEF_QUART",
    "OP_TABLEAU",
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 13,
    "RTT": 5
   }
  },
  {
   "id": "E010",
   "nom": "Inès G.",
   "equipe": "C",
   "habilitations": [
    "OP_TABLEAU",
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 20,
    "RTT": 3
   }
  },
  {
   "id": "E011",
   "nom": "Romain C.",
   "equipe": "C",
   "habilitations": [
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 10,
    "RTT": 1
   }
  },
  {
   "id": "E012",
   "nom": "Léa V.",
   "equipe": "C",
   "habilitations": [
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 17,
    "RTT": 4
   }
  },
  {
   "id": "E013",
   "nom": "Karim H.",
   "equipe": "D",
   "habilitations": [
    "CHEF_QUART",
    "OP_TABLEAU",
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 24,
    "RTT": 2
   }
  },
  {
   "id": "E014",
   "nom": "Manon S.",
   "equipe": "D",
   "habilitations": [
    "OP_TABLEAU",
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 14,
    "RTT": 5
   }
  },
  {
   "id": "E015",
   "nom": "Thomas A.",
   "equipe": "D",
   "habilitations": [
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 21,
    "RTT": 3
   }
  },
  {
   "id": "E016",
   "nom": "Sonia N.",
   "equipe": "D",
   "habilitations": [
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 11,
    "RTT": 1
   }
  },
  {
   "id": "E017",
   "nom": "Damien O.",
   "equipe": "E",
   "habilitations": [
    "CHEF_QUART",
    "OP_TABLEAU",
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 18,
    "RTT": 4
   }
  },
  {
   "id": "E018",
   "nom": "Chloé J.",
   "equipe": "E",
   "habilitations": [
    "OP_TABLEAU",
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 8,
    "RTT": 2
   }
  },
  {
   "id": "E019",
   "nom": "Hugo E.",
   "equipe": "E",
   "habilitations": [
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 15,
    "RTT": 5
   }
  },
  {
   "id": "E020",
   "nom": "Nadia Z.",
   "equipe": "E",
   "habilitations": [
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 22,
    "RTT": 3
   }
  },
  {
   "id": "E021",
   "nom": "Olivier W.",
   "equipe": "VOLANT",
   "habilitations": [
    "CHEF_QUART",
    "OP_TABLEAU",
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 12,
    "RTT": 1
   }
  },
  {
   "id": "E022",
   "nom": "Aurélie Q.",
   "equipe": "VOLANT",
   "habilitations": [
    "OP_TABLEAU",
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 19,
    "RTT": 4
   }
  },
  {
   "id": "E023",
   "nom": "Bastien U.",
   "equipe": "VOLANT",
   "habilitations": [
    "OP_TABLEAU",
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 9,
    "RTT": 2
   }
  },
  {
   "id": "E024",
   "nom": "Fatima Y.",
   "equipe": "VOLANT",
   "habilitations": [
    "OP_EXTERIEUR"
   ],
   "soldes": {
    "CP": 16,
    "RTT": 5
   }
  }
 ],
 "absences": [
  {
   "num": 1,
   "id": "E002",
   "type": "CP",
   "debut": "2026-12-21",
   "fin": "2026-12-27",
   "statut": "validee",
   "source": "manager"
  },
  {
   "num": 2,
   "id": "E007",
   "type": "CP",
   "debut": "2026-12-24",
   "fin": "2027-01-01",
   "statut": "validee",
   "source": "manager"
  },
  {
   "num": 3,
   "id": "E011",
   "type": "ARRET",
   "debut": "2026-12-09",
   "fin": "2026-12-11",
   "statut": "validee",
   "source": "manager"
  },
  {
   "num": 4,
   "id": "E013",
   "type": "FORMATION",
   "debut": "2026-12-15",
   "fin": "2026-12-16",
   "statut": "validee",
   "source": "manager"
  },
  {
   "num": 5,
   "id": "E018",
   "type": "CP",
   "debut": "2026-12-28",
   "fin": "2027-01-03",
   "statut": "validee",
   "source": "manager"
  },
  {
   "num": 6,
   "id": "E005",
   "type": "CP",
   "debut": "2026-12-14",
   "fin": "2026-12-18",
   "statut": "validee",
   "source": "manager"
  },
  {
   "num": 7,
   "id": "E022",
   "type": "CP",
   "debut": "2026-12-26",
   "fin": "2026-12-31",
   "statut": "validee",
   "source": "manager"
  },
  {
   "num": 8,
   "id": "E006",
   "type": "RTT",
   "debut": "2026-12-26",
   "fin": "2026-12-26",
   "statut": "en_attente",
   "source": "collaborateur"
  },
  {
   "num": 9,
   "id": "E014",
   "type": "CP",
   "debut": "2026-12-23",
   "fin": "2026-12-24",
   "statut": "en_attente",
   "source": "collaborateur"
  }
 ],
 "demandes_repos": [
  {
   "id": "E003",
   "jour": "2026-12-25"
  },
  {
   "id": "E021",
   "jour": "2026-12-31"
  },
  {
   "id": "E016",
   "jour": "2026-12-24"
  }
 ],
 "planning_reference": [
  [
   "E005",
   "2026-12-07",
   "A",
   "CHEF_QUART"
  ],
  [
   "E007",
   "2026-12-07",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E008",
   "2026-12-07",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-07",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-07",
   "M",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-07",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-07",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-07",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-07",
   "N",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-07",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-07",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-07",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E005",
   "2026-12-08",
   "A",
   "CHEF_QUART"
  ],
  [
   "E007",
   "2026-12-08",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E008",
   "2026-12-08",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-08",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-08",
   "M",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-08",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-08",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-08",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-08",
   "N",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-08",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-08",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-08",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-09",
   "A",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-09",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-09",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-09",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-09",
   "M",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-09",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-09",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E018",
   "2026-12-09",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E005",
   "2026-12-09",
   "N",
   "CHEF_QUART"
  ],
  [
   "E007",
   "2026-12-09",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E008",
   "2026-12-09",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-09",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-10",
   "A",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-10",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-10",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-10",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-10",
   "M",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-10",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-10",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E018",
   "2026-12-10",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E005",
   "2026-12-10",
   "N",
   "CHEF_QUART"
  ],
  [
   "E007",
   "2026-12-10",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E008",
   "2026-12-10",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-10",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-11",
   "A",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-11",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-11",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E018",
   "2026-12-11",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2026-12-11",
   "M",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2026-12-11",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2026-12-11",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2026-12-11",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-11",
   "N",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-11",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-11",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-11",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-12",
   "A",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-12",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-12",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E018",
   "2026-12-12",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2026-12-12",
   "M",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2026-12-12",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2026-12-12",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2026-12-12",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-12",
   "N",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-12",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-12",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-12",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2026-12-13",
   "A",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2026-12-13",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2026-12-13",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2026-12-13",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-13",
   "M",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-13",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-13",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-13",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-13",
   "N",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-13",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-13",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E018",
   "2026-12-13",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2026-12-14",
   "A",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2026-12-14",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2026-12-14",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2026-12-14",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-14",
   "M",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-14",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-14",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-14",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-14",
   "N",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-14",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-14",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E018",
   "2026-12-14",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-15",
   "A",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-15",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-15",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-15",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E021",
   "2026-12-15",
   "M",
   "CHEF_QUART"
  ],
  [
   "E007",
   "2026-12-15",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E008",
   "2026-12-15",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-15",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-15",
   "N",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2026-12-15",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2026-12-15",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2026-12-15",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-16",
   "A",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-16",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-16",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-16",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E021",
   "2026-12-16",
   "M",
   "CHEF_QUART"
  ],
  [
   "E007",
   "2026-12-16",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E008",
   "2026-12-16",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-16",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-16",
   "N",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2026-12-16",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2026-12-16",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2026-12-16",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E021",
   "2026-12-17",
   "A",
   "CHEF_QUART"
  ],
  [
   "E007",
   "2026-12-17",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E008",
   "2026-12-17",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-17",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-17",
   "M",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-17",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-17",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-17",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-17",
   "N",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-17",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-17",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-17",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E021",
   "2026-12-18",
   "A",
   "CHEF_QUART"
  ],
  [
   "E007",
   "2026-12-18",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E008",
   "2026-12-18",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-18",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-18",
   "M",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-18",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-18",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-18",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-18",
   "N",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-18",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-18",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-18",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-19",
   "A",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-19",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-19",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-19",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-19",
   "M",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-19",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-19",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E018",
   "2026-12-19",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E005",
   "2026-12-19",
   "N",
   "CHEF_QUART"
  ],
  [
   "E007",
   "2026-12-19",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E008",
   "2026-12-19",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-19",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-20",
   "A",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-20",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-20",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-20",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-20",
   "M",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-20",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-20",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E018",
   "2026-12-20",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E005",
   "2026-12-20",
   "N",
   "CHEF_QUART"
  ],
  [
   "E007",
   "2026-12-20",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E008",
   "2026-12-20",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-20",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-21",
   "A",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-21",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-21",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E018",
   "2026-12-21",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2026-12-21",
   "M",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2026-12-21",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2026-12-21",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2026-12-21",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-21",
   "N",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-21",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-21",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E022",
   "2026-12-21",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-22",
   "A",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-22",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-22",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E018",
   "2026-12-22",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2026-12-22",
   "M",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2026-12-22",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2026-12-22",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2026-12-22",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-22",
   "N",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-22",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-22",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E023",
   "2026-12-22",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2026-12-23",
   "A",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2026-12-23",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2026-12-23",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2026-12-23",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-23",
   "M",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-23",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-23",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-23",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-23",
   "N",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-23",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-23",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E018",
   "2026-12-23",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2026-12-24",
   "A",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2026-12-24",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E024",
   "2026-12-24",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2026-12-24",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-24",
   "M",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-24",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-24",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-24",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-24",
   "N",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-24",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-24",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E018",
   "2026-12-24",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-25",
   "A",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-25",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-25",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-25",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E005",
   "2026-12-25",
   "M",
   "CHEF_QUART"
  ],
  [
   "E008",
   "2026-12-25",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E022",
   "2026-12-25",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-25",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2026-12-25",
   "N",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2026-12-25",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2026-12-25",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2026-12-25",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-26",
   "A",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-26",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-26",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-26",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E005",
   "2026-12-26",
   "M",
   "CHEF_QUART"
  ],
  [
   "E008",
   "2026-12-26",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E024",
   "2026-12-26",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-26",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2026-12-26",
   "N",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2026-12-26",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2026-12-26",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2026-12-26",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E005",
   "2026-12-27",
   "A",
   "CHEF_QUART"
  ],
  [
   "E008",
   "2026-12-27",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E024",
   "2026-12-27",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-27",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-27",
   "M",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-27",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-27",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E023",
   "2026-12-27",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-27",
   "N",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-27",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-27",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-27",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E005",
   "2026-12-28",
   "A",
   "CHEF_QUART"
  ],
  [
   "E008",
   "2026-12-28",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E024",
   "2026-12-28",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-28",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-28",
   "M",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-28",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-28",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-28",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2026-12-28",
   "N",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2026-12-28",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2026-12-28",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2026-12-28",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-29",
   "A",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-29",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-29",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-29",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-29",
   "M",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-29",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-29",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E023",
   "2026-12-29",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E005",
   "2026-12-29",
   "N",
   "CHEF_QUART"
  ],
  [
   "E008",
   "2026-12-29",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E024",
   "2026-12-29",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-29",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-30",
   "A",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-30",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-30",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-30",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-30",
   "M",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-30",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-30",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E023",
   "2026-12-30",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E005",
   "2026-12-30",
   "N",
   "CHEF_QUART"
  ],
  [
   "E008",
   "2026-12-30",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E021",
   "2026-12-30",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E006",
   "2026-12-30",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2026-12-31",
   "A",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2026-12-31",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2026-12-31",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E023",
   "2026-12-31",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2026-12-31",
   "M",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2026-12-31",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2026-12-31",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2026-12-31",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2026-12-31",
   "N",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2026-12-31",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2026-12-31",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2026-12-31",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2027-01-01",
   "A",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2027-01-01",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2027-01-01",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E022",
   "2027-01-01",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2027-01-01",
   "M",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2027-01-01",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2027-01-01",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2027-01-01",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E001",
   "2027-01-01",
   "N",
   "CHEF_QUART"
  ],
  [
   "E003",
   "2027-01-01",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E004",
   "2027-01-01",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E002",
   "2027-01-01",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2027-01-02",
   "A",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2027-01-02",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2027-01-02",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2027-01-02",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2027-01-02",
   "M",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2027-01-02",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2027-01-02",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2027-01-02",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2027-01-02",
   "N",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2027-01-02",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2027-01-02",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E022",
   "2027-01-02",
   "N",
   "OP_TABLEAU"
  ],
  [
   "E013",
   "2027-01-03",
   "A",
   "CHEF_QUART"
  ],
  [
   "E015",
   "2027-01-03",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E016",
   "2027-01-03",
   "A",
   "OP_EXTERIEUR"
  ],
  [
   "E014",
   "2027-01-03",
   "A",
   "OP_TABLEAU"
  ],
  [
   "E009",
   "2027-01-03",
   "M",
   "CHEF_QUART"
  ],
  [
   "E011",
   "2027-01-03",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E012",
   "2027-01-03",
   "M",
   "OP_EXTERIEUR"
  ],
  [
   "E010",
   "2027-01-03",
   "M",
   "OP_TABLEAU"
  ],
  [
   "E017",
   "2027-01-03",
   "N",
   "CHEF_QUART"
  ],
  [
   "E019",
   "2027-01-03",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E020",
   "2027-01-03",
   "N",
   "OP_EXTERIEUR"
  ],
  [
   "E022",
   "2027-01-03",
   "N",
   "OP_TABLEAU"
  ]
 ]
};
if (typeof module !== "undefined") module.exports = DONNEES_PLANNING;
