"""Contrôle INDÉPENDANT d'un planning : relit le fichier de sortie et revérifie chaque règle.

Ce module ne réutilise pas le modèle du solveur : il sert de garde-fou, y compris
pour un planning modifié à la main par un manager ou proposé par l'assistant IA.
"""
from __future__ import annotations

from datetime import date, timedelta

import pandas as pd

from .donnees import QUARTS, REPOS, TRANSITIONS_INTERDITES, Instance, quart_du_cycle


def controler(inst: Instance, planning: pd.DataFrame) -> pd.DataFrame:
    """Retourne la liste des anomalies (vide si le planning respecte toutes les règles)."""
    r = inst.regles["regles_dures"]
    equipe = dict(zip(inst.employes.matricule, inst.employes.equipe))
    anomalies = []

    def ano(regle, detail, matricule="", jour=""):
        anomalies.append({"regle": regle, "matricule": matricule, "date": str(jour), "detail": detail})

    affect = {}
    for row in planning.itertuples():
        cle = (row.matricule, date.fromisoformat(row.date))
        if cle in affect:
            ano("UN_QUART_PAR_JOUR", "plusieurs affectations le même jour", *cle)
        affect[cle] = (row.quart, row.poste)
        if row.poste not in inst.habilitations.get(row.matricule, set()):
            ano("HABILITATION", f"non habilité au poste {row.poste}", *cle)
        if cle in inst.absences:
            ano("ABSENCE", "affecté pendant une absence", *cle)

    # Couverture
    for jour in inst.jours:
        for (q, p) in inst.besoins:
            besoin = inst.besoin(jour, q, p)
            n = sum(1 for (e, d), (qq, pp) in affect.items() if d == jour and qq == q and pp == p)
            if n < besoin:
                ano("COUVERTURE", f"{q}/{p} : {n} sur {besoin} requis", jour=jour)

    # Règles par personne, en tenant compte de la veille (cycle)
    for e in inst.matricules:
        veille = inst.jours[0] - timedelta(days=1)
        suite = [quart_du_cycle(inst.regles, equipe[e], veille)]
        suite += [affect.get((e, j), (REPOS, None))[0] for j in inst.jours]
        jours = [veille] + inst.jours
        for k in range(1, len(suite)):
            if (suite[k - 1], suite[k]) in TRANSITIONS_INTERDITES:
                ano("REPOS_11H", f"{suite[k-1]} puis {suite[k]}", e, jours[k])
        # Jours consécutifs (avec l'historique du cycle avant l'horizon)
        consec, k0 = 0, 1
        while k0 <= r["max_jours_consecutifs"] and quart_du_cycle(
                inst.regles, equipe[e], inst.jours[0] - timedelta(days=k0)) != REPOS:
            consec += 1
            k0 += 1
        nuits = 0
        for k, q in enumerate(suite[1:]):
            consec = consec + 1 if q in QUARTS else 0
            nuits = nuits + 1 if q == "N" else 0
            if consec > r["max_jours_consecutifs"]:
                ano("JOURS_CONSECUTIFS", f"{consec} jours de suite", e, inst.jours[k])
            if nuits > r["max_nuits_consecutives"]:
                ano("NUITS_CONSECUTIVES", f"{nuits} nuits de suite", e, inst.jours[k])
        total = sum(1 for q in suite[1:] if q in QUARTS)
        if total > r["max_quarts_horizon"]:
            ano("PLAFOND_QUARTS", f"{total} quarts sur l'horizon", e)

    return pd.DataFrame(anomalies, columns=["regle", "matricule", "date", "detail"])


def indicateurs(inst: Instance, planning: pd.DataFrame) -> dict:
    """Indicateurs de qualité du planning, pour le manager et le tableau de bord."""
    origine = planning["origine"].value_counts().to_dict() if len(planning) else {}
    par_pers = planning.groupby("matricule").size()
    nuits = planning[planning.quart == "N"].groupby("matricule").size()
    volants = inst.employes[inst.employes.equipe == "VOLANT"].matricule
    return {
        "affectations": len(planning),
        "par_origine": {k: int(v) for k, v in origine.items()},
        "quarts_supplementaires": int(origine.get("QUART_SUPPLEMENTAIRE", 0)),
        "modifications_vs_reference": int(origine.get("MODIFIE", 0)),
        "quarts_par_personne_min": int(par_pers.min()) if len(par_pers) else 0,
        "quarts_par_personne_max": int(par_pers.max()) if len(par_pers) else 0,
        "nuits_volants": {v: int(nuits.get(v, 0)) for v in volants},
        "demandes_repos_respectees": sum(
            1 for (e, d) in inst.demandes_repos
            if not ((planning.matricule == e) & (planning.date == d.isoformat())).any()),
        "demandes_repos_total": len(inst.demandes_repos),
    }
