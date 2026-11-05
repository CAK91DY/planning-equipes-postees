"""Démonstration de la replanification : une absence imprévue arrive après publication du planning.

Scénario : E009 (chef de quart, équipe C) est absent du 23 au 25 décembre 2026.
Le moteur repart du planning PUBLIÉ (output/planning.csv) et le modifie le moins possible.

Étapes (reproductibles, sans toucher aux données ni au planning de référence) :
  1. copie data/ dans output/replanif/donnees/ et y ajoute l'absence ;
  2. lance le moteur en mode replanification (--reference output/planning.csv) ;
  3. écrit les résultats dans output/replanif/ et le libellé du scénario dans scenario.txt.

Lancer depuis la racine du dépôt :  python scripts/demo_replanification.py
Puis régénérer la page :            python scripts/generer_page.py
"""
from __future__ import annotations

import json
import shutil
import sys
from datetime import date
from pathlib import Path

import pandas as pd

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE / "src"))
from planning.main import executer  # noqa: E402

ABSENCE = {"matricule": "E009", "date_debut": "2026-12-23", "date_fin": "2026-12-25", "motif": "ABSENCE_IMPREVUE"}
LIBELLES_POSTE = {"CHEF_QUART": "chef de quart", "OP_TABLEAU": "opérateur tableau", "OP_EXTERIEUR": "opérateur extérieur"}


def main() -> None:
    sortie = RACINE / "output" / "replanif"
    donnees = sortie / "donnees"
    if donnees.exists():
        shutil.rmtree(donnees)                     # on repart toujours des données d'origine
    shutil.copytree(RACINE / "data", donnees)

    # 1. Nouvelle absence, ajoutée à la COPIE des données
    absences = pd.read_csv(donnees / "absences.csv")
    pd.concat([absences, pd.DataFrame([ABSENCE])]).to_csv(donnees / "absences.csv", index=False)

    # 2. Replanification à partir du planning publié
    rapport = executer(donnees, RACINE / "config" / "regles.yaml", sortie,
                       reference=RACINE / "output" / "planning.csv")

    # 3. Libellé du scénario pour la page (construit depuis les données, pas écrit en dur)
    emp = pd.read_csv(donnees / "employes.csv").set_index("matricule")
    d1, d2 = date.fromisoformat(ABSENCE["date_debut"]), date.fromisoformat(ABSENCE["date_fin"])
    libelle = (f"absence imprévue de {ABSENCE['matricule']} ({LIBELLES_POSTE[emp.loc[ABSENCE['matricule'], 'poste_habituel']]}, "
               f"équipe {emp.loc[ABSENCE['matricule'], 'equipe']}) du {d1.day} au {d2.day}/{d2.month:02d}")
    (sortie / "scenario.txt").write_text(libelle + "\n", encoding="utf-8")

    print(json.dumps(rapport, ensure_ascii=False, indent=2))
    print("Scénario :", libelle)


if __name__ == "__main__":
    main()
