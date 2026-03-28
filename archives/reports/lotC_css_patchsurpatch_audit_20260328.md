# Lot C - Audit CSS "patch sur patch" (2026-03-28)

## Objectif
Consolider `style.css` sans changer le rendu UI.

## Constat (zones critiques)
- `style.css` = 5655 lignes.
- Selecteurs redefinis plusieurs fois (risque de regressions):
  - `#btnToggleProjectStatus.btn-primary` (9 occurrences)
  - `.sidebar` (6)
  - `#btnToggleProjectStatus.btn-ghost` (6)
  - `.topbar` (5)
  - `.theme-toggle` (5)
  - `.layout` (4)
  - `.kpi` (4)
  - `.table`, `.table th`, `.table td` (3+)

## Risque
- Niveau: MAJEUR
- Cause: empilement de correctifs (ordre CSS fragile).
- Effet possible: correction locale qui casse une autre zone (topbar, sidebar, tableau, boutons).

## Strategie sure (sans regression)
1. Ne pas supprimer en masse.
2. Travailler par micro-lots (1 bloc fonctionnel a la fois):
   - bloc boutons topbar
   - bloc sidebar
   - bloc table
3. Pour chaque micro-lot:
   - regrouper uniquement les declarations identiques
   - conserver l'ordre final effectif
   - valider UI locale immediatement
4. Eviter toute reorganisation globale tant que les tests visuels ne sont pas valides.

## Micro-lot recommande (prochain pas)
- C1: `#btnToggleProjectStatus` (regles redondantes exactes seulement)
- C2: `.table th/.table td` (doublons strictement identiques)
- C3: `.topbar .btn::after` (doublons strictement identiques)

## Regle de securite Lot C
- Si un doute existe sur l'effet d'une ligne CSS: ne pas supprimer.
