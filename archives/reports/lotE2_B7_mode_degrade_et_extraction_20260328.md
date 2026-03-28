# Lot E2 + B7 (2026-03-28)

## E2 - Mode decharge automatique (non bloquant)
- Activation automatique du mode allege quand la charge depasse les seuils.
- Indication visible dans le badge qualite: `Mode allege`.
- En mode allege, les animations couteuses sont coupees:
  - `animateBadgeChanges`
  - `animateCardsInView`
- Aucune perte de donnees, aucune coupure de sauvegarde, aucune modification Supabase.

## B7 - Reduction monolithe `app.js`
- Extraction utilitaires purs vers `js/core/scalability-utils.js`:
  - `normalizeComparableField`
  - `computeMapDiffStats`
  - `estimateStateBytes`
- `app.js` utilise maintenant ces utilitaires via `window.*` avec fallback local.

## Risque
- Niveau: MAJEUR (touches transverses sur performance), mais implementation minimale et reversible.
