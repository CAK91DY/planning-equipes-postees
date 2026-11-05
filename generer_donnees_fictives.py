"""Génère un jeu de données FICTIF pour tester le moteur de planning.

Structure : 5 équipes postées (A à E) de 4 personnes + 4 volants (remplaçants).
Chaque équipe : 1 chef de quart, 1 opérateur tableau, 2 opérateurs extérieur.

Usage : python generer_donnees_fictives.py --sortie data
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

POSTES = ["CHEF_QUART", "OP_TABLEAU", "OP_EXTERIEUR"]

# Habilitations par rôle : un chef peut tenir le tableau et l'extérieur, etc.
HABILITATIONS_PAR_ROLE = {
    "CHEF_QUART": ["CHEF_QUART", "OP_TABLEAU", "OP_EXTERIEUR"],
    "OP_TABLEAU": ["OP_TABLEAU", "OP_EXTERIEUR"],
    "OP_EXTERIEUR": ["OP_EXTERIEUR"],
}


def generer(dossier: Path) -> None:
    dossier.mkdir(parents=True, exist_ok=True)
    employes, habilitations = [], []
    num = 1
    for equipe in "ABCDE":
        for role in ["CHEF_QUART", "OP_TABLEAU", "OP_EXTERIEUR", "OP_EXTERIEUR"]:
            mat = f"E{num:03d}"
            employes.append({"matricule": mat, "nom": f"Opérateur {num:02d}",
                             "equipe": equipe, "poste_habituel": role})
            habilitations += [{"matricule": mat, "poste": p} for p in HABILITATIONS_PAR_ROLE[role]]
            num += 1
    # Volants : polyvalents, sans cycle fixe
    for role in ["CHEF_QUART", "OP_TABLEAU", "OP_TABLEAU", "OP_EXTERIEUR"]:
        mat = f"E{num:03d}"
        employes.append({"matricule": mat, "nom": f"Volant {num:02d}",
                         "equipe": "VOLANT", "poste_habituel": role})
        habilitations += [{"matricule": mat, "poste": p} for p in HABILITATIONS_PAR_ROLE[role]]
        num += 1

    besoins = [{"poste": p, "quart": q, "effectif": 2 if p == "OP_EXTERIEUR" else 1}
               for q in "MAN" for p in POSTES]

    # Absences fictives sur décembre 2026 (congés de fin d'année, maladie, formation)
    absences = [
        {"matricule": "E002", "date_debut": "2026-12-21", "date_fin": "2026-12-27", "motif": "CONGES"},
        {"matricule": "E007", "date_debut": "2026-12-24", "date_fin": "2027-01-01", "motif": "CONGES"},
        {"matricule": "E011", "date_debut": "2026-12-09", "date_fin": "2026-12-11", "motif": "MALADIE"},
        {"matricule": "E013", "date_debut": "2026-12-15", "date_fin": "2026-12-16", "motif": "FORMATION"},
        {"matricule": "E018", "date_debut": "2026-12-28", "date_fin": "2027-01-03", "motif": "CONGES"},
        {"matricule": "E005", "date_debut": "2026-12-14", "date_fin": "2026-12-18", "motif": "CONGES"},
        {"matricule": "E022", "date_debut": "2026-12-26", "date_fin": "2026-12-31", "motif": "CONGES"},
    ]
    demandes = [
        {"matricule": "E003", "date": "2026-12-25", "type": "REPOS_SOUHAITE"},
        {"matricule": "E021", "date": "2026-12-31", "type": "REPOS_SOUHAITE"},
        {"matricule": "E016", "date": "2026-12-24", "type": "REPOS_SOUHAITE"},
    ]

    pd.DataFrame(employes).to_csv(dossier / "employes.csv", index=False)
    pd.DataFrame(habilitations).to_csv(dossier / "habilitations.csv", index=False)
    pd.DataFrame(besoins).to_csv(dossier / "besoins.csv", index=False)
    pd.DataFrame(absences).to_csv(dossier / "absences.csv", index=False)
    pd.DataFrame(demandes).to_csv(dossier / "demandes.csv", index=False)
    print(f"{len(employes)} employés, {len(absences)} absences écrits dans {dossier}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--sortie", default="data")
    generer(Path(parser.parse_args().sortie))
