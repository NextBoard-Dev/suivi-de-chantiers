# Lot D - Segmentation JSON monolithique (Phase 1)

## Statut
Phase 1 terminee: **preparation uniquement**, sans bascule de comportement.

## Objectif
Preparer une architecture qui supporte mieux l'augmentation future des donnees, tout en gardant la compatibilite avec le stockage actuel (`state_json` unique).

## Changements effectues
1. Nouveau module pur: `js/core/state-segmentation.js`
2. Chargement du module dans `index.html` avant `app.js`

## Fonctions ajoutees (non invasives)
- `segmentStateForStorage(state)`
- `composeStateFromSegments(segments, fallbackState)`
- `estimateSegmentSizes(state)`

## Garanties
- Aucune modification du flux actuel `saveState` / `loadState`.
- Aucune modification des appels Supabase existants.
- Aucun impact attendu sur l'UI.

## Etape suivante recommandee (Phase 2)
- Activer un mode diagnostic (lecture seule) pour logger les tailles de segments en local.
- Valider que la repartition des tailles reste coherente quand le volume augmente.
