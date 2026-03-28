Règles de fonctionnement — SUIVI DE CHANTIERS

Ce document est la référence à suivre pour toute modification du dashboard.

1) Langue et communication
- Répondre en français.
- Si une question est posée ("?"), répondre avant d’agir et reformuler la demande pour validation.
- Toujours répondre d’abord aux questions explicites avant d’agir.
- Développer les propositions avant d’exécuter (objectifs, portée, impact).
- Considérer que l’utilisateur est novice : explications simples, sans jargon.

2) Sécurité et risques
- Avant toute modification risquée, annoncer le niveau de risque, proposer une sauvegarde et attendre l’accord.
- Toujours expliciter “risqué / non risqué” avant d’agir.
- Si la modification est annoncée “non risquée”, confirmer ce statut avant d’agir.
- Décider soi-même si une sauvegarde est nécessaire, en fonction de la nature de la modification.
- Si la demande implique trop de modifications, proposer une sauvegarde avant de commencer.
- Ne jamais faire de changements destructifs sans validation.
- Éviter tout dommage collatéral : modifications isolées et contrôlées.

3) Compatibilité
- Toute modification doit rester compatible avec :
  - Front GitHub Pages
  - Back Supabase
- Signaler à l’avance toute incompatibilité potentielle.

4) Qualité et vérification
- Après chaque modification :
  - Inspecter et vérifier le résultat
  - Vérifier l’absence d’erreurs (console si nécessaire)
  - Vérifier les accents (aucun caractère cassé)
- Étendre la détection des problèmes : rechercher systématiquement les chaînes tronquées (ex: “connect”, “tche”), les libellés incomplets, et tout texte anormal dans l’UI.
- Si un doute existe, faire un scan ciblé dans le code et les données, puis corriger.
- Ne jamais laisser d’erreurs d’accents dans l’UI ou les textes.
- Vérifier que les styles spécifiques (ex: surlignage “aujourd’hui”, colonnes spéciales) ne sont pas écrasés par des styles génériques (ex: .table th/td).
- À chaque demande de correction, mettre à jour ce fichier de règles si nécessaire.

5) Processus d’amélioration
- Proposer une seule amélioration à la fois.
- Après validation, appliquer uniquement cette amélioration.
- Puis vérifier, faire valider, et passer à la suivante.
- Chaque action doit être facilement réversible.

6) Règles de login (temporaire)
- Le login peut être désactivé temporairement sur demande.
- Toute modification future du login devra être expliquée et validée avant action.

7) Règles métier (tâches)
- Dans Édition tâche, le bouton “Nouvelle” doit vider tous les champs et pré‑remplir uniquement la Date début avec la date du jour.
- Temps réel : les heures réelles sont stockées dans state.timeLogs et synchronisées dans state_json (Supabase).

8) UI - Concepteur
- Le logo copyright “©” doit toujours être visible à côté du texte “Concepteur : Sébastien DUC”.
- Le logo copyright “©” doit aussi être visible dans l’en-tête principal à côté du nom “Sébastien DUC”.
- Le texte “Concepteur : Sébastien DUC ©” doit apparaître aussi dans les PDF.

9) Uniformité visuelle
- Les boutons et pastilles KPI doivent garder une hauteur homogène et des arrondis modérés dans tous les onglets.

10) Graphiques
- Dans les camemberts, les étiquettes (%) et valeurs (j) ne doivent jamais chevaucher le titre ni la légende.

11) Monitoring
- Pas d'erreur silencieuse: toute erreur runtime ou promesse rejetee doit etre visible via un bandeau utilisateur lisible.

12) Snapshots (obligatoire)
- Avant toute modification sensible, créer un snapshot.
- Nommage obligatoire: `YYYYMMDD_HHMMSS_ContexteCourt`.
- Stockage obligatoire: `snapshots_ok/`, dans un dossier de lot `YYYYMMDD_HHMMSS_ContexteCourt/` si plusieurs fichiers sont liés à la même action.
- Inclure au minimum selon le besoin: `app.js`, `index.html`, `style.css` (+ fichiers docs si modifiés).
- Les snapshots ne doivent jamais être commit/push sur GitHub (`snapshots_ok/` exclu).
- Les dossiers d'archives de snapshots (`archives/snapshots_old/`, `archives/backup_copies/`) ne doivent jamais etre commit/push.
- Conserver un fichier `LATEST_MAJOR_SNAPSHOT.txt` pour pointer le dernier snapshot majeur.

16) Méthode harmonisation (obligatoire)
- Référence visuelle: dashboard `Suivi des effets` (lecture seule).
- Travailler par petits lots réversibles (topbar, sidebar, zone centrale, modales).
- Ne pas toucher la logique métier JS sans demande explicite.
- Après chaque lot:
  - lancer `run_tests.bat`
  - proposer la phrase de commit.

13) Exports projet (métier)
- Export projet structuré pour usage comptable (immobilisation):
  - Cartouche
  - Gantt
  - Analyse heures réelles
  - Tableaux de synthèse et détails
  - Graphiques
- Calcul des heures réelles: uniquement dans la période de chaque tâche (`Début` à `Fin`).
- Synthèse intervenants: `INTERNE`, `RSG`, `RI` (hors ligne `EXTERNE`).
- Détail externe: par nom de prestataire.
- Détail tâche: `tâche + intervenant` avec ligne de total.

14) Impression / PDF
- Export projet: `A4 paysage` avec marges étroites.
- Exports Gantt dédiés: `A3 paysage` conservé.
- Optimiser l’occupation de page (espaces réduits, blocs utiles, pas de pages vides).

15) Stabilité multi-résolution (obligatoire)
- Toute modification UI doit préserver le positionnement des éléments clés (topbar, sidebar, zone centrale, actions).
- Interdiction de déplacer/restructurer ces blocs selon la résolution écran, sauf demande explicite de l’utilisateur.
- Le navigateur peut ajouter du scroll (horizontal/vertical) si nécessaire, mais pas casser la structure fonctionnelle.
- Avant validation, vérifier visuellement au minimum en fenêtre large et en fenêtre portable:
  - alignement des boutons d’action
  - accès au bouton "Completer Heures Réelles"
  - accès à la modale de saisie d’heures
  - lisibilité du tableau maître (entêtes + lignes).

17) Mise à jour 2026-03-27
- Détection "heures manquantes": inclure la date du jour (`<= today`).
- Qualité cloud: divergence tolérée si limitée au champ technique `updatedAt`.
- Commit/push: sélectif selon lot valide (PC ou smartphone), avec verification UI locale avant push.
- Lanceurs `.url` et `.bat` (PC + smartphone) conservés en racine.

18) Commit (obligatoire)
- A chaque commit decide, fournir une phrase de commit claire avant execution.
- Push uniquement apres verification UI locale validee.
