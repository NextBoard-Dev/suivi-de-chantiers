# Lot D - Segmentation JSON monolithique (Phase 3)

## Objectif
Afficher un mini diagnostic technique, uniquement pour l'admin.

## Ce qui a ete fait
- Ajout d'un texte de diagnostic dans la zone utilisateur (`topbarUser`) quand role = `admin`.
- Le diagnostic affiche:
  - taille etat total
  - taille segment projets
  - taille segment taches
  - taille segment logs

## Important
- Aucun affichage supplementaire pour les utilisateurs non-admin.
- Aucun changement sur la logique de sauvegarde/chargement.
- Aucun changement sur les appels Supabase.
