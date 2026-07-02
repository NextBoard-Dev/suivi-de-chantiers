# Plan Anti-Monolithe - Suivi de Chantiers

But : reduire progressivement app.js sans casser le dashboard.

Regle simple : on ne sort qu'un petit bloc a la fois.

## 1. Ce qu'on peut sortir en premier

### js/core/date-time-utils.js
Fonctions de dates et d'heures.

Pourquoi c'est le meilleur debut :
- peu de dependance a l'ecran ;
- utilise partout ;
- risque faible ;
- commun aux deux versions.

Exemples de fonctions candidates :
- toInputDate
- formatDate
- durationDays
- isWeekday
- toLocalDateKey
- formatHoursMinutes
- conversions heures / minutes

Validation apres extraction :
- ouvrir un projet ;
- ouvrir la modale heures ;
- saisir une heure ;
- verifier les dates dans le tableau ;
- verifier un export PDF simple.

## 2. Deuxieme bloc a sortir

### js/core/render-scheduler.js
Fonctions qui organisent les rendus.

Pourquoi :
- evite les repetitions de patchs ;
- rend la logique de rendu plus lisible ;
- fixe une facon canonique de rafraichir l'UI.

Fonctions candidates :
- renderProjectLiteThenHeavy
- scheduleDeferredProjectHeavyRefresh
- schedulePostSaveRenderAll, uniquement en local si besoin

Validation apres extraction :
- ouvrir un chantier ;
- ajouter une tache ;
- supprimer une tache ;
- revenir au tableau maitre ;
- verifier que les onglets restent corrects.

## 3. Troisieme bloc possible

### js/core/perf.js
Mesures de performance et alertes UI lente.

Pourquoi plus tard :
- depend des rendus ;
- a stabiliser apres render-scheduler.

Fonctions candidates :
- trackPerfSample
- runtimePerf helpers
- alertes de rendu lent

## 4. Bloc plus risque

### js/features/export-pdf.js
Export PDF et modale export.

Pourquoi plus risque :
- beaucoup de DOM ;
- beaucoup de HTML genere ;
- impact visuel important.

A faire seulement apres dates et rendu.

Fonctions candidates :
- renderUnifiedExportModulesList
- getUnifiedExportProjectCompletion
- normalizeUnifiedExportProjectIds
- runUnifiedPdfExport

## 5. Bloc metier sensible

### js/features/config-techs.js
Techniciens, sites et affectations.

Attention :
- la version locale est plus avancee ;
- elle gere mieux les IDs stables et les sites ;
- ne pas fusionner brutalement avec la version hebergee.

Decision a prendre avant extraction :
- soit la logique locale devient canonique ;
- soit on garde deux comportements separes.

## 6. Ce qu'il ne faut pas sortir maintenant

### saveState
Ne pas aligner maintenant.

Pourquoi :
- version locale : API locale, SQLite, checkpoints, audit ;
- version hebergee : Supabase ;
- trop risqué pour une premiere extraction.

### Supabase / API locale
Ne pas mélanger.

Chaque version garde son adaptateur de sauvegarde.

## Ordre recommande

1. Documenter les fonctions candidates.
2. Extraire js/core/date-time-utils.js.
3. Tester dates, heures et export simple.
4. Extraire js/core/render-scheduler.js.
5. Tester navigation et edition projet/tache.
6. Ensuite seulement regarder perf, export PDF, techniciens.

## Regles de securite

Avant chaque extraction :
- faire un snap ;
- modifier une seule famille de fonctions ;
- garder app.js comme orchestrateur ;
- ne pas changer le metier ;
- lancer node --check app.js ;
- tester dans le navigateur.

Si une extraction augmente le risque, on stoppe et on garde le bloc dans app.js.
