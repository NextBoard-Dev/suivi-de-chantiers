# Lot E - E1 (seuils + alertes non bloquantes)

## Objectif
Donner une alerte claire quand la charge devient elevee, sans bloquer l'utilisation.

## Mise en place
- Ajout d'une notification "Alerte charge" dans `app.js`.
- Declenchement apres `saveState()` si `collectScalabilityReport()` detecte des seuils depasses.
- Anti-spam:
  - meme alerte ignoree pendant 2 minutes.

## Ce qui ne change pas
- Aucun blocage de sauvegarde.
- Aucun changement de structure des donnees.
- Aucun changement Supabase.
