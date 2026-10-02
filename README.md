# Feature Tracker

Application web pour suivre et modifier l'avancement des features d'un projet réparti sur
**3 briques applicatives** (nombre, noms et couleurs configurables).

- **Aucune base de données** : les données vivent dans un fichier JSON que l'on importe et exporte.
- **Un seul fichier HTML** en sortie de build (`dist/index.html`, JS et CSS inlinés), à publier sur
  GitHub Pages ou à ouvrir directement depuis le disque.
- Planning basé sur [SVAR React Gantt](https://svar.dev/react/gantt/) (MIT).

## Vues

| Vue            | Contenu                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| **Synthèse**   | Avancement global, avancement et répartition des statuts par brique, points d'attention (bloqué / en retard). |
| **Avancement** | Matrice features × briques : statut et % modifiables directement, filtres, réordonnancement.          |
| **Planning**   | Gantt : une ligne par feature, une barre par brique. Glisser/étirer une barre modifie les dates, sa poignée l'avancement. |

Un clic sur une feature (ou un double-clic dans le Gantt) ouvre le panneau d'édition : nom,
description, priorité, jalon, et pour chaque brique statut, %, dates, responsable, notes.

Statuts : À faire, En cours, En recette, Bloqué, Terminé, Non concerné (brique exclue du calcul).

## Données

- **Au chargement**, la page affiche une zone de dépôt : glisser-déposer (ou sélectionner) le `.json`
  du projet. Liens secondaires : reprendre le brouillon local, créer un projet vide, voir un exemple.
- **Importer** : bouton *Importer* ou glisser-déposer un `.json` sur la page ; *⋯ → Fermer le projet*
  revient à l'écran d'accueil.
- **Exporter** : bouton *Exporter*, télécharge `<nom-du-projet>-<date>.json`.
- Un brouillon est gardé dans le `localStorage` du navigateur pour ne rien perdre en cas de
  rechargement ; le badge *non exporté* rappelle que le JSON n'est pas à jour.
- `?src=<url>` charge un JSON distant au démarrage, par ex.
  `https://<user>.github.io/feature-tracker/?src=https://raw.githubusercontent.com/<user>/<repo>/main/avancement.json`
  (l'URL doit autoriser le CORS, ce qui est le cas de `raw.githubusercontent.com`).

### Format

```json
{
  "version": 1,
  "project": { "name": "Plateforme Client", "description": "Refonte de l'espace client" },
  "bricks": [
    { "id": "mapi", "name": "sfd", "color": "#4f7cff" },
    { "id": "api", "name": "API métier", "color": "#22a06b" },
    { "id": "data", "name": "Référentiel", "color": "#e8912d" }
  ],
  "features": [
    {
      "id": "invoices",
      "name": "Consultation des factures",
      "priority": "high",
      "milestone": "MVP",
      "description": "…",
      "work": {
        "mapi": { "status": "todo", "progress": 0, "start": "2026-10-05", "end": "2026-10-16", "owner": "David" },
        "api": { "status": "in_progress", "progress": 40, "start": "2026-09-25", "end": "2026-10-08" },
        "data": { "status": "blocked", "progress": 20, "notes": "Attente des accès" }
      }
    }
  ]
}
```

- `status` : `todo` | `in_progress` | `review` | `blocked` | `done` | `na`
- `priority` : `low` | `medium` | `high` | `critical`
- Dates au format `YYYY-MM-DD`, date de fin **incluse**. Sans dates, la brique est « non planifiée ».
- L'import est tolérant : champs optionnels absents, briques manquantes complétées, valeurs
  invalides ramenées à une valeur par défaut. Il échoue si `bricks` est absent ou vide.

## Développement

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests unitaires du modèle (Vitest)
npm run build    # dist/index.html autonome
```

## Publication sur GitHub Pages

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) teste, construit et publie
`dist/` à chaque push sur `main`. Dans le dépôt GitHub : *Settings → Pages → Source : GitHub Actions*.

Le build utilise `base: "./"`, il fonctionne donc sous n'importe quel sous-chemin
(`https://<user>.github.io/<repo>/`).

> Les polices et icônes du thème SVAR sont chargées depuis `cdn.svar.dev`. Hors ligne, l'application
> fonctionne mais avec la police système et sans les icônes de dépliage du Gantt.
