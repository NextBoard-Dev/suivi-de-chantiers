# CHARTE - Règles de Travail Projet (Sébastien DUC)

## 1) Principe général
- Modifier uniquement le minimum nécessaire.
- Ne pas casser l’interface utilisateur.
- Préserver HTML/CSS existants sauf demande explicite.
- Éviter les régressions.
- Donner des explications simples, sans jargon inutile.

## 2) Sécurité avant modification sensible
- Toute modification sensible doit proposer un snapshot avant action.
- Message standard:
  "⚠️ Cette modification peut impacter plusieurs parties du projet. Souhaitez-vous créer un snapshot de sécurité avant intervention ?"
- Modifications sensibles: persistance, logique Supabase, JSON, état global, multi-fichiers, suppressions/remplacements de fonctions.

## 3) Convention snapshots
- Format: YYYYMMDD_HHMMSS_Contexte
- Format recommandé: `YYYYMMDD_HHMMSS_ContexteCourt`
- Les snapshots sont rangés dans `snapshots_ok/` (dossier de lot si plusieurs fichiers)
- Les snapshots ne sont jamais commit/push (`snapshots_ok/` exclu)
- Les archives de snapshots (`archives/snapshots_old/`, `archives/backup_copies/`) ne sont jamais commit/push
- Inclure au minimum les fichiers réellement touchés (`app.js`, `index.html`, `style.css` + docs si modifiées)

## 4) Règles UI / produit demandées
- Les exports PDF doivent ouvrir un vrai PDF imprimable (pas une capture brute).
- Boutons export placés dans les cartes demandées.
- En mode impression, éviter les cartes tronquées et les sauts de page incohérents.
- En cas d’action demandée sur une ligne/tâche, le clic doit amener à la tâche concernée.
- Saisie d’heures: 0 est une valeur valide; "vide" = heure manquante.
- Les alertes d’heures manquantes doivent se baser sur "vide", pas sur 0.

## 5) Données et compatibilité
- Préserver la compatibilité de structure avec l’ancien dashboard quand demandé.
- Ne pas altérer la synchronisation Supabase sans demande explicite.
- Distinguer clairement base principale et base miroir si les deux existent.

## 6) Communication
- Réponses courtes, concrètes, orientées action.
- Si le besoin est ambigu, poser une question avant de coder.
- Si l’utilisateur dit "go", exécuter directement.
- Après reformulation d’une demande, attendre explicitement le `GO` avant toute modification.

## 7) Résolution écran / layout
- Toute modification UI doit rester stable en changement de résolution.
- Le positionnement des blocs majeurs (topbar, sidebar, contenu central, boutons d’action) ne doit pas être réorganisé automatiquement selon la taille d’écran, sauf demande explicite.
- Si l’espace manque, privilégier le scroll navigateur plutôt qu’un déplacement de la structure.
- Validation systématique sur au moins 2 tailles de fenêtre (large + portable) avant livraison.

## 8) Harmonisation visuelle
- Référence visuelle prioritaire: dashboard `Suivi des effets`.
- Procéder par lots courts et réversibles.
- Après chaque lot: exécuter les tests et fournir la phrase de commit.

## 9) Mise à jour 2026-03-27
- Smartphone: modifications autorisées sur demande explicite.
- Commit/push: sélectif par lot validé (PC ou smartphone), puis push après vérification UI locale.
- Contrôle cloud: considérer "OK métier" si les seuls écarts sont des `updatedAt`.
- Heures manquantes: la règle inclut aujourd’hui (`date <= date du jour`).

## 10) Commit (obligatoire)
- Fournir la phrase de commit à chaque commit décidé.


