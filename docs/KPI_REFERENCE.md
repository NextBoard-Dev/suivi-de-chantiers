# KPI Reference (PC + Smartphone)

Source of truth (all KPI): `app_states.state_json`

## CHANTIERS
- Name: `CHANTIERS`
- Formula: `count(distinct project id from task population)`
- Source: `state_json.tasks` (project id normalized), validated against `state_json.projects`
- Scope: active view population

## TACHES
- Name: `TACHES`
- Formula: `task population length`
- Source: `state_json.tasks`
- Scope: active view population

## HEURES A SAISIR
- Name: `HEURES A SAISIR`
- Formula: expected daily entries (task x expected assignee) missing real hours where missing means only `null|undefined|""`; `0` is valid
- Source: `state_json.tasks` + `state_json.timeLogs`
- Scope: today-only, weekday-only, task active in date range

## AVANCEMENT GLOBAL
- Name: `AVANCEMENT GLOBAL`
- Formula: weighted average of `taskProgressAuto` by weekday duration (`max(1, weekdayDuration)`)
- Source: `state_json.tasks`
- Scope: dated tasks in active view population

## EN COURS
- Name: `EN COURS`
- Formula: `start_date <= today <= end_date`
- Source: `state_json.tasks`
- Scope: active view population

## TERMINEES
- Name: `TERMINEES`
- Formula: `taskProgressAuto >= 100`
- Source: `state_json.tasks`
- Scope: active view population
