"""Point d'entrée en ligne de commande (exécuté en local ou comme Cloud Run Job).

Exemples :
  # Générer le planning du mois à partir du cycle 5x8
  python -m planning.main --donnees data --sortie output

  # Replanifier après une nouvelle absence, en modifiant le moins possible le planning publié
  python -m planning.main --donnees data --reference output/planning.csv --sortie output/replanif
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from .controle import controler, indicateurs
from .donnees import charger_csv, charger_regles
from .solveur import resoudre


def executer(donnees: Path, regles: Path, sortie: Path, reference: Path | None = None,
             temps_max_s: float = 30.0) -> dict:
    inst = charger_csv(donnees, charger_regles(regles), reference)
    res = resoudre(inst, temps_max_s=temps_max_s)
    sortie.mkdir(parents=True, exist_ok=True)
    if res.planning.empty:
        rapport = {"statut": res.statut, "message": "aucun planning trouvé"}
    else:
        anomalies = controler(inst, res.planning)
        res.planning.to_csv(sortie / "planning.csv", index=False)
        res.trous.to_csv(sortie / "trous_couverture.csv", index=False)
        anomalies.to_csv(sortie / "anomalies.csv", index=False)
        rapport = {
            "statut": res.statut,
            "temps_resolution_s": round(res.temps_s, 2),
            "objectif": res.objectif,
            "trous_couverture": int(res.trous["manquants"].sum()) if len(res.trous) else 0,
            "anomalies_controle": len(anomalies),
            "indicateurs": indicateurs(inst, res.planning),
        }
    (sortie / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2), encoding="utf-8")
    return rapport


def main() -> None:
    p = argparse.ArgumentParser(description="Planning automatisé des équipes postées")
    p.add_argument("--donnees", type=Path, default=Path("data"))
    p.add_argument("--regles", type=Path, default=Path("config/regles.yaml"))
    p.add_argument("--sortie", type=Path, default=Path("output"))
    p.add_argument("--reference", type=Path, default=None, help="planning publié (mode replanification)")
    p.add_argument("--temps-max", type=float, default=30.0)
    a = p.parse_args()
    print(json.dumps(executer(a.donnees, a.regles, a.sortie, a.reference, a.temps_max),
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
