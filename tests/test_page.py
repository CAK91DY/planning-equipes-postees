"""Test de la page statique : elle reprend fidèlement le planning de référence, sans chiffre inventé."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

import pandas as pd

RACINE = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("generer_page", RACINE / "scripts" / "generer_page.py")
generer_page = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(generer_page)


def test_page_reprend_le_planning_de_reference(tmp_path):
    d = generer_page.charger(RACINE / "output", RACINE / "data", RACINE / "config" / "regles.yaml")
    page = generer_page.construire_page(d, tmp_path / "pas_de_replanif")
    planning = pd.read_csv(RACINE / "output" / "planning.csv")
    rapport = json.loads((RACINE / "output" / "rapport.json").read_text(encoding="utf-8"))

    # Indicateurs : calculés depuis les fichiers de sortie
    indic = {titre: valeur for titre, valeur, _ in generer_page.calculer_indicateurs(d)}
    assert indic["Postes couverts"] == f"{len(planning)} / {len(planning)}"   # 0 trou dans la référence
    assert indic["Remplacements par volant"] == f"{(planning.origine == 'VOLANT').sum()} quarts"
    assert indic["Heures supplémentaires"].startswith(str(rapport["indicateurs"]["quarts_supplementaires"]))

    # Grille : une case par affectation, encadrés volant et quart supplémentaire
    assert page.count("class='q q") == len(planning)
    classes = re.findall(r"<td class='q q[MAN]([^']*)'", page)
    assert sum(c == " volant" for c in classes) == (planning.origine == "VOLANT").sum()
    assert sum(c == " sup" for c in classes) == (planning.origine == "QUART_SUPPLEMENTAIRE").sum()

    # Données publiques : mention obligatoire et aucun motif médical affiché
    assert "Données entièrement fictives" in page
    assert "MALADIE" not in page and "maladie" not in page.lower()
