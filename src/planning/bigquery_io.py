"""Lecture des entrées depuis les marts dbt et écriture du planning dans BigQuery.

Les marts `marts_planning.*` exposent exactement les colonnes des CSV attendus par
`donnees.charger_csv` : le solveur est donc identique en local et en production.
"""
from __future__ import annotations

import argparse
import os
import tempfile
from pathlib import Path

import pandas as pd

TABLES_ENTREE = {
    "employes": "planning_employes",
    "habilitations": "planning_habilitations",
    "besoins": "planning_besoins",
    "besoins_specifiques": "planning_besoins_specifiques",
    "absences": "planning_absences",
    "demandes": "planning_demandes",
}


def exporter_entrees(projet: str, dataset: str, dossier: Path) -> Path:
    from google.cloud import bigquery
    client = bigquery.Client(project=projet)
    dossier.mkdir(parents=True, exist_ok=True)
    for fichier, table in TABLES_ENTREE.items():
        df = client.query(f"SELECT * FROM `{projet}.{dataset}.{table}`").to_dataframe()
        for col in df.columns:
            if col.startswith("date"):
                df[col] = pd.to_datetime(df[col]).dt.strftime("%Y-%m-%d")
        df.to_csv(dossier / f"{fichier}.csv", index=False)
    return dossier


def ecrire_planning(projet: str, dataset: str, table: str, planning: pd.DataFrame, id_execution: str) -> None:
    from google.cloud import bigquery
    client = bigquery.Client(project=projet)
    df = planning.assign(date=pd.to_datetime(planning["date"]).dt.date, id_execution=id_execution,
                         genere_le=pd.Timestamp.now(tz="UTC"))
    config = bigquery.LoadJobConfig(write_disposition="WRITE_APPEND")
    client.load_table_from_dataframe(df, f"{projet}.{dataset}.{table}", job_config=config).result()


def main() -> None:
    """Entrée du Cloud Run Job : BigQuery -> solveur -> table des propositions."""
    from .main import executer
    p = argparse.ArgumentParser()
    p.add_argument("--projet", default=os.getenv("GCP_PROJECT"))
    p.add_argument("--dataset-entrees", default="marts_planning")
    p.add_argument("--dataset-sortie", default="raw_planning")
    p.add_argument("--regles", type=Path, default=Path("config/regles.yaml"))
    a = p.parse_args()
    id_execution = os.getenv("CLOUD_RUN_EXECUTION", "local")
    with tempfile.TemporaryDirectory() as tmp:
        entrees = exporter_entrees(a.projet, a.dataset_entrees, Path(tmp) / "entrees")
        rapport = executer(entrees, a.regles, Path(tmp) / "sortie")
        if rapport.get("anomalies_controle", 1) != 0:
            raise SystemExit(f"Planning rejeté par le contrôle : {rapport}")
        planning = pd.read_csv(Path(tmp) / "sortie" / "planning.csv")
        # Écrit comme PROPOSITION : la publication reste une validation humaine dans l'application
        ecrire_planning(a.projet, a.dataset_sortie, "planning_propositions", planning, id_execution)
    print(rapport)


if __name__ == "__main__":
    main()
