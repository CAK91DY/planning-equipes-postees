"""Génère la page statique docs/index.html à partir du planning de RÉFÉRENCE (output/planning.csv).

Entrées (lues telles quelles, jamais modifiées) :
  output/planning.csv        planning de référence : une ligne par affectation
  output/rapport.json        indicateurs du calcul (temps, statut, demandes de repos)
  output/anomalies.csv       résultat du contrôle indépendant
  data/employes.csv          opérateurs, équipes, postes habituels
  data/absences.csv          absences (le motif n'est PAS affiché : « Abs » seulement)
  data/besoins.csv           postes requis par quart
  config/regles.yaml         horizon du planning
  output/replanif/           (facultatif) démonstration de replanification, ajoutée si présente

Aucun chiffre n'est écrit en dur : tout indicateur vient de ces fichiers.
La page est un seul fichier HTML + CSS, sans JavaScript ni dépendance externe.

Lancer depuis la racine du dépôt :  python scripts/generer_page.py
"""
from __future__ import annotations

import argparse
import html
import json
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import yaml

RACINE = Path(__file__).resolve().parents[1]

LIBELLES_POSTE = {"CHEF_QUART": "Chef de quart", "OP_TABLEAU": "Op. tableau", "OP_EXTERIEUR": "Op. extérieur"}
PLURIEL_POSTE = {"CHEF_QUART": "chefs de quart", "OP_TABLEAU": "opérateurs tableau",
                 "OP_EXTERIEUR": "opérateurs extérieur"}
LIBELLES_QUART = {"M": "Matin 6 h–14 h", "A": "Après-midi 14 h–22 h", "N": "Nuit 22 h–6 h"}
# Motifs regroupés pour l'affichage public : aucun détail médical n'apparaît sur la page
FAMILLE_MOTIF = {"CONGES": "congés", "FORMATION": "formation", "MALADIE": "imprévu",
                 "ABSENCE_IMPREVUE": "imprévu", "AUTRE": "autre"}
# Règles revérifiées par src/planning/controle.py (codes des anomalies possibles)
REGLES_CONTROLEES = ["UN_QUART_PAR_JOUR", "HABILITATION", "ABSENCE", "COUVERTURE", "REPOS_11H",
                     "JOURS_CONSECUTIFS", "NUITS_CONSECUTIVES", "PLAFOND_QUARTS"]
JOURS_COURTS = ["L", "M", "M", "J", "V", "S", "D"]
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre",
        "octobre", "novembre", "décembre"]

e = html.escape


def date_longue(d: date) -> str:
    return f"{d.day} {MOIS[d.month - 1]} {d.year}"


def nombre(x: float, decimales: int = 0) -> str:
    """Format français : 1234.5 -> '1 234,5'."""
    return f"{x:,.{decimales}f}".replace(",", " ").replace(".", ",")


def liste_fr(elements: list[str]) -> str:
    """['a', 'b', 'c'] -> 'a, b et c'."""
    return elements[0] if len(elements) == 1 else ", ".join(elements[:-1]) + " et " + elements[-1]


# ------------------------------------------------------------------ lecture
def jours_d_absence(absences: pd.DataFrame, jours: list[date]) -> dict:
    """(matricule, date) -> motif, pour chaque jour d'absence compris dans l'horizon."""
    resultat = {}
    for r in absences.itertuples():
        d, fin = date.fromisoformat(r.date_debut), date.fromisoformat(r.date_fin)
        while d <= fin:
            if jours[0] <= d <= jours[-1]:
                resultat[(r.matricule, d)] = r.motif
            d += timedelta(days=1)
    return resultat


def charger(sortie: Path, donnees: Path, regles: Path) -> dict:
    cfg = yaml.safe_load(regles.read_text(encoding="utf-8"))
    d0 = date.fromisoformat(cfg["horizon"]["date_debut"])
    jours = [d0 + timedelta(days=i) for i in range(cfg["horizon"]["nb_jours"])]

    absences = pd.read_csv(donnees / "absences.csv")
    jours_absence = jours_d_absence(absences, jours)

    return {
        "jours": jours,
        "planning": pd.read_csv(sortie / "planning.csv"),
        "rapport": json.loads((sortie / "rapport.json").read_text(encoding="utf-8")),
        "anomalies": pd.read_csv(sortie / "anomalies.csv"),
        "employes": pd.read_csv(donnees / "employes.csv"),
        "besoins": pd.read_csv(donnees / "besoins.csv"),
        "absences": absences,
        "jours_absence": jours_absence,
    }


# ------------------------------------------------------------------ indicateurs (tous calculés)
def calculer_indicateurs(d: dict) -> list[tuple[str, str, str]]:
    p, jours, besoins = d["planning"], d["jours"], d["besoins"]

    # Postes couverts : pour chaque jour x quart x poste, min(personnes affectées, besoin)
    requis_par_quart = besoins.groupby("quart").effectif.sum()
    total_requis = int(besoins.effectif.sum()) * len(jours)
    affectes = p.groupby(["date", "quart", "poste"]).size()
    couverts = sum(min(int(affectes.get((j.isoformat(), r.quart, r.poste), 0)), int(r.effectif))
                   for j in jours for r in besoins.itertuples())
    nb_quarts, postes_par_quart = len(requis_par_quart), int(requis_par_quart.iloc[0])

    # Règles respectées : part des règles contrôlées sans aucune anomalie
    regles_en_defaut = set(d["anomalies"].regle) if len(d["anomalies"]) else set()
    part_ok = (len(REGLES_CONTROLEES) - len(regles_en_defaut & set(REGLES_CONTROLEES))) / len(REGLES_CONTROLEES)
    nb_ano = len(d["anomalies"])

    # Absences : périodes d'absence qui touchent l'horizon, motifs regroupés (sans détail médical)
    abs_horizon = d["absences"][d["absences"].apply(
        lambda r: r.date_debut <= jours[-1].isoformat() and r.date_fin >= jours[0].isoformat(), axis=1)]
    ordre_familles = list(dict.fromkeys(FAMILLE_MOTIF.values()))     # congés, formation, imprévu, autre
    presentes = {FAMILLE_MOTIF.get(m, "autre") for m in abs_horizon.motif}
    familles = [f for f in ordre_familles if f in presentes]

    # Volants et quarts supplémentaires
    volants = p[p.origine == "VOLANT"]
    sup = p[p.origine == "QUART_SUPPLEMENTAIRE"]
    poste_hab = dict(zip(d["employes"].matricule, d["employes"].poste_habituel))
    # Explication : combien de titulaires du même poste étaient absents ces jours-là
    explications = []
    for r in sup.itertuples():
        absents = sum(1 for (m, j), _ in d["jours_absence"].items()
                      if j.isoformat() == r.date and poste_hab.get(m) == r.poste)
        explications.append((absents, r.poste))
    if sup.empty:
        detail_sup = "aucun quart sur un jour de repos"
    elif len(set(explications)) == 1:
        n, poste = explications[0]
        dates_sup = sorted(set(sup.date))
        article = "les" if len(dates_sup) > 1 else "le"
        jours_sup = liste_fr([f"{date.fromisoformat(x).day}/{date.fromisoformat(x).month}" for x in dates_sup])
        detail_sup = (f"{n} {PLURIEL_POSTE[poste]} absents {article} {jours_sup}" if n > 1
                      else f"{article} {jours_sup}")
    else:
        detail_sup = "voir les cases encadrées en orange"

    t = d["rapport"]["temps_resolution_s"]
    temps = f"≈ {nombre(round(t))} s" if t >= 1 else "< 1 s"

    return [
        ("Postes couverts", f"{nombre(couverts)} / {nombre(total_requis)}",
         f"{nb_quarts} quarts × {postes_par_quart} postes × {len(jours)} jours"),
        ("Règles respectées", f"{nombre(part_ok * 100)} %",
         f"{nb_ano} anomalie{'s' if nb_ano > 1 else ''} au contrôle indépendant"),
        ("Absences gérées", nombre(len(abs_horizon)), liste_fr(familles)),
        ("Remplacements par volant", f"{nombre(len(volants))} quarts",
         f"{volants.matricule.nunique()} volants mobilisés"),
        ("Heures supplémentaires", f"{nombre(len(sup))} quart{'s' if len(sup) > 1 else ''}", detail_sup),
        ("Temps de calcul", temps, f"solveur OR-Tools, statut {d['rapport']['statut']}"),
    ]


# ------------------------------------------------------------------ grille
def classe_et_texte(affectation, absent: bool) -> tuple[str, str, str]:
    """Renvoie (classes CSS, texte de la case, complément d'info-bulle)."""
    if affectation is not None:
        classes = f"q q{affectation.quart}"
        info = f"{LIBELLES_QUART[affectation.quart]} · {LIBELLES_POSTE[affectation.poste]}"
        if affectation.origine == "VOLANT":
            classes += " volant"
            info += " · remplacement par un volant"
        elif affectation.origine == "QUART_SUPPLEMENTAIRE":
            classes += " sup"
            info += " · quart supplémentaire"
        elif affectation.origine == "ECHANGE_QUART":
            classes += " echange"
            info += " · quart différent du cycle"
        elif affectation.origine == "MODIFIE":
            classes += " modifie"
            info += " · modifié par la replanification"
        return classes, affectation.quart, info
    if absent:
        return "abs", "Abs", "Absence"
    return "repos", "", "Repos"


def grille(d: dict, planning: pd.DataFrame, titre_aria: str) -> str:
    jours, emp = d["jours"], d["employes"].copy()
    affect = {(r.matricule, date.fromisoformat(r.date)): r for r in planning.itertuples()}
    emp["ordre"] = emp.equipe.map(lambda x: "ZZ" if x == "VOLANT" else x)
    emp = emp.sort_values(["ordre", "matricule"])

    entete = "<th class='col-nom' scope='col'>Opérateur</th>" + "".join(
        f"<th scope='col' class='{'we' if j.weekday() >= 5 else ''}'><span>{JOURS_COURTS[j.weekday()]}</span>{j.day}</th>"
        for j in jours)
    lignes = []
    for equipe, groupe in emp.groupby("ordre", sort=True):
        nom_equipe = "Volants (remplaçants)" if equipe == "ZZ" else f"Équipe {equipe}"
        lignes.append(f"<tr class='equipe'><th class='col-nom' scope='rowgroup'>{e(nom_equipe)}</th>"
                      f"<td colspan='{len(jours)}'></td></tr>")
        for r in groupe.itertuples():
            libelle = f"{r.matricule} · {LIBELLES_POSTE[r.poste_habituel]}"
            cases = []
            for j in jours:
                cl, txt, info = classe_et_texte(affect.get((r.matricule, j)), (r.matricule, j) in d["jours_absence"])
                bulle = f"{r.matricule} · {JOURS_COURTS[j.weekday()]} {j.day}/{j.month} · {info}"
                cases.append(f"<td class='{cl}' title='{e(bulle)}'>{e(txt)}</td>")
            lignes.append(f"<tr><th class='col-nom' scope='row'>{e(libelle)}</th>{''.join(cases)}</tr>")
    return (f"<div class='defile' tabindex='0' role='region' aria-label='{e(titre_aria)}'>"
            f"<table class='grille'><thead><tr>{entete}</tr></thead><tbody>{''.join(lignes)}</tbody></table></div>")


LEGENDE = """<ul class="legende">
  <li><span class="q qM">M</span>Matin 6 h–14 h</li>
  <li><span class="q qA">A</span>Après-midi 14 h–22 h</li>
  <li><span class="q qN">N</span>Nuit 22 h–6 h</li>
  <li><span class="repos"></span>Repos</li>
  <li><span class="abs">Abs</span>Absence</li>
  <li><span class="q qM volant">M</span>Remplacement par un volant</li>
  <li><span class="q qM sup">M</span>Quart supplémentaire</li>
</ul>"""


# ------------------------------------------------------------------ replanification (facultative)
def bloc_replanification(d: dict, dossier: Path) -> tuple[str, str]:
    """Renvoie (texte de l'encadré, section détaillée) si output/replanif existe, sinon ('', '')."""
    if not (dossier / "planning.csv").exists():
        return "", ""
    rap = json.loads((dossier / "rapport.json").read_text(encoding="utf-8"))
    ano = pd.read_csv(dossier / "anomalies.csv")
    nouveau = pd.read_csv(dossier / "planning.csv")
    cle = ["date", "matricule", "quart", "poste"]
    # Cases inchangées : on garde l'origine de la référence (volant, quart supplémentaire…)
    origine_ref = d["planning"].set_index(cle).origine
    nouveau["origine"] = [origine_ref.get(tuple(r[c] for c in cle), r["origine"]) if r["origine"] == "INCHANGE"
                          else r["origine"] for _, r in nouveau.iterrows()]
    # Absences du scénario (données copiées dans output/replanif/donnees avec la nouvelle absence)
    d_scenario = dict(d)
    if (dossier / "donnees" / "absences.csv").exists():
        d_scenario["jours_absence"] = jours_d_absence(pd.read_csv(dossier / "donnees" / "absences.csv"), d["jours"])
    diff = d["planning"][cle].merge(nouveau[cle], how="outer", indicator="action")
    diff["action"] = diff.action.map({"left_only": "retiré", "right_only": "ajouté", "both": "inchangé"})
    changements = diff[diff.action != "inchangé"].sort_values(["date", "quart", "poste", "action"], ascending=[1, 1, 1, 0])
    scenario = (dossier / "scenario.txt").read_text(encoding="utf-8").strip() if (dossier / "scenario.txt").exists() else ""
    nb = rap["indicateurs"]["modifications_vs_reference"]
    # Une ligne par quart modifié : qui le tenait dans le planning publié -> qui le tient maintenant
    lignes = ""
    for (jour, quart, poste), groupe in changements.groupby(["date", "quart", "poste"], sort=True):
        avant = ", ".join(groupe[groupe.action == "retiré"].matricule) or "—"
        apres = ", ".join(groupe[groupe.action == "ajouté"].matricule) or "—"
        j = date.fromisoformat(jour)
        lignes += (f"<tr><td>{JOURS_COURTS[j.weekday()]} {j.day}/{j.month}</td><td>{e(LIBELLES_QUART[quart])}</td>"
                   f"<td>{e(LIBELLES_POSTE[poste])}</td><td>{e(avant)} → <b>{e(apres)}</b></td></tr>")
    encadre = (f"<b>Replanification :</b> {e(scenario)} → <b>{nombre(nb)} changement{'s' if nb > 1 else ''}</b> "
               f"seulement, {nombre(len(ano))} anomalie, {nombre(rap['trous_couverture'])} poste non couvert, "
               f"calcul en {nombre(rap['temps_resolution_s'], 1)} s. Le manager valide toujours avant publication.")
    section = f"""<section class="carte">
  <h2>Replanification : {e(scenario)}</h2>
  <p class="note">Le moteur repart du planning publié et le modifie le moins possible.
     Cases en pointillés orange : affectations modifiées ; « Abs » : nouvelle absence.</p>
  {grille(d_scenario, nouveau, 'Planning après replanification')}
  <table class="diff"><thead><tr><th>Jour</th><th>Quart</th><th>Poste</th><th>Avant → après</th></tr></thead>
  <tbody>{lignes}</tbody></table>
</section>"""
    return encadre, section


# ------------------------------------------------------------------ page
CSS = """
:root { --fond:#f4f5f7; --carte:#fff; --bord:#e3e6eb; --texte:#1b2433; --texte2:#5b6473; --texte3:#8a92a0;
        --bandeau:#1b2433; --accent:#e07b4f; --m:#dbe7f8; --a:#8fb3e8; --n:#1b2433; --repos:#eef0f3;
        --abs:#f8dccb; --abs-texte:#a5432a; --volant:#2a78d6; --sup:#e07b4f; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--fond); color: var(--texte); font: 14px/1.4 "Segoe UI", Inter, system-ui, -apple-system, sans-serif; }
.page { max-width: 1240px; margin: 0 auto; padding-block: 24px 32px;
        padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.bandeau { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;
           background: var(--bandeau); color: #fff; border-left: 6px solid var(--accent); border-radius: 10px; padding: 16px 20px; }
.surtitre { margin: 0 0 4px; color: #f0a37f; font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; }
h1 { margin: 0; font-size: clamp(18px, 2.6vw, 24px); font-weight: 650; }
.badge { background: #f3c09f; color: var(--bandeau); font-weight: 650; font-size: 13px; padding: 5px 12px; border-radius: 999px; white-space: nowrap; }
.kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin: 16px 0 12px; }
.kpi { background: var(--carte); border: 1px solid var(--bord); border-radius: 10px; padding: 10px 14px; }
.kpi h2 { margin: 0; font-size: 12.5px; font-weight: 500; color: var(--texte2); }
.kpi .valeur { margin: 2px 0; font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.kpi .detail { margin: 0; font-size: 12px; color: var(--texte2); }
.carte { background: var(--carte); border: 1px solid var(--bord); border-radius: 10px; padding: 12px 16px 16px; margin-bottom: 12px; }
.carte h2 { margin: 0 0 8px; font-size: 14px; font-weight: 650; }
.defile { overflow-x: auto; }
.defile:focus { outline: 2px solid var(--volant); }
.grille { border-collapse: separate; border-spacing: 2px; font-size: 11px; min-width: 980px; width: 100%; }
.grille th { font-weight: 500; color: var(--texte2); }
.grille thead th { font-size: 10.5px; line-height: 1.15; padding: 2px 0; }
.grille thead th span { display: block; font-weight: 600; }
.grille thead th.we { color: var(--texte); font-weight: 700; }
.col-nom { position: sticky; left: 0; background: var(--carte); text-align: left; white-space: nowrap; padding-right: 8px; z-index: 1; font-size: 11px; }
.grille thead .col-nom { color: var(--texte3); }
tr.equipe th { color: var(--texte); font-weight: 700; padding-top: 6px; }
.grille td { height: 20px; min-width: 26px; text-align: center; border-radius: 2px; font-weight: 650; }
.q, .repos, .abs { display: inline-flex; align-items: center; justify-content: center; }
td.q, td.repos, td.abs { display: table-cell; }
.qM { background: var(--m); color: var(--texte); }
.qA { background: var(--a); color: var(--texte); }
.qN { background: var(--n); color: #fff; }
.repos { background: var(--repos); }
.abs { background: var(--abs); color: var(--abs-texte); font-weight: 600; font-size: 10px; }
.volant { box-shadow: inset 0 0 0 2px var(--volant); }
.qN.volant { box-shadow: inset 0 0 0 2px #7fb0f0; }
.sup { box-shadow: inset 0 0 0 2px var(--sup); }
.echange, .modifie { box-shadow: inset 0 0 0 2px var(--texte); outline: 2px dashed var(--sup); outline-offset: -2px; }
.legende { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 0; margin: 12px 0 0; font-size: 12px; color: var(--texte2); }
.legende li { display: flex; align-items: center; gap: 6px; }
.legende span { width: 26px; height: 18px; border-radius: 2px; font-size: 10.5px; font-weight: 650; }
.encadres { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.encadres p { margin: 0; background: var(--carte); border: 1px solid var(--bord); border-radius: 10px; padding: 12px 14px; font-size: 13px; }
.note { margin: 0 0 8px; color: var(--texte2); font-size: 12.5px; }
.diff { border-collapse: collapse; margin-top: 12px; font-size: 12.5px; }
.diff th, .diff td { text-align: left; padding: 5px 10px; border-bottom: 1px solid var(--bord); }
.diff th { color: var(--texte2); font-weight: 600; }
.pied { border-top: 1px solid var(--bord); padding-top: 8px; font-size: 11.5px; color: var(--texte3); }
@media (max-width: 1050px) { .kpis { grid-template-columns: repeat(3, 1fr); } }
.lien-demo { margin: 12px 0 0; background: #fff8f3; border: 1px solid #f3c09f; border-radius: 10px; padding: 10px 14px; font-size: 13.5px; }
.lien-demo a { color: #1c5cab; font-weight: 600; }
.astuce { display: none; margin: 0 0 6px; font-size: 11.5px; color: var(--texte3); }
@media (max-width: 640px) { .carte .astuce { display: block; } .kpis { grid-template-columns: 1fr 1fr; } .encadres { grid-template-columns: 1fr; } .kpi .valeur { font-size: 20px; } }
"""


def construire_page(d: dict, replanif: Path) -> str:
    jours = d["jours"]
    titre = f"Planning des quarts — {date_longue(jours[0])} au {date_longue(jours[-1])}"
    titre = titre.replace(f" {jours[0].year} au", " au") if jours[0].year == jours[-1].year else titre
    kpis = "".join(f"<article class='kpi'><h2>{e(t)}</h2><p class='valeur'>{e(v)}</p><p class='detail'>{e(s)}</p></article>"
                   for t, v, s in calculer_indicateurs(d))
    r = d["rapport"]["indicateurs"]
    encadre_replanif, section_replanif = bloc_replanification(d, replanif)
    regles = (f"<b>Règles garanties :</b> habilitation au poste, repos de 11 h entre deux quarts, "
              f"6 jours et 3 nuits consécutifs au maximum, couverture minimale de chaque poste, "
              f"demandes de repos prises en compte ({nombre(r['demandes_repos_respectees'])} sur "
              f"{nombre(r['demandes_repos_total'])}). Chaque règle est revérifiée par un contrôle indépendant du solveur.")
    if not encadre_replanif:
        encadre_replanif = ("<b>Replanification :</b> en cas d'absence imprévue, le planning est recalculé en modifiant "
                            "le moins possible le planning publié ; le manager valide toujours avant publication.")
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titre)}</title>
<meta name="description" content="Exemple de planning automatisé d'équipes postées en 5×8 — données entièrement fictives.">
<style>{CSS}</style>
</head>
<body>
<main class="page">
  <header class="bandeau">
    <div>
      <p class="surtitre">Exemple de planning automatisé · Équipes postées en 5×8</p>
      <h1>{e(titre)}</h1>
    </div>
    <span class="badge">Données entièrement fictives</span>
  </header>

  <p class="lien-demo"><b>Version interactive :</b> congés, RTT et absences, assistant en français,
     recalcul en quelques millisecondes et validation par le manager — <a href="interactif/">ouvrir le planning interactif</a>.</p>

  <section class="kpis" aria-label="Indicateurs clés">{kpis}</section>

  <section class="carte">
    <h2>Planning de référence</h2>
    <p class="astuce">← faites défiler la grille horizontalement →</p>
    {grille(d, d['planning'], 'Planning des quarts par opérateur et par jour')}
    {LEGENDE}
  </section>

  <div class="encadres">
    <p>{regles}</p>
    <p>{encadre_replanif}</p>
  </div>

  {section_replanif}

  <footer class="pied">
    Moteur : Python + OR-Tools (programmation par contraintes), contrôle indépendant des règles. Règles et effectifs
    fictifs, à adapter à l'organisation réelle ; pas encore connecté à SAP ni à BigQuery. · Réalisation : Christophe, Data Analyst BI
  </footer>
</main>
</body>
</html>
"""


def version_artifact(page: str, titre_court: str) -> str:
    """Même page, sans l'enveloppe <html>/<head>/<body> : format attendu par l'hébergement claude.ai."""
    style = page[page.index("<style>"):page.index("</style>") + len("</style>")]
    corps = page[page.index("<main"):page.index("</main>") + len("</main>")]
    return (f"<title>{e(titre_court)}</title>\n"
            '<meta name="claude:viewport-fit-sides" content="cover">\n'
            f"{style}\n{corps}\n")


def main() -> None:
    p = argparse.ArgumentParser(description="Génère docs/index.html depuis le planning de référence")
    p.add_argument("--sortie-moteur", type=Path, default=RACINE / "output")
    p.add_argument("--donnees", type=Path, default=RACINE / "data")
    p.add_argument("--regles", type=Path, default=RACINE / "config" / "regles.yaml")
    p.add_argument("--replanif", type=Path, default=RACINE / "output" / "replanif")
    p.add_argument("--page", type=Path, default=RACINE / "docs" / "index.html")
    p.add_argument("--artifact", type=Path, default=None,
                   help="écrit aussi une version à publier comme page claude.ai (sans enveloppe HTML)")
    a = p.parse_args()
    d = charger(a.sortie_moteur, a.donnees, a.regles)
    page = construire_page(d, a.replanif)
    a.page.parent.mkdir(parents=True, exist_ok=True)
    a.page.write_text(page, encoding="utf-8")
    print("Page écrite :", a.page)
    if a.artifact:
        a.artifact.write_text(version_artifact(page, "Planning des quarts 5×8"), encoding="utf-8")
        print("Version claude.ai écrite :", a.artifact)


if __name__ == "__main__":
    main()
