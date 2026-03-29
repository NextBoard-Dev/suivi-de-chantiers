import { supabase, supabaseConfig } from "@/api/supabaseClient";
import {
  normalizeChantierInput,
  normalizeTaskInput,
  normalizeFiniteNumber,
  normalizeIsoDate,
  normalizeString,
  normalizeStatuses,
  computeTaskProgressAuto,
} from "@/lib/businessRules";

const {
  projectsTable,
  tasksTable,
  taskProjectIdColumn,
  timeLogsTable,
  appStatesTable,
  internalTechsTable,
  vendorsTable,
  sitesTable,
  refsSiteColumn,
  readOnlyMode,
  allowTaskWrites,
  allowTimeLogWrites,
} = supabaseConfig;
const READ_PAGE_SIZE = 500;
const ID_BATCH_SIZE = 200;
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

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
  "internal_tech",
  "internal_techs",
  "internalTech",
  "internalTechs",
  "technician",
  "tech",
  "intervenant",
  "intervenant_label",
  "intervenants",
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
  "date_key",
  "date",
  "log_date",
  "day",
  "role_key",
  "role",
  "owner_type",
  "owner",
  "intervenant_label",
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

function normalizeMobileOwnerType(value) {
  const raw = String(value || "").trim();
  const up = raw.toUpperCase();
  if (!up) return "";
  if (up === "RSG/RI") return "RSG";
  if (up === "RSG") return "RSG";
  if (up === "RI") return "RI";
  if (up === "INTERNE" || up === "EQUIPE INTERNE" || up === "ÉQUIPE INTERNE") return "INTERNE";
  if (up === "EXTERNE" || up === "PRESTATAIRE EXTERNE" || up === "PRESTATAIRE") return "Prestataire externe";
  return raw;
}

function roleKeyFromOwnerType(value, { technician = "", vendor = "" } = {}) {
  const ownerType = normalizeMobileOwnerType(value);
  if (ownerType === "RI") return "ri";
  if (ownerType === "RSG") return "rsg";
  if (ownerType === "Prestataire externe") return "externe";
  if (ownerType === "INTERNE") return "interne";
  if (String(vendor || "").trim()) return "externe";
  if (String(technician || "").trim()) return "interne";
  return "interne";
}

function ownerTypeFromRoleKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return "";
  if (key === "ri") return "RI";
  if (key === "rsg") return "RSG";
  if (key === "externe") return "Prestataire externe";
  if (key === "interne") return "INTERNE";
  return "";
}

function stringifyInternalTech(value) {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .join(", ");
  }
  return String(value || "").trim();
}

function normalizeTechKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function splitInternalTechList(value) {
  return String(value || "")
    .split(",")
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function buildInternalTechAllowBySite(rows = []) {
  const bySite = new Map();
  for (const row of rows || []) {
    const nameKey = normalizeTechKey(row?.name || "");
    if (!nameKey) continue;
    const siteKey = normalizeTechKey(row?.site || "");
    if (!bySite.has(siteKey)) bySite.set(siteKey, new Set());
    bySite.get(siteKey).add(nameKey);
  }
  return bySite;
}

function sanitizeTaskInternalTechBySite(task, internalTechAllowBySite) {
  if (!task || task.owner_type !== "INTERNE") return task;
  if (!(internalTechAllowBySite instanceof Map)) return task;

  const names = splitInternalTechList(task.internal_tech);
  if (!names.length) return task;

  const siteKey = normalizeTechKey(task.site || "");
  const siteSet = internalTechAllowBySite.get(siteKey) || new Set();
  const globalSet = internalTechAllowBySite.get("") || new Set();
  const hasRules = siteSet.size > 0 || globalSet.size > 0;
  if (!hasRules) return task;

  const kept = names.filter((name) => {
    const key = normalizeTechKey(name);
    return !!key && (siteSet.has(key) || globalSet.has(key));
  });

  // Ne jamais masquer les noms venant de la tache:
  // si le referentiel ne matche pas completement, on conserve la valeur brute.
  if (!kept.length || kept.length !== names.length) return task;

  return {
    ...task,
    internal_tech: kept.join(", "),
  };
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

function assertTimeLogWriteAllowed() {
  if (toBool(readOnlyMode) && !toBool(allowTimeLogWrites)) {
    throw new Error("Mode lecture seule actif: saisie heures reelles desactivee.");
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
  const ownerLabel = String(row.owner ?? "").trim();
  const ownerTypeFromColumn = normalizeMobileOwnerType(row.owner_type || "");
  const ownerTypeFromOwner = normalizeMobileOwnerType(ownerLabel);
  const isOwnerLabelType =
    ownerTypeFromOwner === "INTERNE" ||
    ownerTypeFromOwner === "RSG" ||
    ownerTypeFromOwner === "RI" ||
    ownerTypeFromOwner === "Prestataire externe";

  let internalTech = stringifyInternalTech(
    row.internal_tech ??
    row.internal_techs ??
    row.internalTech ??
    row.internalTechs ??
    row.technician ??
    row.tech ??
    row.intervenant ??
    row.intervenant_label ??
    row.intervenants ??
    ""
  ).trim();
  let vendor = String(row.vendor || "").trim();
  let ownerType = ownerTypeFromColumn || (isOwnerLabelType ? ownerTypeFromOwner : "");
  if (!ownerType) ownerType = vendor ? "Prestataire externe" : (internalTech ? "INTERNE" : "");

  if (ownerType === "INTERNE" && !internalTech && ownerLabel && !isOwnerLabelType) {
    internalTech = ownerLabel;
  }
  if (ownerType === "Prestataire externe" && !vendor && ownerLabel && !isOwnerLabelType) {
    vendor = ownerLabel;
  }
  return {
    id: toStringId(row.id),
    project_id: toStringId(row[taskProjectIdColumn] ?? row.project_id ?? row.chantier_id),
    description: row.description || row.name || "",
    owner_type: ownerType,
    internal_tech: internalTech,
    vendor,
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
  const roleFromColumns = String(row.role ?? row.owner_type ?? row.owner ?? "").trim();
  const roleFromKey = ownerTypeFromRoleKey(row.role_key);
  const resolvedRole = roleFromColumns || roleFromKey;
  const intervenantLabel = String(row.intervenant_label ?? "").trim();
  let technician = String(row.technician ?? row.tech ?? row.internal_tech ?? "").trim();
  let vendor = String(row.vendor ?? "").trim();
  if (!technician && resolvedRole === "INTERNE" && intervenantLabel) technician = intervenantLabel;
  if (!vendor && resolvedRole === "Prestataire externe" && intervenantLabel) vendor = intervenantLabel;
  const roleKey = String(row.role_key || "").trim().toLowerCase()
    || roleKeyFromOwnerType(resolvedRole, {
      technician,
      vendor,
    });
  const minutesRaw = Number(row.minutes);
  const hoursRaw = Number(row.hours);
  const resolvedMinutes = Number.isFinite(minutesRaw)
    ? minutesRaw
    : (Number.isFinite(hoursRaw) ? Math.round(hoursRaw * 60) : 0);
  return {
    id: toStringId(row.id),
    task_id: toStringId(row.task_id ?? row.tache_id ?? row.taskId),
    project_id: toStringId(row.project_id ?? row.chantier_id ?? row.projectId),
    date: pickDate(row.date ?? row.log_date ?? row.day ?? row.date_key ?? ""),
    role_key: roleKey,
    role: resolvedRole,
    intervenant_label: intervenantLabel,
    technician,
    vendor,
    minutes: resolvedMinutes,
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

function enrichTasks(tasks, projectsById, internalTechAllowBySite = null) {
  return tasks.map((task) => {
    const project = projectsById.get(task.project_id);
    const enrichedTask = {
      ...task,
      project_name: task.project_name || project?.name || "",
      site: task.site || project?.site || "",
    };
    return sanitizeTaskInternalTechBySite(enrichedTask, internalTechAllowBySite);
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

function matchesFiltersInMemory(row, filters = {}) {
  return Object.entries(filters || {}).every(([key, value]) => {
    if (value === undefined || value === null || value === "") return true;
    return String(row?.[key] ?? "") === String(value);
  });
}

function mergeTimeLogSources(primaryLogs = [], legacyLogs = []) {
  const out = new Map();
  (legacyLogs || []).forEach((log) => {
    out.set(buildTimeLogIdentityKey(log), log);
  });
  (primaryLogs || []).forEach((log) => {
    out.set(buildTimeLogIdentityKey(log), log);
  });
  return Array.from(out.values());
}

async function fetchLegacyStateTimeLogs(filters = {}) {
  if (!appStatesTable) return [];
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return [];
    const userId = sessionData?.session?.user?.id || "";

    let stateRows = [];
    if (userId) {
      const { data, error } = await supabase
        .from(appStatesTable)
        .select("state_json, updated_at")
        .eq("user_id", userId)
        .limit(1);
      if (error) {
        if (isMissingOptionalTableError(error) || isMissingColumnError(error)) return [];
        throw error;
      }
      stateRows = Array.isArray(data) ? data : [];
    }
    if (!stateRows.length) {
      const { data, error } = await supabase
        .from(appStatesTable)
        .select("state_json, updated_at")
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) {
        if (isMissingOptionalTableError(error) || isMissingColumnError(error)) return [];
        throw error;
      }
      stateRows = Array.isArray(data) ? data : [];
    }

    const mapped = [];
    stateRows.forEach((row, rowIdx) => {
      const stateJson = row?.state_json;
      const rawLogs = Array.isArray(stateJson?.timeLogs) ? stateJson.timeLogs : [];
      rawLogs.forEach((log, idx) => {
        const taskId = toStringId(log?.taskId ?? log?.task_id ?? log?.tache_id);
        const dateVal = pickDate(log?.date ?? log?.date_key ?? log?.log_date ?? log?.day ?? "");
        mapped.push(mapTimeLogRow({
          id: toStringId(log?.id) || `legacy_${rowIdx}_${taskId}_${dateVal}_${idx}`,
          task_id: taskId,
          project_id: toStringId(log?.projectId ?? log?.project_id ?? log?.chantier_id),
          date_key: log?.date_key ?? dateVal,
          date: log?.date ?? dateVal,
          log_date: log?.log_date ?? dateVal,
          day: log?.day ?? dateVal,
          role_key: log?.role_key ?? "",
          role: log?.role ?? log?.owner_type ?? log?.owner ?? "",
          owner_type: log?.owner_type ?? "",
          owner: log?.owner ?? "",
          technician: log?.technician ?? log?.internalTech ?? log?.internal_tech ?? "",
          tech: log?.tech ?? log?.internalTech ?? log?.internal_tech ?? "",
          internal_tech: log?.internal_tech ?? log?.internalTech ?? "",
          vendor: log?.vendor ?? "",
          minutes: log?.minutes,
          hours: log?.hours,
          note: log?.note ?? log?.comment ?? "",
          comment: log?.comment ?? log?.note ?? "",
          updated_at: log?.updatedAt ?? log?.updated_at ?? row?.updated_at ?? "",
          created_at: log?.createdAt ?? log?.created_at ?? "",
        }));
      });
    });
    return mapped.filter((row) => matchesFiltersInMemory(row, filters));
  } catch {
    return [];
  }
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

function normalizeTimeLogInput(input = {}) {
  const taskId = toStringId(input.task_id ?? input.tache_id ?? input.taskId);
  if (!taskId) throw new Error("task_id obligatoire pour une saisie d'heures.");

  const projectId = toStringId(input.project_id ?? input.chantier_id ?? input.projectId);
  const date = normalizeIsoDate(input.date ?? input.log_date ?? input.day ?? input.date_key ?? "", {
    field: "date",
    allowEmpty: false,
  });

  const role = normalizeMobileOwnerType(input.role ?? input.owner_type ?? input.owner ?? "");
  const technician = normalizeString(input.technician ?? input.tech ?? input.internal_tech ?? "", { maxLength: 140, allowEmpty: true });
  const vendor = normalizeString(input.vendor ?? "", { maxLength: 140, allowEmpty: true });
  const resolvedRole = role || (vendor ? "Prestataire externe" : (technician ? "INTERNE" : ""));
  const roleKey = roleKeyFromOwnerType(resolvedRole, { technician, vendor });

  const hoursInput = input.hours;
  const minutesInput = input.minutes;
  let minutes;
  if (hoursInput !== undefined && hoursInput !== null && String(hoursInput).trim() !== "") {
    const hours = normalizeFiniteNumber(hoursInput, {
      field: "hours",
      min: 0,
      max: 24,
      decimals: 2,
      allowEmpty: false,
    });
    minutes = Math.round(hours * 60);
  } else {
    minutes = normalizeFiniteNumber(minutesInput, {
      field: "minutes",
      min: 0,
      max: 1440,
      decimals: 0,
      allowEmpty: false,
    });
  }

  return {
    task_id: taskId,
    project_id: projectId,
    date,
    role: resolvedRole,
    role_key: roleKey,
    technician,
    vendor,
    minutes,
    hours: Math.round((minutes / 60) * 100) / 100,
    note: normalizeString(input.note ?? input.comment ?? "", { maxLength: 500, allowEmpty: true }),
  };
}

function buildTimeLogIdentityKey(input = {}) {
  const roleKey = String(input.role_key || "").trim().toLowerCase()
    || roleKeyFromOwnerType(input.role || input.owner_type || input.owner || "", {
      technician: input.technician || input.internal_tech || "",
      vendor: input.vendor || "",
    });
  return [
    toStringId(input.task_id),
    pickDate(input.date || input.date_key || ""),
    normalizeTechKey(roleKey),
    normalizeTechKey(input.technician || input.internal_tech || ""),
    normalizeTechKey(input.vendor || ""),
  ].join("|");
}

function timeLogPayloadForWrite(normalized, { includeCreatedDate = false } = {}) {
  const nowIso = new Date().toISOString();
  const base = {
    task_id: normalized.task_id,
    project_id: normalized.project_id || null,
    date_key: normalized.date,
    role_key: normalized.role_key || roleKeyFromOwnerType(normalized.role, { technician: normalized.technician, vendor: normalized.vendor }),
    owner_type: normalized.role || null,
    intervenant_label: normalized.technician || normalized.vendor || normalized.role || null,
    technician: normalized.technician || null,
    vendor: normalized.vendor || null,
    minutes: normalized.minutes,
    hours: normalized.hours,
    note: normalized.note || null,
    updated_date: nowIso,
  };
  if (includeCreatedDate) base.created_date = nowIso;
  return base;
}

function extractMissingColumnName(error) {
  const message = String(error?.message || "");
  const match =
    message.match(/column\s+"([^"]+)"\s+does not exist/i) ||
    message.match(/column\s+'([^']+)'\s+/i) ||
    message.match(/column\s+([a-zA-Z0-9_]+)\s+does not exist/i) ||
    message.match(/'([^']+)'\s+column/i) ||
    message.match(/"([^"]+)"\s+column/i);
  return match?.[1] || "";
}

async function writeTimeLogWithColumnPruning({ mode, payload, id = "", onConflict = "" }) {
  const scope =
    mode === "insert"
      ? "Creation time log impossible"
      : (mode === "upsert" ? "Upsert time log impossible" : "Mise a jour time log impossible");
  const currentPayload = { ...payload };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    let query = supabase.from(timeLogsTable);
    if (mode === "insert") {
      query = query.insert(currentPayload);
    } else if (mode === "upsert") {
      query = query.upsert(currentPayload, { onConflict, ignoreDuplicates: false });
    } else {
      query = query.update(currentPayload).eq("id", id);
    }
    const { data, error } = await query.select("*").maybeSingle();
    if (!error) return data || null;

    const missingColumn = extractMissingColumnName(error);
    if (missingColumn && hasOwn(currentPayload, missingColumn)) {
      delete currentPayload[missingColumn];
      continue;
    }
    throw buildError(scope, error);
  }

  throw new Error(`${scope}: colonnes incompatibles avec la table Supabase.`);
}

function isNoMatchingConflictTargetError(error) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return code === "42P10" || msg.includes("no unique or exclusion constraint matching the on conflict specification");
}

function isDuplicateKeyError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("duplicate key value violates unique constraint");
}

function parseDuplicateConstraintColumns(error) {
  const details = String(error?.details || error?.message || "");
  const match = details.match(/\(([^)]+)\)=\(([^)]*)\)/);
  if (!match) return [];
  const cols = String(match[1] || "")
    .split(",")
    .map((c) => String(c || "").trim())
    .filter(Boolean);
  return cols;
}

async function findExistingTimeLogIdByDuplicateError(error, payload) {
  const cols = parseDuplicateConstraintColumns(error);
  if (!cols.length) return "";
  try {
    let query = supabase.from(timeLogsTable).select("id").limit(1);
    for (const col of cols) {
      if (!hasOwn(payload, col)) return "";
      query = query.eq(col, payload[col]);
    }
    const { data, error: selectError } = await query.maybeSingle();
    if (selectError) return "";
    return toStringId(data?.id);
  } catch {
    return "";
  }
}

async function findExistingTimeLogIdByNaturalKey(payload = {}) {
  const candidates = [
    ["task_id", "date_key", "role_key", "intervenant_label"],
    ["task_id", "date_key", "role_key", "technician"],
    ["task_id", "date_key", "role_key", "vendor"],
  ];
  for (const cols of candidates) {
    const hasAll = cols.every((col) => {
      const v = payload?.[col];
      return v !== undefined && v !== null && String(v).trim() !== "";
    });
    if (!hasAll) continue;
    try {
      let query = supabase.from(timeLogsTable).select("id").limit(1);
      cols.forEach((col) => {
        query = query.eq(col, payload[col]);
      });
      const { data, error } = await query;
      if (error) continue;
      const first = Array.isArray(data) ? data[0] : null;
      const foundId = toStringId(first?.id);
      if (foundId) return foundId;
    } catch {
      // try next candidate
    }
  }
  return "";
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
        const [tasks, projects, internalTechRows] = await Promise.all([
          fetchTasks(),
          fetchProjects(),
          fetchReferential(internalTechsTable, "internal_tech"),
        ]);
        const projectMap = new Map(projects.map((p) => [p.id, p]));
        const internalTechAllowBySite = buildInternalTechAllowBySite(internalTechRows);
        const enriched = enrichTasks(tasks, projectMap, internalTechAllowBySite);

        return applySort(enriched, sort).slice(0, limit);
      },

      filter: async (filters = {}, sort = "-updated_date", limit = 500) => {
        const dbFilters = { ...filters };
        if (dbFilters.project_id && taskProjectIdColumn !== "project_id") {
          dbFilters[taskProjectIdColumn] = dbFilters.project_id;
          delete dbFilters.project_id;
        }

        const [tasks, internalTechRows] = await Promise.all([
          fetchTasks(dbFilters),
          fetchReferential(internalTechsTable, "internal_tech"),
        ]);
        const projectIds = [...new Set(tasks.map((task) => task.project_id).filter(Boolean))];

        let projectMap = new Map();
        if (projectIds.length > 0) {
          const projectRows = await fetchProjectsByIds(projectIds);
          projectMap = new Map(projectRows.map((mapped) => [mapped.id, mapped]));
        }

        const internalTechAllowBySite = buildInternalTechAllowBySite(internalTechRows);
        const enriched = enrichTasks(tasks, projectMap, internalTechAllowBySite);
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
        const [logs, legacyLogs] = await Promise.all([
          fetchTimeLogs(),
          fetchLegacyStateTimeLogs(),
        ]);
        return applySort(mergeTimeLogSources(logs, legacyLogs), sort).slice(0, limit);
      },
      filter: async (filters = {}, sort = "-date", limit = 1000) => {
        const [logs, legacyLogs] = await Promise.all([
          fetchTimeLogs(filters),
          fetchLegacyStateTimeLogs(filters),
        ]);
        return applySort(mergeTimeLogSources(logs, legacyLogs), sort).slice(0, limit);
      },
      saveForTask: async (input) => {
        assertTimeLogWriteAllowed();
        const normalized = normalizeTimeLogInput(input);
        const identity = buildTimeLogIdentityKey(normalized);
        const updatePayload = timeLogPayloadForWrite(normalized, { includeCreatedDate: false });

        const naturalExistingId = await findExistingTimeLogIdByNaturalKey(updatePayload);
        if (naturalExistingId) {
          const updated = await writeTimeLogWithColumnPruning({
            mode: "update",
            payload: updatePayload,
            id: naturalExistingId,
          });
          return mapTimeLogRow(updated || { ...updatePayload, id: naturalExistingId });
        }

        const logs = await fetchTimeLogs();
        const existing = logs.find((log) =>
          buildTimeLogIdentityKey({
            task_id: log.task_id,
            date: log.date,
            role_key: log.role_key,
            role: log.role,
            technician: log.technician,
            vendor: log.vendor,
          }) === identity
        );

        if (existing?.id) {
          const written = await writeTimeLogWithColumnPruning({
            mode: "update",
            payload: updatePayload,
            id: existing.id,
          });
          return mapTimeLogRow(written || { ...updatePayload, id: existing.id });
        }

        const payload = timeLogPayloadForWrite(normalized, { includeCreatedDate: true });
        try {
          const written = await writeTimeLogWithColumnPruning({
            mode: "insert",
            payload,
          });
          return mapTimeLogRow(written || payload);
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error;
          const duplicateId = await findExistingTimeLogIdByDuplicateError(error, payload);
          if (duplicateId) {
            const updated = await writeTimeLogWithColumnPruning({
              mode: "update",
              payload: updatePayload,
              id: duplicateId,
            });
            return mapTimeLogRow(updated || { ...updatePayload, id: duplicateId });
          }
          const freshLogs = await fetchTimeLogs();
          const fallbackExisting = freshLogs.find((log) =>
            buildTimeLogIdentityKey({
              task_id: log.task_id,
              date: log.date,
              role_key: log.role_key,
              role: log.role,
              technician: log.technician,
              vendor: log.vendor,
            }) === identity
          );
          if (!fallbackExisting?.id) throw error;
          const updated = await writeTimeLogWithColumnPruning({
            mode: "update",
            payload: updatePayload,
            id: fallbackExisting.id,
          });
          return mapTimeLogRow(updated || { ...updatePayload, id: fallbackExisting.id });
        }
      },
    },

    Referential: {
      listSites: async (filters = {}, sort = "name", limit = 500) => {
        const rows = await fetchReferential(sitesTable, "site", filters);
        return applySort(rows, sort).slice(0, limit);
      },
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

