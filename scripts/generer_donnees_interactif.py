"""Prépare les données du planning interactif (docs/interactif/donnees.js).

Sources (lues telles quelles) :
  config/regles.yaml       horizon, quarts, cycle 5x8, règles dures
  data/employes.csv        équipes et postes habituels
  data/habilitations.csv   postes autorisés
  data/besoins.csv         effectif requis par quart et par poste
  data/absences.csv        absences déjà connues (validées)
  data/demandes.csv        demandes de repos
  output/planning.csv      planning de RÉFÉRENCE calculé par OR-Tools : point de départ publié

Ajouts propres à la page (exemples) : prénoms, compteurs de congés et de RTT, deux demandes en
attente de validation. Le motif médical n'est jamais repris : « MALADIE » devient « Arrêt ».

Lancer depuis la racine du dépôt :  python scripts/generer_donnees_interactif.py
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import yaml

RACINE = Path(__file__).resolve().parents[1]
SORTIE = RACINE / "docs" / "interactif" / "donnees.js"

PRENOMS = ["Julien M.", "Sarah B.", "Mehdi K.", "Laura T.", "Nicolas F.", "Camille R.", "Yassine D.", "Élodie P.",
           "Antoine L.", "Inès G.", "Romain C.", "Léa V.", "Karim H.", "Manon S.", "Thomas A.", "Sonia N.",
           "Damien O.", "Chloé J.", "Hugo E.", "Nadia Z.", "Olivier W.", "Aurélie Q.", "Bastien U.", "Fatima Y."]
TYPE_ABSENCE = {"CONGES": "CP", "MALADIE": "ARRET", "FORMATION": "FORMATION", "ABSENCE_IMPREVUE": "ARRET"}


def main() -> None:
    regles = yaml.safe_load((RACINE / "config" / "regles.yaml").read_text(encoding="utf-8"))
    emp = pd.read_csv(RACINE / "data" / "employes.csv")
    hab = pd.read_csv(RACINE / "data" / "habilitations.csv")
    besoins = pd.read_csv(RACINE / "data" / "besoins.csv")
    absences = pd.read_csv(RACINE / "data" / "absences.csv")
    demandes = pd.read_csv(RACINE / "data" / "demandes.csv")
    planning = pd.read_csv(RACINE / "output" / "planning.csv")

    collaborateurs = []
    for i, r in enumerate(emp.itertuples()):
        postes = hab[hab.matricule == r.matricule].poste.tolist()
        # habilitations[0] = poste habituel, puis les autres postes autorisés
        postes = [r.poste_habituel] + [p for p in postes if p != r.poste_habituel]
        collaborateurs.append({
            "id": r.matricule, "nom": PRENOMS[i], "equipe": r.equipe, "habilitations": postes,
            "soldes": {"CP": 8 + (i * 7) % 17, "RTT": 1 + (i * 3) % 5},   # compteurs d'exemple (jours)
        })

    liste_abs = [{"num": k + 1, "id": r.matricule, "type": TYPE_ABSENCE.get(r.motif, "ARRET"),
                  "debut": r.date_debut, "fin": r.date_fin, "statut": "validee", "source": "manager"}
                 for k, r in enumerate(absences.itertuples())]
    # Deux demandes en attente de validation (exemples)
    liste_abs += [
        {"num": len(liste_abs) + 1, "id": "E006", "type": "RTT", "debut": "2026-12-26", "fin": "2026-12-26",
         "statut": "en_attente", "source": "collaborateur"},
        {"num": len(liste_abs) + 2, "id": "E014", "type": "CP", "debut": "2026-12-23", "fin": "2026-12-24",
         "statut": "en_attente", "source": "collaborateur"},
    ]

    donnees = {
        "horizon": {"debut": regles["horizon"]["date_debut"], "nb_jours": regles["horizon"]["nb_jours"]},
        "quarts": {q: {"libelle": {"M": "Matin", "A": "Après-midi", "N": "Nuit"}[q],
                       "horaire": f"{int(h[0][:2])} h–{int(h[1][:2])} h"}
                   for q, h in regles["quarts"].items()},
        "postes": {"CHEF_QUART": "Chef de quart", "OP_TABLEAU": "Opérateur tableau", "OP_EXTERIEUR": "Opérateur extérieur"},
        "cycle": regles["cycle"],
        "regles": regles["regles_dures"],
        "transitions_interdites": [["A", "M"], ["N", "M"], ["N", "A"]],
        "besoins": {q: {r.poste: int(r.effectif) for r in besoins[besoins.quart == q].itertuples()} for q in "MAN"},
        "types_absence": {
            "CP": {"libelle": "Congés payés", "court": "CP", "compteur": "CP", "sur_demande": True},
            "RTT": {"libelle": "RTT", "court": "RTT", "compteur": "RTT", "sur_demande": True},
            "FORMATION": {"libelle": "Formation", "court": "Form.", "compteur": None, "sur_demande": False},
            "ARRET": {"libelle": "Arrêt / absence imprévue", "court": "Abs.", "compteur": None, "sur_demande": False},
        },
        "collaborateurs": collaborateurs,
        "absences": liste_abs,
        "demandes_repos": [{"id": r.matricule, "jour": r.date} for r in demandes.itertuples()],
        # Planning publié de départ = planning de référence OR-Tools : [matricule, date, quart, poste]
        "planning_reference": [[r.matricule, r.date, r.quart, r.poste] for r in planning.itertuples()],
    }
    texte = ("/* Généré par scripts/generer_donnees_interactif.py — ne pas modifier à la main.\n"
             "   Planning de départ : output/planning.csv (OR-Tools). Prénoms et compteurs : exemples. */\n"
             f"const DONNEES_PLANNING = {json.dumps(donnees, ensure_ascii=False, indent=1)};\n"
             'if (typeof module !== "undefined") module.exports = DONNEES_PLANNING;\n')
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(texte, encoding="utf-8")
    print(f"{len(collaborateurs)} collaborateurs, {len(liste_abs)} absences, "
          f"{len(donnees['planning_reference'])} affectations -> {SORTIE}")


if __name__ == "__main__":
    main()
