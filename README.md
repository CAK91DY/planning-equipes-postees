# Moteur de planning des équipes postées (prototype, données fictives)

## Installation
    pip install ortools pandas pyyaml pytest

## Générer le planning
    python generer_donnees_fictives.py --sortie data
    PYTHONPATH=src python -m planning.main --donnees data --sortie output
    (Windows PowerShell : $env:PYTHONPATH="src"; python -m planning.main --donnees data --sortie output)

Résultat : output/planning.csv (une ligne par affectation), output/rapport.json (indicateurs),
output/anomalies.csv (contrôle indépendant, vide si tout est respecté).

## Replanifier après une absence
Ajouter une ligne dans data/absences.csv, puis :
    PYTHONPATH=src python -m planning.main --donnees data --reference output/planning.csv --sortie output/replanif

## Règles
config/regles.yaml : cycle 5x8, repos 11 h, jours et nuits consécutifs, pondérations.

## Tests
    python -m pytest tests
