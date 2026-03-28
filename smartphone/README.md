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
- `VITE_SUPABASE_TIME_LOGS_TABLE` (defaut `chantier_time_logs`)
- `VITE_SUPABASE_INTERNAL_TECHS_TABLE` (defaut `chantier_internal_techs`)
- `VITE_SUPABASE_VENDORS_TABLE` (defaut `chantier_vendors`)
- `VITE_SUPABASE_REFS_SITE_COLUMN` (defaut `site`)
- `VITE_READ_ONLY_MODE=true|false` (si `true`, bloque toutes les ecritures)
- `VITE_ALLOW_TASK_WRITES=true|false` (si `false`, bloque create/update/delete taches)

### Scripts
- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run fuzz:business`

### Invariants metier
Voir `docs/business-invariants.md`.

### Notes migration
- L'app mobile utilise un adaptateur Supabase expose via `src/api/dataClient.js`.
- L'API conserve les methodes `entities.Project/Task` pour limiter les regressions UI.
- Integration lecture etendue:
  - `entities.TimeLog.list/filter`
  - `entities.Referential.listInternalTechs/listVendors`

