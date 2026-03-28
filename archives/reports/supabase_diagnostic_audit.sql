-- Diagnostic Supabase (lecture seule)
-- Date: 2026-03-28
-- Objectif: verifier structure, volumes, index et risques de performance.

-- 1) Tables cibles presentes ?
select table_schema, table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('chantiers','chantier_tasks','chantier_time_logs','app_states','users_store','login_events')
order by table_name;

-- 2) Volumes par table
select
  c.relname as table_name,
  c.reltuples::bigint as approx_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public'
  and c.relkind='r'
  and c.relname in ('chantiers','chantier_tasks','chantier_time_logs','app_states','users_store','login_events')
order by pg_total_relation_size(c.oid) desc;

-- 3) Top tables les plus lourdes (public)
select
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind='r'
order by pg_total_relation_size(c.oid) desc
limit 20;

-- 4) Index existants sur tables cibles
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname='public'
  and tablename in ('chantiers','chantier_tasks','chantier_time_logs','app_states','users_store','login_events')
order by tablename, indexname;

-- 5) Colonnes utiles pour filtres/joins (a verifier)
select table_name, column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name in ('chantiers','chantier_tasks','chantier_time_logs','app_states','users_store','login_events')
  and column_name in ('id','project_id','task_id','site','updated_at','updated_date','date','user_id')
order by table_name, column_name;

-- 6) Comptages de coherence smartphone
-- (adaptez les noms de colonnes si besoin)
select
  (select count(*) from public.chantiers) as projects_count,
  (select count(*) from public.chantier_tasks) as tasks_count,
  (select count(*) from public.chantier_time_logs) as timelogs_count;

-- 7) Exemples de requetes couteuses a tester (EXPLAIN)
-- Note: ces requetes ne modifient rien.
explain analyze
select *
from public.chantier_tasks
where project_id is not null
order by updated_at desc nulls last
limit 200;

explain analyze
select *
from public.chantier_time_logs
where project_id is not null
order by date desc nulls last
limit 500;

-- 8) Taille JSON global PC (si table app_states / state_json)
-- ignorez si table absente.
select
  user_id,
  octet_length(state_json::text) as state_json_bytes,
  updated_at
from public.app_states
order by octet_length(state_json::text) desc
limit 20;

-- 9) Recommandation index (a executer seulement apres validation)
-- create index concurrently if not exists idx_tasks_project_id on public.chantier_tasks(project_id);
-- create index concurrently if not exists idx_tasks_updated_at on public.chantier_tasks(updated_at desc);
-- create index concurrently if not exists idx_logs_project_date on public.chantier_time_logs(project_id, date desc);
-- create index concurrently if not exists idx_logs_task_date on public.chantier_time_logs(task_id, date desc);
