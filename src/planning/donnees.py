"""Chargement des données d'entrée du planning (CSV en local, BigQuery en production)."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import yaml

QUARTS = ["M", "A", "N"]
REPOS = "R"
# Transitions interdites (veille -> jour) pour respecter 11 h de repos entre deux quarts
TRANSITIONS_INTERDITES = {("A", "M"), ("N", "M"), ("N", "A")}


@dataclass
class Instance:
    """Tout ce dont le solveur a besoin, indépendamment de la source des données."""
    regles: dict
    jours: list[date]
    employes: pd.DataFrame                      # matricule, nom, equipe, poste_habituel
    habilitations: dict[str, set[str]]          # matricule -> postes autorisés
    besoins: dict[tuple[str, str], int]         # (quart, poste) -> effectif requis
    absences: set[tuple[str, date]]             # (matricule, jour) indisponible
    motifs_absence: dict[tuple[str, date], str] = field(default_factory=dict)
    demandes_repos: set[tuple[str, date]] = field(default_factory=set)
    reference: dict[tuple[str, date], tuple[str, str]] | None = None  # planning publié
    # Besoins ponctuels (ex. renfort pendant le grand arrêt) : (jour, quart, poste) -> effectif
    besoins_specifiques: dict[tuple[date, str, str], int] = field(default_factory=dict)

    def besoin(self, jour: date, quart: str, poste: str) -> int:
        return self.besoins_specifiques.get((jour, quart, poste), self.besoins.get((quart, poste), 0))

    @property
    def matricules(self) -> list[str]:
        return self.employes["matricule"].tolist()

    @property
    def postes(self) -> list[str]:
        return sorted({p for (_, p) in self.besoins})


def charger_regles(chemin: Path) -> dict:
    with open(chemin, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _plage(debut: str, fin: str) -> list[date]:
    d0, d1 = date.fromisoformat(debut), date.fromisoformat(fin)
    return [d0 + timedelta(days=i) for i in range((d1 - d0).days + 1)]


def charger_csv(dossier: Path, regles: dict, reference_csv: Path | None = None) -> Instance:
    """Charge l'instance depuis les CSV produits par le mart dbt (ou le générateur fictif)."""
    h = regles["horizon"]
    d0 = date.fromisoformat(h["date_debut"])
    jours = [d0 + timedelta(days=i) for i in range(h["nb_jours"])]

    employes = pd.read_csv(dossier / "employes.csv")
    hab = pd.read_csv(dossier / "habilitations.csv")
    habilitations = hab.groupby("matricule")["poste"].apply(set).to_dict()
    besoins_df = pd.read_csv(dossier / "besoins.csv")
    besoins = {(r.quart, r.poste): int(r.effectif) for r in besoins_df.itertuples()}

    absences, motifs = set(), {}
    chemin_abs = dossier / "absences.csv"
    if chemin_abs.exists():
        for r in pd.read_csv(chemin_abs).itertuples():
            for j in _plage(r.date_debut, r.date_fin):
                absences.add((r.matricule, j))
                motifs[(r.matricule, j)] = r.motif

    demandes = set()
    chemin_dem = dossier / "demandes.csv"
    if chemin_dem.exists():
        for r in pd.read_csv(chemin_dem).itertuples():
            if r.type == "REPOS_SOUHAITE":
                demandes.add((r.matricule, date.fromisoformat(r.date)))

    specifiques = {}
    chemin_spe = dossier / "besoins_specifiques.csv"
    if chemin_spe.exists():
        for r in pd.read_csv(chemin_spe).itertuples():
            for j in _plage(r.date_debut, r.date_fin):
                specifiques[(j, r.quart, r.poste)] = int(r.effectif)

    reference = None
    if reference_csv is not None:
        ref = pd.read_csv(reference_csv)
        reference = {(r.matricule, date.fromisoformat(r.date)): (r.quart, r.poste)
                     for r in ref.itertuples()}

    return Instance(regles, jours, employes, habilitations, besoins, absences,
                    motifs, demandes, reference, specifiques)


def quart_du_cycle(regles: dict, equipe: str, jour: date) -> str:
    """Quart prévu par le cycle 5x8 pour une équipe un jour donné ('R' = repos)."""
    if equipe not in regles["cycle"]["decalage_equipes"]:
        return REPOS  # volants : pas de cycle
    motif = regles["cycle"]["motif"]
    ref = date.fromisoformat(regles["cycle"]["date_reference"])
    idx = ((jour - ref).days + regles["cycle"]["decalage_equipes"][equipe]) % len(motif)
    return motif[idx]
