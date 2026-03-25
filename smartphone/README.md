## Smartphone - Suivi de chantiers (Supabase)

### Prerequis
- Node.js 18+
- Un projet Supabase actif

### Installation
1. `npm install`
2. Copier `.env.example` vers `.env.local`
3. Renseigner:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optionnel:
- `VITE_SUPABASE_PROJECTS_TABLE` (defaut `chantiers`)
- `VITE_SUPABASE_TASKS_TABLE` (defaut `chantier_tasks`)
- `VITE_SUPABASE_TASKS_PROJECT_ID_COLUMN` (defaut `project_id`)

### Scripts
- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run fuzz:business`

### Invariants metier
Voir `docs/business-invariants.md`.

### Notes migration
- L'app mobile utilise un adaptateur Supabase expose via `src/api/base44Client.js`.
- L'API conserve les methodes `entities.Project/Task` pour limiter les regressions UI.
