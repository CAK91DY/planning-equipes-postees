"""Tests du moteur de planning et de l'assistant (sans appel réel à l'API Claude)."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE / "src"))
sys.path.insert(0, str(RACINE))

from generer_donnees_fictives import generer
from planning.assistant import AssistantPlanning, SessionPlanning
from planning.main import executer

REGLES = RACINE / "config" / "regles.yaml"


@pytest.fixture(scope="module")
def base(tmp_path_factory):
    d = tmp_path_factory.mktemp("cas")
    generer(d / "data")
    rapport = executer(d / "data", REGLES, d / "out", temps_max_s=20)
    return d, rapport


def test_planning_initial_respecte_toutes_les_regles(base):
    _, rapport = base
    assert rapport["statut"] in ("OPTIMAL", "FEASIBLE")
    assert rapport["trous_couverture"] == 0
    assert rapport["anomalies_controle"] == 0
    assert rapport["indicateurs"]["affectations"] == 28 * 12  # 4 postes x 3 quarts x 28 jours


def test_replanification_modifie_peu(base):
    d, _ = base
    scen = d / "scenario"
    shutil.copytree(d / "data", scen)
    with open(scen / "absences.csv", "a") as f:
        f.write("E009,2026-12-23,2026-12-25,ABSENCE_IMPREVUE\n")
    r = executer(scen, REGLES, d / "out_replan", reference=d / "out" / "planning.csv", temps_max_s=20)
    assert r["anomalies_controle"] == 0 and r["trous_couverture"] == 0
    # 3 jours travaillés à remplacer : la solution ne doit pas bouleverser le reste du planning
    assert r["indicateurs"]["modifications_vs_reference"] <= 6
    p = pd.read_csv(d / "out_replan" / "planning.csv")
    assert not ((p.matricule == "E009") & p.date.between("2026-12-23", "2026-12-25")).any()


def test_renfort_ponctuel_pris_en_compte(base):
    d, _ = base
    scen = d / "renfort"
    shutil.copytree(d / "data", scen)
    pd.DataFrame([{"date_debut": "2026-12-14", "date_fin": "2026-12-16", "quart": "N",
                   "poste": "OP_EXTERIEUR", "effectif": 3}]).to_csv(scen / "besoins_specifiques.csv", index=False)
    r = executer(scen, REGLES, d / "out_renfort", temps_max_s=20)
    assert r["anomalies_controle"] == 0
    p = pd.read_csv(d / "out_renfort" / "planning.csv")
    nuit = p[(p.date == "2026-12-15") & (p.quart == "N") & (p.poste == "OP_EXTERIEUR")]
    assert len(nuit) == 3


# ---------- Assistant : client Claude simulé ----------
def _bloc_outil(id_, nom, entree):
    return SimpleNamespace(type="tool_use", id=id_, name=nom, input=entree)


def _texte(t):
    return SimpleNamespace(type="text", text=t)


class FauxClient:
    """Rejoue une suite de réponses comme le ferait Claude, et garde les requêtes reçues."""

    def __init__(self, reponses):
        self.reponses, self.requetes = list(reponses), []
        self.messages = self

    def create(self, **kwargs):
        self.requetes.append(kwargs)
        contenu, stop = self.reponses.pop(0)
        return SimpleNamespace(content=contenu, stop_reason=stop)


def test_assistant_declare_absence_et_simule(base):
    d, _ = base
    session = SessionPlanning(d / "data", REGLES, d / "out" / "planning.csv")
    client = FauxClient([
        ([_bloc_outil("t1", "rechercher_employe", {"texte": "Opérateur 09"})], "tool_use"),
        ([_bloc_outil("t2", "declarer_absence", {"matricule": "E009", "date_debut": "2026-12-23",
                                                 "date_fin": "2026-12-25", "motif": "ABSENCE_IMPREVUE"})], "tool_use"),
        ([_bloc_outil("t3", "simuler_replanification", {})], "tool_use"),
        ([_texte("Proposition prête : Volant 21 remplace Opérateur 09. Validez-vous ?")], "end_turn"),
    ])
    assistant = AssistantPlanning(session, client=client, modele="test")
    reponse = assistant.demander("Opérateur 09 est absent du 23 au 25 décembre")
    assert "Validez" in reponse
    assert [j["outil"] for j in assistant.journal] == ["rechercher_employe", "declarer_absence",
                                                        "simuler_replanification"]
    assert session.proposition is not None
    # La proposition n'est PAS publiée tant que le manager n'a pas validé
    assert ((session.planning.matricule == "E009") & (session.planning.date == "2026-12-23")).any()
    # Les outils exposés à Claude ne permettent pas de publier
    noms_outils = {o["name"] for o in client.requetes[0]["tools"]}
    assert not any("valider" in n or "publier" in n for n in noms_outils)


def test_assistant_refuse_donnees_invalides(base):
    d, _ = base
    session = SessionPlanning(d / "data", REGLES, d / "out" / "planning.csv")
    assert "erreur" in session.declarer_absence("E999", "2026-12-23", "2026-12-25", "CONGES")
    assert "erreur" in session.declarer_absence("E009", "2026-12-23", "2026-12-25", "MALADIE")
    assert "erreur" in session.declarer_absence("E009", "2027-03-01", "2027-03-02", "CONGES")
    assert "erreur" in session.executer_outil("publier_planning", {})
