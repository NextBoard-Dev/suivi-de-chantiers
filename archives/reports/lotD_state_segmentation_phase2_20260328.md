# Lot D - Segmentation JSON monolithique (Phase 2)

## Objectif
Activer un diagnostic de tailles de segments, sans modifier le flux actuel de sauvegarde/chargement.

## Ce qui est actif
- Diagnostic en memoire seulement (lecture seule):
  - `window.__stateSegmentationDiag`
  - `runtimePerf.lastSegmentSizes`
  - `runtimePerf.lastSegmentationAt`

## Quand il est calcule
- A chaque `saveState()` (apres normalisation)
- En fallback pendant `collectScalabilityReport()` si absent

## Garanties
- Pas de changement de structure de `state_json` en stockage.
- Pas de changement des appels Supabase.
- Aucun changement visuel attendu dans l'UI.

## Etape suivante (Phase 3)
- Afficher ce diagnostic dans un panneau technique optionnel (admin), sans polluer l'UI standard.
