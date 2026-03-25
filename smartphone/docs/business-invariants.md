# Invariants metier smartphone

## Statuts chantier autorises
- `a_planifier`
- `en_cours`
- `en_pause`
- `clos`
- `annule`

## Transitions chantier autorisees
- `a_planifier -> en_cours | annule`
- `en_cours -> en_pause | clos | annule`
- `en_pause -> en_cours | clos | annule`
- `clos` et `annule` sont terminaux

## Validations
- Dates au format `YYYY-MM-DD`
- Si `start_date` et `end_date` existent: `start_date <= end_date`
- `progress` borne a `[0, 100]`
- `owner_type` tache dans: `INTERNE`, `RSG`, `RI`, `Prestataire externe`
- `project_id` obligatoire sur les taches
- Strings trimmees + longueur limitee

## Normalisation des valeurs
- Nombres: `NaN`/`Infinity` rejetes
- Coûts/penalites: bornes `[0, 1e9]`, 2 decimales
- `statuses` tache: tableau deduplique de chaines nettoyees
- `duration_days` recalcule a partir des dates quand elles existent

## Regles de calcul
- Avancement chantier derive de la moyenne des `progress` des taches associees
- Fin prevue chantier: max des `end_date` taches, sinon date de fin chantier
- Cloture chantier: statut `clos`, progress force a `100`, `end_date` mise a la date du jour
