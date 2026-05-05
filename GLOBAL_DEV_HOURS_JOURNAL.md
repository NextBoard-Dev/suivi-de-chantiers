# Journal Global Heures Dev (VS Code)

Ce journal sert de compteur manuel des heures de developpement pour ce projet.

## Regles
- Unite: heure decimale (ex: 1.5 = 1h30).
- A chaque lot valide: ajouter une ligne dans "Historique des increments".
- Le champ "Total cumule" est mis a jour apres chaque increment.

## Baseline
- Date: 2026-03-25
- Point central retenu (depart): 500 h

## Total cumule
- 505.6 h

## Historique des increments
| Date       | Projet | Lot / Objet | Delta (h) | Total apres (h) | Note |
|------------|--------|-------------|-----------|-----------------|------|
| 2026-03-25 | Suivi de Chantiers | Initialisation baseline | +0.0 | 500.0 | Point central retenu |
| 2026-03-25 | Suivi de Chantiers | Suppression split legacy interne par site | +0.7 | 500.7 | Lot logique metier |
| 2026-03-25 | Suivi de Chantiers | Alignement rappel heures manquantes (veille) | +0.6 | 501.3 | Rappel base sur specs attendues |
| 2026-03-25 | Suivi de Chantiers | Ajout test rappel veille multi-techniciens internes | +0.5 | 501.8 | Couverture test auto scenario attendu |
| 2026-03-25 | Suivi de Chantiers | Neutralisation definitive fonction purge logs | +0.3 | 502.1 | Protection anti-reactivation suppression historique |
| 2026-05-05 | Suivi de Chantiers | Correctif perf UI passe uppercase globale | +0.4 | 502.5 | Initial pass unique puis observer |
| 2026-05-05 | Suivi de Chantiers | Perf filtres sans invalidation dirty | +0.5 | 503.0 | Retrait markDirty sur filtres/recherche/toggle |
| 2026-05-05 | Suivi de Chantiers | Suppression node_modules smartphone (depollution) | +0.4 | 503.4 | Nettoyage dependances portable |
| 2026-05-05 | Suivi de Chantiers | Perf table master precompute real minutes | +0.6 | 504.0 | Suppression rescans logs par ligne |
| 2026-05-05 | Suivi de Chantiers | Perf cache metrics/workload master | +0.5 | 504.5 | Skip recalcul si meme signature |
| 2026-05-05 | Suivi de Chantiers | Masquage par defaut des taches 100% + toggle | +0.6 | 505.1 | Affichage des termines au clic |
| 2026-05-05 | Suivi de Chantiers | Toggle termines + marquage badges sidebar | +0.5 | 505.6 | Bouton visible si termines masques |

