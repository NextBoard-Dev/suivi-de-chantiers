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
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
