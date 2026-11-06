"""Tests du planning interactif (docs/interactif) : moteur JavaScript et assistant, exécutés avec Node.js.

Le moteur JavaScript doit retrouver les résultats du moteur de référence OR-Tools."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pandas as pd
import pytest

RACINE = Path(__file__).resolve().parents[1]
NODE = shutil.which("node")


@pytest.fixture(scope="module")
def resultat():
    if NODE is None:
        pytest.skip("Node.js n'est pas installé : tests du planning interactif ignorés")
    sortie = subprocess.run([NODE, str(RACINE / "tests" / "js" / "verifier_interactif.js")],
                            capture_output=True, text=True, check=True)
    return json.loads(sortie.stdout)


def test_planning_de_depart_est_la_reference_or_tools(resultat):
    r = resultat["reference"]
    rapport = json.loads((RACINE / "output" / "rapport.json").read_text(encoding="utf-8"))
    assert r["anomalies"] == 0 and r["couverts"] == r["requis"] == rapport["indicateurs"]["affectations"]
    assert r["volants"] == rapport["indicateurs"]["par_origine"]["VOLANT"]
    assert r["supplementaires"] == rapport["indicateurs"]["quarts_supplementaires"]


def test_replanification_identique_a_or_tools(resultat):
    r = resultat["replanification"]
    assert r["anomalies"] == 0 and r["trous"] == 0
    replanif = pd.read_csv(RACINE / "output" / "replanif" / "planning.csv")
    attendus = sorted(replanif[replanif.origine == "MODIFIE"][["matricule", "date", "quart", "poste"]].values.tolist())
    assert sorted(r["ajouts"]) == attendus


def test_poste_impossible_est_signale(resultat):
    assert resultat["impossible"]["trous"] == 2
    assert resultat["impossible"]["anomalies_couverture"] == 2


def test_generation_complete_sans_anomalie(resultat):
    assert resultat["generation"] == {"anomalies": 0, "trous": 0}


def test_assistant_comprend_les_demandes(resultat):
    p = resultat["phrases"]
    assert p["arret"] == {"type": "absence", "id": "E009", "absenceType": "ARRET", "debut": "2026-12-23", "fin": "2026-12-25"}
    assert p["matricule"]["id"] == "E009"
    assert p["rtt"]["absenceType"] == "RTT" and p["rtt"]["debut"] == "2026-12-26"
    assert p["dispo"] == {"type": "disponibles", "jour": "2026-12-15", "quart": "N", "poste": "CHEF_QUART"}
    assert p["solde"] == {"type": "solde", "id": "E014"}
