"""Prépare le planning interactif (docs/interactif/donnees.js) sur une équipe resserrée.

Pour que le planning tienne sur un écran, la version interactive utilise 5 équipes de 3 personnes
(1 chef de quart, 1 opérateur tableau, 1 opérateur extérieur) et 2 volants, soit 17 personnes.
Les règles sont celles du projet (config/regles.yaml : cycle 5x8, 11 h de repos, séries, plafond).

Étapes (reproductibles) :
  1. écrit les données d'entrée dans output/interactif/donnees/ (même format que data/) ;
  2. calcule le planning de RÉFÉRENCE avec le moteur OR-Tools -> output/interactif/ ;
  3. calcule avec OR-Tools le scénario de démonstration (E007 absent du 23 au 25/12)
     -> output/interactif/replanif/ (sert à vérifier que le moteur de la page donne le même résultat) ;
  4. écrit docs/interactif/donnees.js (prénoms et compteurs de congés : exemples).

Le jeu de 24 opérateurs de data/ et le planning de référence output/planning.csv ne changent pas.

Lancer depuis la racine du dépôt :  python scripts/generer_donnees_interactif.py
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import pandas as pd
import yaml

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE / "src"))
from planning.main import executer  # noqa: E402

REGLES = RACINE / "config" / "regles.yaml"
DOSSIER = RACINE / "output" / "interactif"
SORTIE_JS = RACINE / "docs" / "interactif" / "donnees.js"

HABILITATIONS = {"CHEF_QUART": ["CHEF_QUART", "OP_TABLEAU", "OP_EXTERIEUR"],
                 "OP_TABLEAU": ["OP_TABLEAU", "OP_EXTERIEUR"], "OP_EXTERIEUR": ["OP_EXTERIEUR"]}
PRENOMS = ["Julien M.", "Sarah B.", "Mehdi K.", "Nicolas F.", "Camille R.", "Yassine D.", "Antoine L.", "Inès G.",
           "Romain C.", "Karim H.", "Manon S.", "Thomas A.", "Damien O.", "Chloé J.", "Hugo E.", "Olivier W.", "Aurélie Q."]
# Absences connues avant le calcul (validées) : deux chefs de quart absents en même temps les 15 et 16/12
ABSENCES = [("E002", "2026-12-21", "2026-12-27", "CONGES"), ("E006", "2026-12-24", "2027-01-01", "CONGES"),
            ("E009", "2026-12-09", "2026-12-11", "MALADIE"), ("E010", "2026-12-15", "2026-12-16", "FORMATION"),
            ("E004", "2026-12-14", "2026-12-18", "CONGES"), ("E014", "2026-12-28", "2027-01-03", "CONGES"),
            ("E017", "2026-12-26", "2026-12-31", "CONGES")]
DEMANDES = [("E003", "2026-12-25"), ("E016", "2026-12-31"), ("E012", "2026-12-24")]
SCENARIO = {"matricule": "E007", "date_debut": "2026-12-23", "date_fin": "2026-12-25", "motif": "ABSENCE_IMPREVUE"}
TYPE_ABSENCE = {"CONGES": "CP", "MALADIE": "ARRET", "FORMATION": "FORMATION", "ABSENCE_IMPREVUE": "ARRET"}


def ecrire_entrees(dossier: Path) -> pd.DataFrame:
    dossier.mkdir(parents=True, exist_ok=True)
    employes, hab = [], []
    num = 1
    for equipe in "ABCDE":
        for role in ["CHEF_QUART", "OP_TABLEAU", "OP_EXTERIEUR"]:
            employes.append({"matricule": f"E{num:03d}", "nom": PRENOMS[num - 1], "equipe": equipe, "poste_habituel": role})
            num += 1
    for role in ["CHEF_QUART", "OP_TABLEAU"]:                                   # 2 volants
        employes.append({"matricule": f"E{num:03d}", "nom": PRENOMS[num - 1], "equipe": "VOLANT", "poste_habituel": role})
        num += 1
    for e in employes:
        hab += [{"matricule": e["matricule"], "poste": p} for p in HABILITATIONS[e["poste_habituel"]]]
    emp = pd.DataFrame(employes)
    emp.to_csv(dossier / "employes.csv", index=False)
    pd.DataFrame(hab).to_csv(dossier / "habilitations.csv", index=False)
    pd.DataFrame([{"poste": p, "quart": q, "effectif": 1} for q in "MAN" for p in HABILITATIONS])\
        .to_csv(dossier / "besoins.csv", index=False)
    pd.DataFrame(ABSENCES, columns=["matricule", "date_debut", "date_fin", "motif"]).to_csv(dossier / "absences.csv", index=False)
    pd.DataFrame([{"matricule": m, "date": d, "type": "REPOS_SOUHAITE"} for m, d in DEMANDES])\
        .to_csv(dossier / "demandes.csv", index=False)
    return emp


def main() -> None:
    regles = yaml.safe_load(REGLES.read_text(encoding="utf-8"))
    emp = ecrire_entrees(DOSSIER / "donnees")

    # 2. Planning de référence (OR-Tools)
    rapport = executer(DOSSIER / "donnees", REGLES, DOSSIER)
    assert rapport["anomalies_controle"] == 0 and rapport["trous_couverture"] == 0, rapport
    # 3. Scénario de démonstration recalculé par OR-Tools (stabilité vs planning publié)
    scen = DOSSIER / "replanif" / "donnees"
    if scen.exists():
        shutil.rmtree(scen)
    shutil.copytree(DOSSIER / "donnees", scen)
    abs_scen = pd.read_csv(scen / "absences.csv")
    pd.concat([abs_scen, pd.DataFrame([SCENARIO])]).to_csv(scen / "absences.csv", index=False)
    rapport_replan = executer(scen, REGLES, DOSSIER / "replanif", reference=DOSSIER / "planning.csv")

    # 4. Données de la page
    planning = pd.read_csv(DOSSIER / "planning.csv")
    hab = pd.read_csv(DOSSIER / "donnees" / "habilitations.csv")
    collaborateurs = []
    for i, r in enumerate(emp.itertuples()):
        postes = [r.poste_habituel] + [p for p in hab[hab.matricule == r.matricule].poste if p != r.poste_habituel]
        collaborateurs.append({"id": r.matricule, "nom": r.nom, "equipe": r.equipe, "habilitations": postes,
                               "soldes": {"CP": 8 + (i * 7) % 17, "RTT": 1 + (i * 3) % 5}})   # compteurs d'exemple
    liste_abs = [{"num": k + 1, "id": m, "type": TYPE_ABSENCE[motif], "debut": d1, "fin": d2,
                  "statut": "validee", "source": "manager"} for k, (m, d1, d2, motif) in enumerate(ABSENCES)]
    # Deux demandes en attente, posées sur des jours réellement travaillés
    travaille = lambda m: planning[planning.matricule == m].date.tolist()
    rtt = next(d for d in travaille("E005") if d >= "2026-12-26")
    cp = [d for d in travaille("E011") if "2026-12-21" <= d <= "2026-12-31"][:2]
    liste_abs += [
        {"num": len(liste_abs) + 1, "id": "E005", "type": "RTT", "debut": rtt, "fin": rtt, "statut": "en_attente", "source": "collaborateur"},
        {"num": len(liste_abs) + 2, "id": "E011", "type": "CP", "debut": cp[0], "fin": cp[-1], "statut": "en_attente", "source": "collaborateur"},
    ]
    donnees = {
        "horizon": {"debut": regles["horizon"]["date_debut"], "nb_jours": regles["horizon"]["nb_jours"]},
        "quarts": {q: {"libelle": {"M": "Matin", "A": "Après-midi", "N": "Nuit"}[q], "horaire": f"{int(h[0][:2])} h–{int(h[1][:2])} h"}
                   for q, h in regles["quarts"].items()},
        "postes": {"CHEF_QUART": "Chef de quart", "OP_TABLEAU": "Opérateur tableau", "OP_EXTERIEUR": "Opérateur extérieur"},
        "cycle": regles["cycle"],
        "regles": regles["regles_dures"],
        "transitions_interdites": [["A", "M"], ["N", "M"], ["N", "A"]],
        "besoins": {q: {p: 1 for p in HABILITATIONS} for q in "MAN"},
        "types_absence": {
            "CP": {"libelle": "Congés payés", "court": "CP", "compteur": "CP", "sur_demande": True},
            "RTT": {"libelle": "RTT", "court": "RTT", "compteur": "RTT", "sur_demande": True},
            "FORMATION": {"libelle": "Formation", "court": "Form.", "compteur": None, "sur_demande": False},
            "ARRET": {"libelle": "Arrêt / absence imprévue", "court": "Abs.", "compteur": None, "sur_demande": False},
        },
        "collaborateurs": collaborateurs,
        "absences": liste_abs,
        "demandes_repos": [{"id": m, "jour": d} for m, d in DEMANDES],
        "planning_reference": [[r.matricule, r.date, r.quart, r.poste] for r in planning.itertuples()],
    }
    SORTIE_JS.write_text(
        "/* Généré par scripts/generer_donnees_interactif.py — ne pas modifier à la main.\n"
        "   Planning de départ : output/interactif/planning.csv (OR-Tools). Prénoms et compteurs : exemples. */\n"
        f"const DONNEES_PLANNING = {json.dumps(donnees, ensure_ascii=False, indent=1)};\n"
        'if (typeof module !== "undefined") module.exports = DONNEES_PLANNING;\n', encoding="utf-8")
    ind = rapport["indicateurs"]
    print(f"Référence OR-Tools : {rapport['statut']}, {ind['affectations']} postes, {ind['par_origine']}, "
          f"{rapport['anomalies_controle']} anomalie, {rapport['temps_resolution_s']} s")
    print(f"Scénario E007 : {rapport_replan['indicateurs']['modifications_vs_reference']} changement(s), "
          f"{rapport_replan['anomalies_controle']} anomalie, {rapport_replan['trous_couverture']} trou")
    print(f"Demandes en attente : RTT E005 le {rtt}, CP E011 du {cp[0]} au {cp[-1]}")


if __name__ == "__main__":
    main()
