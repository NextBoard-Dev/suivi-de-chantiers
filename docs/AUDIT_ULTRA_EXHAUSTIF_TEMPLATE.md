# AUDIT ULTRA EXHAUSTIF - TEMPLATE REUTILISABLE

## Mode obligatoire
- Lecture seule
- Aucun patch
- Aucun commit
- Aucun refactor
- Aucun formatage

## Objectif
Diagnostiquer de maniere fiable tous les risques restants (visibles et caches) avant mise en production.

## Perimetre
1. Version desktop / PC
2. Version mobile / smartphone
3. Frontend global (UI/UX)
4. Backend (DB/API/auth)
5. Infra repo + build + deploiement

## Axes d'audit
### 1. Architecture
- Cohérence desktop vs mobile
- Cohérence front/back
- Duplications de logique
- Dette technique
- Couplages fragiles
- Cohérence des caches

### 2. Frontend
- Rendu principal (table, gantt, KPI, badges)
- Navigation et filtres
- Saisie (creation/modification/suppression)
- Modales/toasts/messages
- Admin vs user
- Performance percue

### 3. Backend
- Source de verite reelle
- Cohérence de schema
- Integrite des donnees
- Sessions et conflits d'ecriture
- Performance des lectures/ecritures

### 4. Infra / Deploiement
- Scripts build/deploy
- Versioning assets
- Risques de cache navigateur
- Rollback possible
- Divergence local vs prod

### 5. Logique metier
- KPI (coherence inter-vues)
- Heures / missing days / missing entries
- Progression / statuts
- Tri / filtres / aggregation

### 6. Performance
- Temps render global
- Cout recalculs
- Cout DOM
- Cout table / gantt / KPI
- Seuils d'alerte

### 7. Qualite code
- Fonctions trop longues
- Code mort / duplications
- Risques async / race
- Global state fragile
- Fallbacks masquant des bugs

### 8. UX
- Clarte des etats
- Messages d'erreur utiles
- Actions irreversibles
- Surcharge visuelle

### 9. Tests / Fiabilite
- Tests unitaires/fonctionnels existants
- Fuzzing
- Couverture utile vs manquante
- Cas limites non testes

### 10. Patch stacking
- Lister patchs recents
- Classer: utiles / neutres / risques / inutiles
- Identifier contradictions et redondances

## Livrable attendu
### A. Resume executif
- Verdict PC
- Verdict smartphone
- Verdict backend
- Verdict global

### B. Problemes critiques
- Impact
- Cause
- Preuve

### C. Problemes importants
### D. Problemes mineurs
### E. Regressions potentielles
### F. Analyse des patchs empiles

### G. Scoring /20
- Architecture
- Frontend
- Backend
- Cohérence globale
- UI
- UX
- Performance
- Robustesse
- Securite
- Maintenabilite
- Preparation prod

### H. Plan d'action priorise
- A faire maintenant
- A faire plus tard
- A ne pas toucher

## Validation technique a fournir
- Commandes executees
- Tests executes
- Resultats bruts utiles
- Conclusion:
  - GO PROD
  - GO PROD AVEC RESERVES
  - NON GO

