import { supabase, supabaseConfig } from "@/api/supabaseClient";
import {
  normalizeChantierInput,
  normalizeTaskInput,
  normalizeFiniteNumber,
  normalizeIsoDate,
  normalizeStatuses,
  computeTaskProgressAuto,
} from "@/lib/businessRules";

const { projectsTable, tasksTable, taskProjectIdColumn } = supabaseConfig;

function toComparable(value) {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

function applySort(items, sortExpr) {
  if (!sortExpr) return [...items];
  const descending = sortExpr.startsWith("-");
  const key = descending ? sortExpr.slice(1) : sortExpr;

  return [...items].sort((a, b) => {
    const av = toComparable(a[key]);
    const bv = toComparable(b[key]);
    if (av === bv) return 0;
    return descending ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
  });
}

function pickDate(value) {
  if (!value) return "";
  const normalized = String(value).slice(0, 10);
  try {
    return normalizeIsoDate(normalized, { allowEmpty: true });
  } catch {
    return "";
  }
}

function safeProgress(value) {
  try {
    return normalizeFiniteNumber(value ?? 0, {
      field: "progress",
      min: 0,
      max: 100,
      decimals: 0,
      allowEmpty: false,
    });
  } catch {
    return 0;
  }
}

function toStringId(value) {
  return value === undefined || value === null ? "" : String(value);
}

function mapProjectRow(row) {
  return {
    id: toStringId(row.id),
    name: row.name || row.project_name || "",
    site: row.site || row.site_name || "",
    subproject: row.subproject || row.sub_project || "",
    progress: safeProgress(row.progress),
    lifecycle_status: row.lifecycle_status || row.status || "a_planifier",
    status: row.lifecycle_status || row.status || "a_planifier",
    start_date: pickDate(row.start_date || row.start),
    end_date: pickDate(row.end_date || row.end),
    updated_date: row.updated_date || row.updated_at || "",
    created_date: row.created_date || row.created_at || "",
    budget_estimated: row.budget_estimated ?? null,
    budget_actual: row.budget_actual ?? null,
    penalty_amount: row.penalty_amount ?? null,
  };
}

function mapTaskRow(row) {
  const statuses = normalizeStatuses(row.statuses ?? row.status ?? []);
  const startDate = pickDate(row.start_date || row.start);
  const endDate = pickDate(row.end_date || row.end);
  return {
    id: toStringId(row.id),
    project_id: toStringId(row[taskProjectIdColumn] ?? row.project_id ?? row.chantier_id),
    description: row.description || row.name || "",
    owner_type: row.owner_type || row.owner || "",
    vendor: row.vendor || "",
    start_date: startDate,
    end_date: endDate,
    progress: computeTaskProgressAuto(startDate, endDate),
    statuses,
    duration_days: Number.isFinite(Number(row.duration_days)) ? Number(row.duration_days) : 0,
    updated_date: row.updated_date || row.updated_at || "",
    created_date: row.created_date || row.created_at || "",
    estimated_cost: row.estimated_cost ?? null,
    actual_cost: row.actual_cost ?? null,
    penalty_amount: row.penalty_amount ?? null,
  };
}

function enrichTasks(tasks, projectsById) {
  return tasks.map((task) => {
    const project = projectsById.get(task.project_id);
    return {
      ...task,
      project_name: task.project_name || project?.name || "",
      site: task.site || project?.site || "",
    };
  });
}

function computeProjectProgress(project, tasks) {
  if (!tasks.length) return project.progress || 0;
  const avg = Math.round(tasks.reduce((sum, task) => sum + (task.progress || 0), 0) / tasks.length);
  return Number.isFinite(avg) ? avg : 0;
}

function buildError(scope, error) {
  const message = error?.message || "Erreur inconnue";
  return new Error(`${scope}: ${message}`);
}

async function fetchProjects(filters = {}) {
  let query = supabase.from(projectsTable).select("*");

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query = query.eq(key, value);
    }
  });

  const { data, error } = await query;
  if (error) throw buildError("Lecture projets Supabase impossible", error);
  return (data || []).map(mapProjectRow);
}

async function fetchTasks(filters = {}) {
  let query = supabase.from(tasksTable).select("*");

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query = query.eq(key, value);
    }
  });

  const { data, error } = await query;
  if (error) throw buildError("Lecture taches Supabase impossible", error);
  return (data || []).map(mapTaskRow);
}

function taskPayloadForWrite(normalizedTask) {
  return {
    [taskProjectIdColumn]: normalizedTask.project_id,
    description: normalizedTask.description,
    owner_type: normalizedTask.owner_type,
    vendor: normalizedTask.vendor,
    start_date: normalizedTask.start_date,
    end_date: normalizedTask.end_date,
    progress: normalizedTask.progress,
    statuses: normalizedTask.statuses,
    duration_days: normalizedTask.duration_days,
    updated_date: normalizedTask.updated_date,
    ...(normalizedTask.estimated_cost !== undefined ? { estimated_cost: normalizedTask.estimated_cost } : {}),
    ...(normalizedTask.actual_cost !== undefined ? { actual_cost: normalizedTask.actual_cost } : {}),
    ...(normalizedTask.penalty_amount !== undefined ? { penalty_amount: normalizedTask.penalty_amount } : {}),
  };
}

export const dataClient = {
  auth: {
    me: async () => null,
    logout: () => {},
    redirectToLogin: () => {},
  },
  entities: {
    Project: {
      list: async (sort = "-updated_date", limit = 200) => {
        const [projects, tasks] = await Promise.all([fetchProjects(), fetchTasks()]);
        const tasksByProject = new Map();
        for (const task of tasks) {
          const arr = tasksByProject.get(task.project_id) || [];
          arr.push(task);
          tasksByProject.set(task.project_id, arr);
        }

        const enriched = projects.map((project) => ({
          ...project,
          progress: computeProjectProgress(project, tasksByProject.get(project.id) || []),
        }));

        return applySort(enriched, sort).slice(0, limit);
      },

      filter: async (filters = {}, sort = "-updated_date", limit = 200) => {
        const projects = await fetchProjects(filters);
        const tasks = await fetchTasks();
        const tasksByProject = new Map();

        for (const task of tasks) {
          const arr = tasksByProject.get(task.project_id) || [];
          arr.push(task);
          tasksByProject.set(task.project_id, arr);
        }

        const enriched = projects.map((project) => ({
          ...project,
          progress: computeProjectProgress(project, tasksByProject.get(project.id) || []),
        }));

        return applySort(enriched, sort).slice(0, limit);
      },

      create: async (input) => {
        const payload = normalizeChantierInput(input);

        const { data, error } = await supabase.from(projectsTable).insert(payload).select("*").single();
        if (error) throw buildError("Creation chantier impossible", error);

        return mapProjectRow(data);
      },

      update: async (id, input) => {
        const { data: current, error: readError } = await supabase
          .from(projectsTable)
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (readError) throw buildError("Lecture chantier impossible", readError);
        if (!current) throw new Error(`Chantier introuvable: ${id}`);

        const existing = mapProjectRow(current);
        const payload = normalizeChantierInput(input, { existing });

        const { data, error } = await supabase
          .from(projectsTable)
          .update(payload)
          .eq("id", id)
          .select("*")
          .single();

        if (error) throw buildError("Mise a jour chantier impossible", error);
        return mapProjectRow(data);
      },

      delete: async (id) => {
        const { error: tasksError } = await supabase
          .from(tasksTable)
          .delete()
          .eq(taskProjectIdColumn, id);
        if (tasksError) throw buildError("Suppression taches chantier impossible", tasksError);

        const { error } = await supabase.from(projectsTable).delete().eq("id", id);
        if (error) throw buildError("Suppression chantier impossible", error);
        return { id };
      },
    },

    Task: {
      list: async (sort = "-updated_date", limit = 500) => {
        const [tasks, projects] = await Promise.all([fetchTasks(), fetchProjects()]);
        const projectMap = new Map(projects.map((p) => [p.id, p]));
        const enriched = enrichTasks(tasks, projectMap);

        return applySort(enriched, sort).slice(0, limit);
      },

      filter: async (filters = {}, sort = "-updated_date", limit = 500) => {
        const dbFilters = { ...filters };
        if (dbFilters.project_id && taskProjectIdColumn !== "project_id") {
          dbFilters[taskProjectIdColumn] = dbFilters.project_id;
          delete dbFilters.project_id;
        }

        const tasks = await fetchTasks(dbFilters);
        const projectIds = [...new Set(tasks.map((task) => task.project_id).filter(Boolean))];

        let projectMap = new Map();
        if (projectIds.length > 0) {
          const { data, error } = await supabase.from(projectsTable).select("*").in("id", projectIds);
          if (error) throw buildError("Lecture projets pour taches impossible", error);
          projectMap = new Map((data || []).map((row) => {
            const mapped = mapProjectRow(row);
            return [mapped.id, mapped];
          }));
        }

        const enriched = enrichTasks(tasks, projectMap);
        return applySort(enriched, sort).slice(0, limit);
      },

      create: async (input) => {
        const normalized = normalizeTaskInput(input);
        const payload = taskPayloadForWrite(normalized);

        const { data, error } = await supabase.from(tasksTable).insert(payload).select("*").single();
        if (error) throw buildError("Creation tache impossible", error);

        const mapped = mapTaskRow(data);
        const projectRows = await fetchProjects({ id: mapped.project_id });
        const projectMap = new Map(projectRows.map((p) => [p.id, p]));
        return enrichTasks([mapped], projectMap)[0];
      },

      update: async (id, input) => {
        const { data: current, error: readError } = await supabase
          .from(tasksTable)
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (readError) throw buildError("Lecture tache impossible", readError);
        if (!current) throw new Error(`Tache introuvable: ${id}`);

        const existing = mapTaskRow(current);
        const normalized = normalizeTaskInput({ ...existing, ...input }, { existing });
        const payload = taskPayloadForWrite(normalized);

        const { data, error } = await supabase
          .from(tasksTable)
          .update(payload)
          .eq("id", id)
          .select("*")
          .single();

        if (error) throw buildError("Mise a jour tache impossible", error);

        const mapped = mapTaskRow(data);
        const projectRows = await fetchProjects({ id: mapped.project_id });
        const projectMap = new Map(projectRows.map((p) => [p.id, p]));
        return enrichTasks([mapped], projectMap)[0];
      },

      delete: async (id) => {
        const { error } = await supabase.from(tasksTable).delete().eq("id", id);
        if (error) throw buildError("Suppression tache impossible", error);
        return { id };
      },
    },
  },
};

