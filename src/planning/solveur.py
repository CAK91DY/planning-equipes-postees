"""Moteur de planning des équipes postées — programmation par contraintes (OR-Tools CP-SAT).

Principe :
- Règles DURES (jamais violées) : habilitations, absences, un quart par jour,
  11 h de repos, jours et nuits consécutifs maximum, plafond de quarts.
- Couverture des postes : dure en pratique (pénalité très forte) ; si elle est
  impossible, le trou est signalé au lieu de rendre un planning faux.
- Objectifs SOUPLES : suivre le cycle 5x8, limiter les heures supplémentaires,
  respecter les demandes de repos, répartir équitablement les nuits des volants,
  et en mode replanification modifier le moins possible le planning publié.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

import pandas as pd
from ortools.sat.python import cp_model

from .donnees import QUARTS, REPOS, TRANSITIONS_INTERDITES, Instance, quart_du_cycle


@dataclass
class Resultat:
    statut: str
    planning: pd.DataFrame          # date, matricule, nom, equipe, quart, poste, origine
    trous: pd.DataFrame             # date, quart, poste, manquants
    objectif: float
    temps_s: float


def resoudre(inst: Instance, temps_max_s: float = 30.0, graine: int = 0) -> Resultat:
    regles, poids = inst.regles["regles_dures"], inst.regles["pondérations"]
    m = cp_model.CpModel()
    J, E = range(len(inst.jours)), inst.matricules
    equipe = dict(zip(inst.employes.matricule, inst.employes.equipe))
    poste_hab = dict(zip(inst.employes.matricule, inst.employes.poste_habituel))
    prevu = {(e, j): quart_du_cycle(inst.regles, equipe[e], inst.jours[j]) for e in E for j in J}

    # x[e, j, q, p] = 1 si e tient le poste p au quart q le jour j
    x = {}
    for e in E:
        for j in J:
            if (e, inst.jours[j]) in inst.absences:
                continue  # règle dure : pas d'affectation pendant une absence
            for q in QUARTS:
                for p in inst.habilitations.get(e, ()):
                    x[e, j, q, p] = m.NewBoolVar(f"x_{e}_{j}_{q}_{p}")

    # Index pour construire les sommes sans parcourir toutes les variables
    par_ejq, par_jqp = {}, {}
    for (e, j, q, p), var in x.items():
        par_ejq.setdefault((e, j, q), []).append(var)
        par_jqp.setdefault((j, q, p), []).append(var)

    # t[e, j, q] = 1 si e travaille au quart q le jour j
    t = {(e, j, q): sum(par_ejq.get((e, j, q), [])) for e in E for j in J for q in QUARTS}
    w = {(e, j): sum(t[e, j, q] for q in QUARTS) for e in E for j in J}

    # 1. Un seul quart par jour
    for e in E:
        for j in J:
            m.Add(w[e, j] <= 1)

    # 2. Couverture des besoins (avec variable d'écart très pénalisée)
    trous, surplus = {}, {}
    for j in J:
        for (q, p) in inst.besoins:
            besoin = inst.besoin(inst.jours[j], q, p)
            trous[j, q, p] = m.NewIntVar(0, besoin, f"trou_{j}_{q}_{p}")
            surplus[j, q, p] = m.NewIntVar(0, len(E), f"surplus_{j}_{q}_{p}")
            m.Add(sum(par_jqp.get((j, q, p), [])) + trous[j, q, p] - surplus[j, q, p] == besoin)

    # 3. Repos de 11 h : transitions interdites, y compris depuis la veille de l'horizon
    veille = inst.jours[0] - timedelta(days=1)
    for e in E:
        q_veille = quart_du_cycle(inst.regles, equipe[e], veille)
        for (q1, q2) in TRANSITIONS_INTERDITES:
            if q_veille == q1:
                m.Add(t[e, 0, q2] == 0)
            for j in J[:-1]:
                m.Add(t[e, j, q1] + t[e, j + 1, q2] <= 1)

    # 4. Jours consécutifs et nuits consécutives (fenêtres glissantes)
    def fenetres(n_max, expr):
        for e in E:
            for j in range(len(J) - n_max):
                m.Add(sum(expr(e, k) for k in range(j, j + n_max + 1)) <= n_max)

    fenetres(regles["max_jours_consecutifs"], lambda e, k: w[e, k])
    fenetres(regles["max_nuits_consecutives"], lambda e, k: t[e, k, "N"])
    # Prise en compte des jours déjà travaillés avant l'horizon (selon le cycle)
    for e in E:
        deja = 0
        while deja < regles["max_jours_consecutifs"] and quart_du_cycle(
                inst.regles, equipe[e], inst.jours[0] - timedelta(days=deja + 1)) != REPOS:
            deja += 1
        reste = regles["max_jours_consecutifs"] - deja
        if deja and reste < len(J):
            m.Add(sum(w[e, k] for k in range(reste + 1)) <= reste)

    # 5. Plafond de quarts sur l'horizon
    for e in E:
        m.Add(sum(w[e, j] for j in J) <= regles["max_quarts_horizon"])

    # ---------------- Objectif ----------------
    cout = [poids["trou_couverture"] * v for v in trous.values()]
    cout += [poids["sureffectif"] * v for v in surplus.values()]
    for e in E:
        for j in J:
            jour = inst.jours[j]
            if inst.reference is not None:
                # Mode replanification : stabilité par rapport au planning publié
                ref_q, ref_p = inst.reference.get((e, jour), (REPOS, None))
                if ref_q == REPOS:
                    cout.append(poids["modification_vs_reference"] * w[e, j])
                else:
                    garde = x.get((e, j, ref_q, ref_p), 0)
                    cout.append(poids["modification_vs_reference"] * (1 - garde))
                continue
            q_prevu = prevu[e, j]
            if equipe[e] == "VOLANT":
                continue
            if q_prevu == REPOS:
                # Travailler un jour de repos = écart au cycle + heure supplémentaire
                cout.append((poids["ecart_cycle"] + poids["quart_supplementaire"]) * w[e, j])
            elif (e, jour) not in inst.absences:
                cout.append(poids["ecart_cycle"] * (1 - t[e, j, q_prevu]))
            # Poste différent du poste habituel
            for q in QUARTS:
                for p in inst.habilitations.get(e, ()):
                    if p != poste_hab[e] and (e, j, q, p) in x:
                        cout.append(poids["changement_poste"] * x[e, j, q, p])

    # Demandes de repos
    for (e, jour) in inst.demandes_repos:
        if jour in inst.jours and e in E:
            cout.append(poids["demande_non_respectee"] * w[e, inst.jours.index(jour)])

    # Volants : mobilisés seulement pour remplacer ; charge et nuits réparties équitablement
    volants = [e for e in E if equipe[e] == "VOLANT"]
    if len(volants) > 1 and inst.reference is None:
        def ecart_max_min(nom, valeurs):
            hi, lo = m.NewIntVar(0, len(J), f"{nom}_max"), m.NewIntVar(0, len(J), f"{nom}_min")
            m.AddMaxEquality(hi, valeurs)
            m.AddMinEquality(lo, valeurs)
            return hi - lo
        cout.append(poids["equite_charge_volants"] * ecart_max_min(
            "charge", [sum(w[e, j] for j in J) for e in volants]))
        cout.append(poids["equite_nuits_volants"] * ecart_max_min(
            "nuits", [sum(t[e, j, "N"] for j in J) for e in volants]))

    m.Minimize(sum(cout))

    solveur = cp_model.CpSolver()
    solveur.parameters.max_time_in_seconds = temps_max_s
    solveur.parameters.num_workers = 8
    solveur.parameters.random_seed = graine
    statut = solveur.Solve(m)
    nom_statut = solveur.StatusName(statut)
    if statut not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return Resultat(nom_statut, pd.DataFrame(), pd.DataFrame(), float("nan"), solveur.WallTime())

    noms = dict(zip(inst.employes.matricule, inst.employes.nom))
    lignes = []
    for (e, j, q, p), var in x.items():
        if solveur.Value(var):
            jour = inst.jours[j]
            if inst.reference is not None:
                origine = "INCHANGE" if inst.reference.get((e, jour)) == (q, p) else "MODIFIE"
            elif equipe[e] == "VOLANT":
                origine = "VOLANT"
            elif prevu[e, j] == REPOS:
                origine = "QUART_SUPPLEMENTAIRE"
            elif prevu[e, j] != q:
                origine = "ECHANGE_QUART"
            else:
                origine = "CYCLE"
            lignes.append({"date": jour.isoformat(), "matricule": e, "nom": noms[e],
                           "equipe": equipe[e], "quart": q, "poste": p, "origine": origine})
    planning = pd.DataFrame(lignes).sort_values(["date", "quart", "poste", "matricule"]).reset_index(drop=True)
    manques = [{"date": inst.jours[j].isoformat(), "quart": q, "poste": p, "manquants": solveur.Value(v)}
               for (j, q, p), v in trous.items() if solveur.Value(v) > 0]
    return Resultat(nom_statut, planning, pd.DataFrame(manques, columns=["date", "quart", "poste", "manquants"]),
                    solveur.ObjectiveValue(), solveur.WallTime())
