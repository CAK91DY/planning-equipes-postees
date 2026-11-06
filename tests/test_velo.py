"""Tests de la démo interactive (docs/velo) : moteur JavaScript et assistant, exécutés avec Node.js."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parents[1]
NODE = shutil.which("node")


@pytest.fixture(scope="module")
def resultat():
    if NODE is None:
        pytest.skip("Node.js n'est pas installé : tests de la démo interactive ignorés")
    sortie = subprocess.run([NODE, str(RACINE / "tests" / "js" / "verifier_velo.js")],
                            capture_output=True, text=True, check=True)
    return json.loads(sortie.stdout)


def test_generation_couvre_tout_sans_anomalie(resultat):
    g = resultat["generation"]
    assert g["anomalies"] == 0
    assert g["couverts"] == g["requis"]
    assert g["demandes"][0] == g["demandes"][1]          # demandes de repos respectées


def test_replanification_apres_arret(resultat):
    r = resultat["replanification"]
    assert r["anomalies"] == 0 and r["trous"] == 0
    assert not r["absentPlanifie"]                        # la personne absente n'est plus planifiée
    assert r["changements"] <= 6                          # modifie peu le planning publié


def test_assistant_comprend_les_demandes(resultat):
    p = resultat["phrases"]
    assert p["Karim est malade du 15 au 17 décembre"] == {
        "type": "absence", "id": "C02", "absenceType": "ARRET", "debut": "2026-12-15", "fin": "2026-12-17"}
    assert p["RTT pour Thomas le 23/12"]["absenceType"] == "RTT"
    assert p["Qui est disponible le 15 pour l'atelier ?"] == {"type": "disponibles", "jour": "2026-12-15", "role": "MECA"}
    assert p["Combien de congés reste-t-il à Chloé ?"] == {"type": "solde", "id": "C06"}
