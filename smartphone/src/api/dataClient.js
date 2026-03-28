import { supabase, supabaseConfig } from "@/api/supabaseClient";
import {
  normalizeChantierInput,
  normalizeTaskInput,
  normalizeFiniteNumber,
  normalizeIsoDate,
  normalizeStatuses,
  computeTaskProgressAuto,
} from "@/lib/businessRules";

const {
  projectsTable,
  tasksTable,
  taskProjectIdColumn,
  timeLogsTable,
  internalTechsTable,
  vendorsTable,
  refsSiteColumn,
  readOnlyMode,
  allowTaskWrites,
} = supabaseConfig;
const READ_PAGE_SIZE = 500;
const ID_BATCH_SIZE = 200;

const PROJECT_SELECT_COLUMNS = [
  "id",
  "name",
  "project_name",
  "site",
  "site_name",
  "subproject",
  "sub_project",
  "progress",
  "lifecycle_status",
  "status",
  "start_date",
  "start",
  "end_date",
  "end",
  "updated_date",
  "updated_at",
  "created_date",
  "created_at",
  "budget_estimated",
  "budget_actual",
  "penalty_amount",
].join(",");

const TASK_SELECT_COLUMNS = [
  "id",
  "project_id",
  "chantier_id",
  "description",
  "name",
  "owner_type",
  "owner",
  "vendor",
  "start_date",
  "start",
  "end_date",
  "end",
  "progress",
  "statuses",
  "status",
  "duration_days",
  "updated_date",
  "updated_at",
  "created_date",
  "created_at",
  "estimated_cost",
  "actual_cost",
  "penalty_amount",
].join(",");

const TIME_LOG_SELECT_COLUMNS = [
  "id",
  "task_id",
  "tache_id",
  "taskId",
  "project_id",
  "chantier_id",
  "projectId",
  "date",
  "log_date",
  "day",
  "role",
  "owner_type",
  "owner",
  "technician",
  "tech",
  "internal_tech",
  "vendor",
  "minutes",
  "hours",
  "note",
  "comment",
  "updated_date",
  "updated_at",
  "created_date",
  "created_at",
].join(",");

function applyDbFilters(query, filters = {}) {
  let next = query;
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      next = next.eq(key, value);
    }
  });
  return next;
}

function isMissingColumnError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return String(error?.code || "") === "42703" || (msg.includes("column") && msg.includes("does not exist"));
}

function chunkArray(values, size = ID_BATCH_SIZE) {
  const out = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size));
  }
  return out;
}

async function fetchPagedRows(tableName, {
  filters = {},
  selectColumns = "*",
  pageSize = READ_PAGE_SIZE,
  tolerateMissingTable = false,
  errorScope = "Lecture Supabase impossible",
} = {}) {
  const readChunk = async (columns) => {
    let offset = 0;
    const out = [];
    while (true) {
      let query = supabase.from(tableName).select(columns);
      query = applyDbFilters(query, filters).range(offset, offset + pageSize - 1);
      const { data, error } = await query;
      if (error) {
        if (tolerateMissingTable && isMissingOptionalTableError(error)) return [];
        throw error;
      }
      const chunk = data || [];
      out.push(...chunk);
      if (chunk.length < pageSize) break;
      offset += pageSize;
    }
    return out;
  };

  try {
    if (selectColumns && selectColumns !== "*") {
      try {
        return await readChunk(selectColumns);
      } catch (selectError) {
        const missingColumn = isMissingColumnError(selectError);
        if (!missingColumn) throw selectError;
      }
    }
    return await readChunk("*");
  } catch (error) {
    throw buildError(errorScope, error);
  }
}

async function fetchProjectsByIds(projectIds = []) {
  const ids = [...new Set((projectIds || []).filter(Boolean).map((id) => String(id)))];
  if (!ids.length) return [];

  const chunks = chunkArray(ids, ID_BATCH_SIZE);
  const rows = [];

  for (const chunk of chunks) {
    const readChunk = async (columns) => {
      const { data, error } = await supabase
        .from(projectsTable)
        .select(columns)
        .in("id", chunk);
      if (error) throw error;
      return data || [];
    };

    try {
      try {
        rows.push(...(await readChunk(PROJECT_SELECT_COLUMNS)));
      } catch (errorColumns) {
        if (!isMissingColumnError(errorColumns)) throw errorColumns;
        rows.push(...(await readChunk("*")));
      }
    } catch (error) {
      throw buildError("Lecture projets par lots impossible", error);
    }
  }

  return rows.map(mapProjectRow);
}

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

function toBool(value) {
  return value === true || String(value || "").toLowerCase() === "true";
}

function assertProjectWriteAllowed() {
  if (toBool(readOnlyMode)) {
    throw new Error("Mode lecture seule actif: ecriture projet desactivee.");
  }
}

function assertTaskWriteAllowed() {
  if (toBool(readOnlyMode)) {
    throw new Error("Mode lecture seule actif: ecriture tache desactivee.");
  }
  if (!toBool(allowTaskWrites)) {
    throw new Error("Ecriture tache desactivee (VITE_ALLOW_TASK_WRITES=false).");
  }
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

function mapTimeLogRow(row) {
  return {
    id: toStringId(row.id),
    task_id: toStringId(row.task_id ?? row.tache_id ?? row.taskId),
    project_id: toStringId(row.project_id ?? row.chantier_id ?? row.projectId),
    date: pickDate(row.date ?? row.log_date ?? row.day ?? ""),
    role: String(row.role ?? row.owner_type ?? row.owner ?? "").trim(),
    technician: String(row.technician ?? row.tech ?? row.internal_tech ?? "").trim(),
    vendor: String(row.vendor ?? "").trim(),
    minutes: Number.isFinite(Number(row.minutes)) ? Number(row.minutes) : 0,
    hours: Number.isFinite(Number(row.hours)) ? Number(row.hours) : null,
    note: String(row.note ?? row.comment ?? "").trim(),
    updated_date: row.updated_date || row.updated_at || "",
    created_date: row.created_date || row.created_at || "",
  };
}

function mapReferentialItemRow(row, kind) {
  const source = row?.name ?? row?.label ?? row?.value ?? row?.technician ?? row?.vendor ?? "";
  return {
    id: toStringId(row?.id),
    kind,
    name: String(source || "").trim(),
    site: String(row?.[refsSiteColumn] ?? row?.site ?? "").trim(),
    active: row?.active === undefined ? true : Boolean(row.active),
    updated_date: row?.updated_date || row?.updated_at || "",
    created_date: row?.created_date || row?.created_at || "",
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

function isMissingOptionalTableError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01" || message.includes("does not exist");
}

async function fetchProjects(filters = {}) {
  const rows = await fetchPagedRows(projectsTable, {
    filters,
    selectColumns: PROJECT_SELECT_COLUMNS,
    pageSize: READ_PAGE_SIZE,
    errorScope: "Lecture projets Supabase impossible",
  });
  return rows.map(mapProjectRow);
}

async function fetchTasks(filters = {}) {
  const rows = await fetchPagedRows(tasksTable, {
    filters,
    selectColumns: TASK_SELECT_COLUMNS,
    pageSize: READ_PAGE_SIZE,
    errorScope: "Lecture taches Supabase impossible",
  });
  return rows.map(mapTaskRow);
}

async function fetchTimeLogs(filters = {}) {
  const rows = await fetchPagedRows(timeLogsTable, {
    filters,
    selectColumns: TIME_LOG_SELECT_COLUMNS,
    pageSize: READ_PAGE_SIZE,
    tolerateMissingTable: true,
    errorScope: "Lecture time logs Supabase impossible",
  });
  return rows.map(mapTimeLogRow);
}

async function fetchReferential(tableName, kind, filters = {}) {
  const rows = await fetchPagedRows(tableName, {
    filters,
    selectColumns: "*",
    pageSize: READ_PAGE_SIZE,
    tolerateMissingTable: true,
    errorScope: `Lecture referentiel ${kind} impossible`,
  });
  return rows
    .map((row) => mapReferentialItemRow(row, kind))
    .filter((item) => !!item.name);
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
        assertProjectWriteAllowed();
        const payload = normalizeChantierInput(input);

        const { data, error } = await supabase.from(projectsTable).insert(payload).select("*").single();
        if (error) throw buildError("Creation chantier impossible", error);

        return mapProjectRow(data);
      },

      update: async (id, input) => {
        assertProjectWriteAllowed();
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
        assertProjectWriteAllowed();
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
          const projectRows = await fetchProjectsByIds(projectIds);
          projectMap = new Map(projectRows.map((mapped) => [mapped.id, mapped]));
        }

        const enriched = enrichTasks(tasks, projectMap);
        return applySort(enriched, sort).slice(0, limit);
      },

      create: async (input) => {
        assertTaskWriteAllowed();
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
        assertTaskWriteAllowed();
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
        assertTaskWriteAllowed();
        const { error } = await supabase.from(tasksTable).delete().eq("id", id);
        if (error) throw buildError("Suppression tache impossible", error);
        return { id };
      },
    },

    TimeLog: {
      list: async (sort = "-date", limit = 1000) => {
        const logs = await fetchTimeLogs();
        return applySort(logs, sort).slice(0, limit);
      },
      filter: async (filters = {}, sort = "-date", limit = 1000) => {
        const logs = await fetchTimeLogs(filters);
        return applySort(logs, sort).slice(0, limit);
      },
    },

    Referential: {
      listInternalTechs: async (filters = {}, sort = "name", limit = 500) => {
        const rows = await fetchReferential(internalTechsTable, "internal_tech", filters);
        return applySort(rows, sort).slice(0, limit);
      },
      listVendors: async (filters = {}, sort = "name", limit = 500) => {
        const rows = await fetchReferential(vendorsTable, "vendor", filters);
        return applySort(rows, sort).slice(0, limit);
      },
    },
  },
};

