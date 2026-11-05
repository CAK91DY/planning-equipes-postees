"""Assistant de planification propulsé par Claude (API Anthropic ou Vertex AI sur Google Cloud).

Répartition des rôles :
- Claude comprend la demande en langage naturel, choisit les outils, explique et propose.
- Le solveur OR-Tools calcule le planning et GARANTIT les règles dures.
- Le contrôle indépendant revérifie chaque proposition.
- Le manager valide : Claude ne peut PAS publier un planning (aucun outil ne le permet).

Exemples de demandes :
  « Durand est malade du 23 au 25 décembre, qui peut le remplacer ? »
  « Pendant l'arrêt du 14 au 18 décembre, il faut 3 opérateurs extérieurs la nuit. »
  « Pourquoi Opérateur 01 travaille-t-il la nuit du 15 ? »

Configuration (variables d'environnement) :
  CLAUDE_VIA_VERTEX=1        utiliser Claude sur Vertex AI (recommandé sur GCP)
  GCP_PROJECT=<projet>       projet Google Cloud (mode Vertex)
  VERTEX_REGION=eu           point d'accès multi-région UE (résidence des données)
  CLAUDE_MODEL=claude-sonnet-5-5
  ANTHROPIC_API_KEY=...      mode API Anthropic directe
"""
from __future__ import annotations

import argparse
import copy
import json
import os
from datetime import date
from pathlib import Path

import pandas as pd

from .controle import controler, indicateurs
from .donnees import QUARTS, Instance, charger_csv, charger_regles
from .solveur import resoudre

MODELE_PAR_DEFAUT = "claude-sonnet-5-5"
MAX_ITERATIONS_OUTILS = 12
MOTIFS_AUTORISES = ["CONGES", "ABSENCE_IMPREVUE", "FORMATION", "AUTRE"]

PROMPT_SYSTEME = """Tu es l'assistant de planification des équipes postées d'un site pétrochimique (exemple, données fictives).
Tu aides les managers d'exploitation à préparer et ajuster le planning des quarts (M 6h-14h, A 14h-22h, N 22h-6h).

Règles de conduite :
- Utilise toujours les outils pour lire les données : n'invente jamais un nom, un quart ou un chiffre.
- Pour toute modification (absence, renfort), déclare-la puis lance `simuler_replanification` :
  c'est le solveur qui calcule le planning et garantit les règles (repos 11 h, habilitations,
  jours et nuits consécutifs). Ne propose jamais toi-même une affectation non calculée.
- Présente chaque proposition : modifications (qui, quand, quel quart), heures supplémentaires,
  trous de couverture éventuels, résultat du contrôle. Termine en demandant la validation du manager.
- Tu ne peux pas publier le planning : seul le manager valide dans l'application.
- Ne demande ni ne mentionne de détail médical : une absence imprévue se déclare « ABSENCE_IMPREVUE ».
- Si une demande est ambiguë (plusieurs personnes du même nom, dates floues), pose une question.
- Réponds en français, de façon brève et structurée."""

OUTILS = [
    {
        "name": "rechercher_employe",
        "description": "Trouve un employé par nom ou matricule. Renvoie matricule, équipe, poste habituel et habilitations.",
        "input_schema": {"type": "object", "properties": {
            "texte": {"type": "string", "description": "Nom, partie du nom ou matricule (ex. 'E009')"}},
            "required": ["texte"]},
    },
    {
        "name": "consulter_planning",
        "description": "Lit le planning en vigueur (ou la proposition en cours) sur une période, filtrable par matricule ou quart.",
        "input_schema": {"type": "object", "properties": {
            "date_debut": {"type": "string", "description": "AAAA-MM-JJ"},
            "date_fin": {"type": "string", "description": "AAAA-MM-JJ"},
            "matricule": {"type": "string"},
            "quart": {"type": "string", "enum": QUARTS},
            "source": {"type": "string", "enum": ["en_vigueur", "proposition"], "default": "en_vigueur"}},
            "required": ["date_debut", "date_fin"]},
    },
    {
        "name": "declarer_absence",
        "description": "Ajoute une absence à la proposition en préparation (non publiée). Lancer ensuite simuler_replanification.",
        "input_schema": {"type": "object", "properties": {
            "matricule": {"type": "string"},
            "date_debut": {"type": "string", "description": "AAAA-MM-JJ"},
            "date_fin": {"type": "string", "description": "AAAA-MM-JJ"},
            "motif": {"type": "string", "enum": MOTIFS_AUTORISES}},
            "required": ["matricule", "date_debut", "date_fin", "motif"]},
    },
    {
        "name": "modifier_besoin",
        "description": "Change l'effectif requis pour un poste et un quart sur une période (ex. renfort pendant un arrêt).",
        "input_schema": {"type": "object", "properties": {
            "date_debut": {"type": "string"}, "date_fin": {"type": "string"},
            "quart": {"type": "string", "enum": QUARTS},
            "poste": {"type": "string", "enum": ["CHEF_QUART", "OP_TABLEAU", "OP_EXTERIEUR"]},
            "effectif": {"type": "integer", "minimum": 0, "maximum": 10}},
            "required": ["date_debut", "date_fin", "quart", "poste", "effectif"]},
    },
    {
        "name": "simuler_replanification",
        "description": "Lance le solveur avec les changements déclarés, en modifiant le moins possible le planning en vigueur. Renvoie les modifications, les indicateurs et le contrôle des règles.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "indicateurs_planning",
        "description": "Indicateurs du planning en vigueur : affectations, heures supplémentaires, nuits des volants, demandes de repos.",
        "input_schema": {"type": "object", "properties": {}},
    },
]


class SessionPlanning:
    """État partagé entre l'assistant et l'application : planning en vigueur + changements en attente."""

    def __init__(self, donnees: Path, regles: Path, planning_en_vigueur: Path):
        self.instance = charger_csv(donnees, charger_regles(regles))
        self.planning = pd.read_csv(planning_en_vigueur)
        self.absences_ajoutees: list[dict] = []
        self.besoins_ajoutes: list[dict] = []
        self.proposition: pd.DataFrame | None = None

    # ---- outils ----
    def rechercher_employe(self, texte: str) -> dict:
        emp = self.instance.employes
        t = texte.strip().lower()
        res = emp[emp.matricule.str.lower().eq(t) | emp.nom.str.lower().str.contains(t, regex=False)]
        return {"resultats": [
            {**r._asdict(), "habilitations": sorted(self.instance.habilitations.get(r.matricule, []))}
            for r in res.drop(columns=[], errors="ignore").itertuples(index=False)][:10]}

    def consulter_planning(self, date_debut, date_fin, matricule=None, quart=None, source="en_vigueur") -> dict:
        df = self.proposition if source == "proposition" and self.proposition is not None else self.planning
        df = df[(df.date >= date_debut) & (df.date <= date_fin)]
        if matricule:
            df = df[df.matricule == matricule]
        if quart:
            df = df[df.quart == quart]
        cols = ["date", "matricule", "nom", "quart", "poste", "origine"]
        return {"nb_lignes": len(df), "lignes": df[cols].head(150).to_dict("records")}

    def _verifier_dates(self, d1: str, d2: str) -> str | None:
        try:
            a, b = date.fromisoformat(d1), date.fromisoformat(d2)
        except ValueError:
            return "dates invalides (format AAAA-MM-JJ attendu)"
        if a > b:
            return "date_debut postérieure à date_fin"
        if b < self.instance.jours[0] or a > self.instance.jours[-1]:
            return f"période hors horizon ({self.instance.jours[0]} → {self.instance.jours[-1]})"
        return None

    def declarer_absence(self, matricule, date_debut, date_fin, motif) -> dict:
        if matricule not in self.instance.matricules:
            return {"erreur": f"matricule inconnu : {matricule}"}
        if motif not in MOTIFS_AUTORISES:
            return {"erreur": f"motif non autorisé, valeurs possibles : {MOTIFS_AUTORISES}"}
        if err := self._verifier_dates(date_debut, date_fin):
            return {"erreur": err}
        self.absences_ajoutees.append(dict(matricule=matricule, date_debut=date_debut,
                                           date_fin=date_fin, motif=motif))
        return {"ok": True, "changements_en_attente": len(self.absences_ajoutees) + len(self.besoins_ajoutes)}

    def modifier_besoin(self, date_debut, date_fin, quart, poste, effectif) -> dict:
        if err := self._verifier_dates(date_debut, date_fin):
            return {"erreur": err}
        self.besoins_ajoutes.append(dict(date_debut=date_debut, date_fin=date_fin,
                                         quart=quart, poste=poste, effectif=int(effectif)))
        return {"ok": True, "changements_en_attente": len(self.absences_ajoutees) + len(self.besoins_ajoutes)}

    def _instance_modifiee(self) -> Instance:
        inst = copy.deepcopy(self.instance)
        for a in self.absences_ajoutees:
            for j in inst.jours:
                if a["date_debut"] <= j.isoformat() <= a["date_fin"]:
                    inst.absences.add((a["matricule"], j))
                    inst.motifs_absence[(a["matricule"], j)] = a["motif"]
        for b in self.besoins_ajoutes:
            for j in inst.jours:
                if b["date_debut"] <= j.isoformat() <= b["date_fin"]:
                    inst.besoins_specifiques[(j, b["quart"], b["poste"])] = b["effectif"]
        inst.reference = {(r.matricule, date.fromisoformat(r.date)): (r.quart, r.poste)
                          for r in self.planning.itertuples()}
        return inst

    def simuler_replanification(self) -> dict:
        inst = self._instance_modifiee()
        res = resoudre(inst, temps_max_s=30)
        if res.planning.empty:
            return {"statut": res.statut, "erreur": "aucune solution trouvée"}
        self.proposition = res.planning
        cle = ["date", "matricule", "quart", "poste"]
        diff = self.planning[cle].merge(res.planning[cle], how="outer", indicator=True)
        diff = diff[diff._merge != "both"].replace({"_merge": {"left_only": "RETIRE", "right_only": "AJOUTE"}})
        anomalies = controler(inst, res.planning)
        return {
            "statut": res.statut,
            "nb_modifications": int((diff._merge == "AJOUTE").sum()),
            "modifications": diff.rename(columns={"_merge": "action"}).sort_values(["date", "action"])
                                 .astype(str).to_dict("records")[:80],
            "trous_couverture": res.trous.astype(str).to_dict("records"),
            "anomalies_controle": anomalies.astype(str).to_dict("records")[:20],
            "rappel": "Proposition non publiée : validation du manager requise.",
        }

    def indicateurs_planning(self) -> dict:
        return indicateurs(self.instance, self.planning)

    # ---- action humaine (hors IA) ----
    def valider_proposition(self, chemin_sortie: Path) -> None:
        """Appelée par l'application quand le MANAGER valide ; jamais exposée à Claude."""
        if self.proposition is None:
            raise ValueError("aucune proposition à valider")
        self.proposition.to_csv(chemin_sortie, index=False)
        self.planning, self.proposition = self.proposition, None
        self.absences_ajoutees, self.besoins_ajoutes = [], []

    def executer_outil(self, nom: str, entree: dict) -> dict:
        outils = {o["name"] for o in OUTILS}
        if nom not in outils:
            return {"erreur": f"outil inconnu : {nom}"}
        try:
            return getattr(self, nom)(**entree)
        except TypeError as exc:
            return {"erreur": f"paramètres invalides : {exc}"}


def creer_client():
    """Client Claude : Vertex AI (données traitées dans Google Cloud) ou API Anthropic directe."""
    if os.getenv("CLAUDE_VIA_VERTEX") == "1":
        from anthropic import AnthropicVertex
        return AnthropicVertex(project_id=os.environ["GCP_PROJECT"], region=os.getenv("VERTEX_REGION", "eu"))
    from anthropic import Anthropic
    return Anthropic()


class AssistantPlanning:
    def __init__(self, session: SessionPlanning, client=None, modele: str | None = None):
        self.session = session
        self.client = client or creer_client()
        self.modele = modele or os.getenv("CLAUDE_MODEL", MODELE_PAR_DEFAUT)
        self.historique: list[dict] = []
        self.journal: list[dict] = []   # traçabilité : chaque appel d'outil est journalisé

    def demander(self, texte: str) -> str:
        self.historique.append({"role": "user", "content": texte})
        for _ in range(MAX_ITERATIONS_OUTILS):
            reponse = self.client.messages.create(
                model=self.modele, max_tokens=2000, system=PROMPT_SYSTEME,
                tools=OUTILS, messages=self.historique)
            self.historique.append({"role": "assistant", "content": reponse.content})
            if reponse.stop_reason != "tool_use":
                return "".join(b.text for b in reponse.content if b.type == "text")
            resultats = []
            for bloc in reponse.content:
                if bloc.type == "tool_use":
                    sortie = self.session.executer_outil(bloc.name, dict(bloc.input))
                    self.journal.append({"outil": bloc.name, "entree": dict(bloc.input),
                                         "erreur": sortie.get("erreur")})
                    resultats.append({"type": "tool_result", "tool_use_id": bloc.id,
                                      "content": json.dumps(sortie, ensure_ascii=False, default=str),
                                      "is_error": "erreur" in sortie})
            self.historique.append({"role": "user", "content": resultats})
        return "Je n'ai pas pu terminer : trop d'étapes. Reformulez la demande en plus simple."


def main() -> None:
    p = argparse.ArgumentParser(description="Assistant de planification (Claude)")
    p.add_argument("--donnees", type=Path, default=Path("data"))
    p.add_argument("--regles", type=Path, default=Path("config/regles.yaml"))
    p.add_argument("--planning", type=Path, default=Path("output/planning.csv"))
    a = p.parse_args()
    session = SessionPlanning(a.donnees, a.regles, a.planning)
    assistant = AssistantPlanning(session)
    print("Assistant de planification — tapez « valider » pour publier la proposition, « quitter » pour sortir.")
    while (texte := input("\nManager > ").strip()).lower() != "quitter":
        if texte.lower() == "valider":
            session.valider_proposition(a.planning)
            print(f"Planning publié dans {a.planning}.")
            continue
        print("\nAssistant >", assistant.demander(texte))


if __name__ == "__main__":
    main()
