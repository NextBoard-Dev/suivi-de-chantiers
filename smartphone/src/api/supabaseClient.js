import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment."
  );
}

export const supabaseConfig = {
  projectsTable: import.meta.env.VITE_SUPABASE_PROJECTS_TABLE || "chantiers",
  tasksTable: import.meta.env.VITE_SUPABASE_TASKS_TABLE || "chantier_tasks",
  taskProjectIdColumn: import.meta.env.VITE_SUPABASE_TASKS_PROJECT_ID_COLUMN || "project_id",
  timeLogsTable: import.meta.env.VITE_SUPABASE_TIME_LOGS_TABLE || "chantier_time_logs",
  internalTechsTable: import.meta.env.VITE_SUPABASE_INTERNAL_TECHS_TABLE || "chantier_internal_techs",
  vendorsTable: import.meta.env.VITE_SUPABASE_VENDORS_TABLE || "chantier_vendors",
  refsSiteColumn: import.meta.env.VITE_SUPABASE_REFS_SITE_COLUMN || "site",
  readOnlyMode: String(import.meta.env.VITE_READ_ONLY_MODE || "false").toLowerCase() === "true",
  allowTaskWrites: String(import.meta.env.VITE_ALLOW_TASK_WRITES || "true").toLowerCase() === "true",
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
