# Plan Scalabilite Securise (pas a pas)

Ce document verrouille l'ordre d'amelioration pour supporter les ajouts de donnees futurs, sans regression UI.

## Ordre de lots valide
1. Lot A: cartographie + gel des zones critiques (ce lot)
2. Lot C: consolidation CSS sans changer le rendu
3. Lot B: decoupage progressif de `app.js`
4. Lot D: separation controlee du JSON monolithique
5. Lot E: seuils de charge + mode degrade
6. Lot F: non-regression complete (PC + smartphone + exports)

## Cartographie des zones critiques

### Risque ultra majeur
- `app.js` (monolithe principal: logique metier + UI + export)

### Risque majeur
- `style.css` (nombreuses surcharges/redefinitions)
- `suivi_chantiers_backup.json` (etat global monolithique)

### Risque moyen
- `index.html` (structure dense)
- `print.css` (impact export PDF)

## Regles de gel (anti "patch sur patch")
1. Ne plus corriger en urgence dans les zones critiques sans cartographie prealable.
2. Toute modification sur `app.js` ou `style.css` doit etre locale, ciblee, et justifiee.
3. Interdiction de dupliquer un selecteur CSS existant pour "forcer" un rendu.
4. Interdiction d'ajouter une nouvelle logique metier inline dans des handlers UI si une fonction existe deja.
5. Avant toute ecriture sensible:
   - choisir le niveau de snapshot (`normal`, `majeur`, `ultra majeur`)
   - creer snapshot local
   - verifier `node --check app.js`
6. A chaque commit decide:
   - fournir la phrase de commit
   - verification UI locale avant push

## Cible de ce Lot A
- Stabiliser la methode de travail.
- Eviter les regressions dues a l'empilement de correctifs.
- Preparer les lots techniques suivants avec un risque controle.
