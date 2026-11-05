# Projet 1 — Planning automatisé des équipes postées

## Contexte
Je suis Christophe, Data Analyst BI. Ce dépôt est un **prototype de démonstration** pour un client
industriel (site pétrochimique fonctionnant en continu, équipes postées en 5×8). Aujourd'hui, le
planning des opérateurs est fait à la main (Excel / Power Apps) à partir de données SAP.
Objectif du prototype : montrer qu'un planning peut être **calculé automatiquement** en respectant
les règles de sécurité et de droit du travail, puis **replanifié en quelques secondes** quand une
absence imprévue arrive, avec validation finale par le manager.

Le dépôt est **public** : il ne contient que des **données fictives** et **aucun nom de client**.

## Public
- Un cabinet de conseil et son client (direction d'exploitation, RH, manager de quart) : non techniques.
- Un éventuel relecteur technique : doit pouvoir lancer le projet en 3 commandes.

## Ce que fait le moteur
1. Lit les opérateurs, habilitations, besoins par poste, absences et demandes de repos (`data/`).
2. Part du **cycle 5×8** (5 équipes A à E, motif de 10 jours MM AA NN RRRR, décalage de 2 jours entre équipes).
3. Résout un problème d'optimisation avec **OR-Tools CP-SAT** (`src/planning/solveur.py`) :
   - Règles DURES : habilitation au poste ; pas d'affectation pendant une absence ; un quart par jour ;
     11 h de repos minimum (interdits : A→M, N→M, N→A) ; 6 jours et 3 nuits consécutifs au maximum ;
     plafond de 20 quarts sur 28 jours.
   - Couverture : chaque quart demande 1 chef de quart, 1 opérateur tableau, 2 opérateurs extérieur
     (12 postes par jour). Un trou est très pénalisé et signalé, jamais caché.
   - Objectifs SOUPLES : suivre le cycle, éviter les heures supplémentaires, ne mobiliser les volants
     que pour remplacer, répartir équitablement les nuits des volants, respecter les demandes de repos.
   - Mode **replanification** (`--reference`) : modifier le moins possible le planning publié.
4. Revérifie chaque règle avec un **contrôle indépendant** (`src/planning/controle.py`).
5. Écrit `output/planning.csv`, `output/rapport.json`, `output/anomalies.csv`.

`src/planning/assistant.py` : assistant Claude (API Anthropic ou Vertex AI) qui comprend une demande
en langage naturel (« E009 absent du 23 au 25 décembre »), appelle le moteur et explique la
proposition. Claude ne calcule pas le planning et **ne peut pas publier** : seul le manager valide.

## Résultats de référence (données fictives fournies)
- 24 opérateurs (5 équipes de 4 + 4 volants), horizon du 7 décembre 2026 au 3 janvier 2027.
- 336 postes couverts sur 336, 0 anomalie, 2 quarts supplémentaires (deux chefs de quart absents
  les 15 et 16 décembre, un seul volant habilité chef), calcul ≈ 1 s.
- Replanification : absence imprévue de E009 du 23 au 25/12 → 3 changements, 0 anomalie.
- `output/planning.csv` est le **planning de référence** (celui montré au client) : ne pas l'écraser.
  Pour un nouveau calcul, écrire dans un autre dossier (ex. `output/recalcul`). Un nouveau calcul
  peut donner un planning différent mais tout aussi valide.

## Commandes
```
pip install ortools pandas pyyaml pytest
python generer_donnees_fictives.py --sortie data
python -m planning.main --donnees data --sortie output/recalcul      # PYTHONPATH=src
python -m pytest tests
```
Windows PowerShell : `$env:PYTHONPATH="src"` avant de lancer.

## Travail à faire (dans l'ordre, une étape à la fois)
1. M'expliquer le projet simplement, fichier par fichier, pour que je puisse le présenter.
2. Installer, lancer les tests, générer un calcul dans `output/recalcul`, résumer `rapport.json`.
3. Créer `scripts/generer_page.py` qui transforme `output/planning.csv` (référence, tel quel) +
   `data/employes.csv` + `data/absences.csv` en une page statique `docs/index.html` :
   indicateurs en haut (postes couverts, absences, remplacements par volant, quarts supplémentaires),
   grille opérateurs × dates groupée par équipe, couleurs M (bleu clair), A (bleu moyen),
   N (bleu foncé, texte blanc), repos (gris), absences (orange clair), encadré pour volant et quart
   supplémentaire, légende, mention « Données entièrement fictives ». HTML + CSS, sans dépendance
   externe, lisible sur téléphone (grille dans une zone qui défile horizontalement).
4. Démontrer la replanification (absence E009 du 23 au 25/12) dans `output/replanif` et ajouter
   le résultat à la page.
5. Réécrire le README : objectif, règles, résultats, captures, comment lancer, limites.
6. Commit et push. La page est publiée via GitHub Pages (branche `main`, dossier `/docs`).

## Règles de travail
- Répondre et commenter en **français**.
- Ne jamais inventer de chiffres : tout indicateur vient des fichiers de sortie.
- Aucune donnée réelle, aucun nom de client ou d'entreprise, aucune clé d'API dans le dépôt
  (`.env` est ignoré par git).
- Garder le code simple et commenté : je dois pouvoir l'expliquer.
- Après chaque modification du moteur : relancer `pytest` ; le contrôle doit rester à 0 anomalie.

## Limites à afficher honnêtement
Règles et effectifs fictifs, à recueillir avec les RH et l'exploitation (accord d'entreprise, cycle
réel, habilitations). Pas encore connecté aux données SAP ni à BigQuery (prévu : `bigquery_io.py`).
