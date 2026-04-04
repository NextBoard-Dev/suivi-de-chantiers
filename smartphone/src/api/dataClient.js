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
  autoEmail,
  autoPassword,
  internalTechsTable,
  vendorsTable,
  sitesTable,
  refsSiteColumn,
  readOnlyMode,
  stateJsonReadMode,
  allowTaskWrites,
  allowTimeLogWrites,
} = supabaseConfig;
const READ_PAGE_SIZE = 500;
const ID_BATCH_SIZE = 200;
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
let legacyAutoLoginAttempted = false;
const strictStateJsonRead = String(stateJsonReadMode || "strict").toLowerCase() !== "auto";

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
      throw buildError("Lecture chantiers par lots impossible", error);
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

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
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

function normalizeSigText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeProjectKeyText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function buildProjectNaturalKey(projectLike = {}) {
  const site = normalizeProjectKeyText(projectLike.site ?? projectLike.site_name ?? "");
  const name = normalizeProjectKeyText(projectLike.name ?? projectLike.project_name ?? "");
  const sub = normalizeProjectKeyText(projectLike.subproject ?? projectLike.sub_project ?? "");
  return [site, name, sub].join("|");
}

function buildProjectLooseKey(projectLike = {}) {
  const site = normalizeProjectKeyText(projectLike.site ?? projectLike.site_name ?? "");
  const name = normalizeProjectKeyText(projectLike.name ?? projectLike.project_name ?? "");
  return [site, name].join("|");
}

function buildTaskSignature(taskLike = {}) {
  const ownerType = normalizeMobileOwnerType(taskLike.owner_type ?? taskLike.owner ?? "");
  const projectId = toStringId(taskLike.project_id ?? taskLike.projectId ?? taskLike.chantier_id);
  const description = normalizeSigText(taskLike.description ?? taskLike.roomNumber ?? taskLike.name ?? "");
  const startDate = pickDate(taskLike.start_date ?? taskLike.start ?? "");
  const endDate = pickDate(taskLike.end_date ?? taskLike.end ?? "");
  const internalTech = normalizeSigText(taskLike.internal_tech ?? taskLike.internalTech ?? taskLike.technician ?? "");
  const vendor = normalizeSigText(taskLike.vendor ?? "");
  return [projectId, description, ownerType, internalTech, vendor, startDate, endDate].join("|");
}

function buildTaskSignatureLoose(taskLike = {}) {
  const ownerType = normalizeMobileOwnerType(taskLike.owner_type ?? taskLike.owner ?? "");
  const description = normalizeSigText(taskLike.description ?? taskLike.roomNumber ?? taskLike.name ?? "");
  const startDate = pickDate(taskLike.start_date ?? taskLike.start ?? "");
  const endDate = pickDate(taskLike.end_date ?? taskLike.end ?? "");
  const internalTech = normalizeSigText(taskLike.internal_tech ?? taskLike.internalTech ?? taskLike.technician ?? "");
  const vendor = normalizeSigText(taskLike.vendor ?? "");
  return [description, ownerType, internalTech, vendor, startDate, endDate].join("|");
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
  if (!task || !internalTechAllowBySite || !(internalTechAllowBySite instanceof Map)) return task;
  if (normalizeMobileOwnerType(task.owner_type) !== "INTERNE") return task;

  const names = splitInternalTechList(task.internal_tech);
  if (!names.length) return task;

  const siteKey = normalizeTechKey(task.site || "");
  const allowSite = internalTechAllowBySite.get(siteKey);
  const allowGlobal = internalTechAllowBySite.get("") || new Set();

  // Si aucune regle n'existe pour ce site, on ne touche pas.
  if ((!allowSite || allowSite.size === 0) && allowGlobal.size === 0) return task;

  const filtered = names.filter((name) => {
    const key = normalizeTechKey(name);
    return (allowSite && allowSite.has(key)) || allowGlobal.has(key);
  });

  return {
    ...task,
    internal_tech: filtered.join(", "),
  };
}

function assertProjectWriteAllowed() {
  throw new Error("Smartphone: ecriture chantier desactivee (lecture seule).");
}

function assertTaskWriteAllowed() {
  throw new Error("Smartphone: ecriture tache desactivee (lecture seule).");
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
  const isGenericIntervenantLabel = (value) => {
    const normalized = normalizeMobileOwnerType(value);
    return normalized === "INTERNE" || normalized === "Prestataire externe" || normalized === "RSG" || normalized === "RI";
  };

  let internalTech = stringifyInternalTech(
    row.internal_tech ??
    row.internal_techs ??
    row.internalTech ??
    row.internalTechs ??
    row.technician ??
    row.tech ??
    row.intervenants ??
    ""
  ).trim();
  if (isGenericIntervenantLabel(internalTech)) internalTech = "";
  let vendor = String(row.vendor || "").trim();
  if (isGenericIntervenantLabel(vendor)) vendor = "";
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
  const parseDecimalLike = (value) => {
    if (value === null || value === undefined) return NaN;
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    const normalized = String(value).trim().replace(",", ".");
    if (!normalized) return NaN;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  };

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
  const minutesRaw = parseDecimalLike(row.minutes);
  const hoursRaw = parseDecimalLike(row.hours);
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
    legacy_task_signature: String(row.legacy_task_signature ?? "").trim(),
    legacy_task_signature_loose: String(row.legacy_task_signature_loose ?? "").trim(),
    legacy_project_key: String(row.legacy_project_key ?? "").trim(),
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
    errorScope: "Lecture chantiers Supabase impossible",
  });
  return rows.map(mapProjectRow);
}

function mergeProjectSources(primaryProjects = [], legacyProjects = []) {
  const out = new Map();
  const upsert = (project = {}, preferIncoming = false) => {
    const id = toStringId(project?.id);
    const natural = buildProjectNaturalKey(project);
    const key = id || natural;
    if (!key) return;
    const prev = out.get(key);
    if (!prev) {
      out.set(key, project);
      return;
    }
    const prevTs = new Date(prev?.updated_date || prev?.created_date || 0).getTime();
    const nextTs = new Date(project?.updated_date || project?.created_date || 0).getTime();
    if (preferIncoming || nextTs >= prevTs) {
      out.set(key, { ...prev, ...project });
    }
  };

  (legacyProjects || []).forEach((project) => upsert(project));
  (primaryProjects || []).forEach((project) => upsert(project, true));
  return Array.from(out.values());
}

function buildLegacyProjectId(projectLike = {}) {
  const key = buildProjectNaturalKey(projectLike);
  if (key) return `legacy_project_${key}`;
  const name = normalizeProjectKeyText(projectLike?.name ?? projectLike?.project_name ?? "");
  return name ? `legacy_project_${name}` : "";
}

function buildLegacyTaskId(taskLike = {}) {
  const projectId = toStringId(taskLike?.project_id ?? taskLike?.projectId ?? taskLike?.chantier_id);
  const description = normalizeSigText(taskLike?.description ?? taskLike?.name ?? taskLike?.roomNumber ?? "");
  const owner = normalizeMobileOwnerType(taskLike?.owner_type ?? taskLike?.owner ?? taskLike?.intervenant ?? "");
  const startDate = pickDate(taskLike?.start_date ?? taskLike?.start ?? "");
  const endDate = pickDate(taskLike?.end_date ?? taskLike?.end ?? "");
  const internalTech = normalizeSigText(taskLike?.internal_tech ?? taskLike?.internalTech ?? taskLike?.technician ?? "");
  const vendor = normalizeSigText(taskLike?.vendor ?? "");
  const key = [projectId, description, owner, internalTech, vendor, startDate, endDate].join("|");
  if (key.replace(/\|/g, "").trim()) return `legacy_task_${key}`;
  return "";
}

async function fetchLegacyStateProjects(filters = {}) {
  if (!appStatesTable) return [];
  try {
    let { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return [];
    let sessionUser = sessionData?.session?.user || null;
    const expectedEmail = String(autoEmail || "").trim().toLowerCase();
    const currentEmail = String(sessionUser?.email || "").trim().toLowerCase();
    const shouldAutoLogin = !sessionUser || (expectedEmail && currentEmail !== expectedEmail);
    if (shouldAutoLogin && !legacyAutoLoginAttempted) {
      legacyAutoLoginAttempted = true;
      const email = String(autoEmail || "").trim();
      const password = String(autoPassword || "").trim();
      if (email && password) {
        try {
          await supabase.auth.signInWithPassword({ email, password });
          const next = await supabase.auth.getSession();
          if (!next.error) {
            sessionData = next.data;
            sessionUser = sessionData?.session?.user || null;
          }
        } catch {
          // keep current session
        }
      }
    }
    const userId = sessionUser?.id || "";

    let stateRows = [];
    if (userId) {
      const { data, error } = await supabase
        .from(appStatesTable)
        .select("state_json, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
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
        .limit(1);
      if (error) {
        if (isMissingOptionalTableError(error) || isMissingColumnError(error)) return [];
        throw error;
      }
      stateRows = Array.isArray(data) ? data : [];
    }

    const mapped = [];
    stateRows.forEach((row) => {
      const stateJson = row?.state_json;
      const rawProjects = Array.isArray(stateJson?.projects) ? stateJson.projects : [];
      rawProjects.forEach((project, idx) => {
        const stableLegacyId =
          buildLegacyProjectId({
            id: project?.id ?? project?.project_id ?? "",
            name: project?.name ?? project?.project_name ?? "",
            project_name: project?.project_name ?? project?.name ?? "",
            site: project?.site ?? project?.site_name ?? "",
            site_name: project?.site_name ?? project?.site ?? "",
            subproject: project?.subproject ?? project?.sub_project ?? "",
            sub_project: project?.sub_project ?? project?.subproject ?? "",
          }) || `legacy_project_fallback_${idx}`;
        const mappedProject = mapProjectRow({
          id: project?.id ?? project?.project_id ?? stableLegacyId,
          name: project?.name ?? project?.project_name ?? "",
          project_name: project?.project_name ?? project?.name ?? "",
          site: project?.site ?? project?.site_name ?? "",
          site_name: project?.site_name ?? project?.site ?? "",
          subproject: project?.subproject ?? project?.sub_project ?? "",
          sub_project: project?.sub_project ?? project?.subproject ?? "",
          progress: project?.progress ?? 0,
          lifecycle_status: project?.lifecycle_status ?? project?.status ?? "a_planifier",
          status: project?.status ?? project?.lifecycle_status ?? "a_planifier",
          start_date: project?.start_date ?? project?.start ?? "",
          end_date: project?.end_date ?? project?.end ?? "",
          updated_date: project?.updated_date ?? project?.updatedAt ?? row?.updated_at ?? "",
          updated_at: project?.updated_at ?? project?.updatedAt ?? row?.updated_at ?? "",
          created_date: project?.created_date ?? project?.createdAt ?? "",
          created_at: project?.created_at ?? project?.createdAt ?? "",
          budget_estimated: project?.budget_estimated ?? null,
          budget_actual: project?.budget_actual ?? null,
          penalty_amount: project?.penalty_amount ?? null,
        });
        mapped.push(mappedProject);
      });
    });

    return mapped.filter((row) => matchesFiltersInMemory(row, filters));
  } catch {
    return [];
  }
}

function mergeTaskSources(primaryTasks = [], legacyTasks = []) {
  const out = new Map();
  const upsert = (task = {}, preferIncoming = false) => {
    const id = toStringId(task?.id);
    const signature = buildTaskSignature(task);
    const key = id || signature;
    if (!key) return;
    const prev = out.get(key);
    if (!prev) {
      out.set(key, task);
      return;
    }
    const prevTs = new Date(prev?.updated_date || prev?.created_date || 0).getTime();
    const nextTs = new Date(task?.updated_date || task?.created_date || 0).getTime();
    if (preferIncoming || nextTs >= prevTs) {
      out.set(key, { ...prev, ...task });
    }
  };

  (legacyTasks || []).forEach((task) => upsert(task));
  (primaryTasks || []).forEach((task) => upsert(task, true));
  return Array.from(out.values());
}

async function fetchLegacyStateTasks(filters = {}) {
  if (!appStatesTable) return [];
  try {
    let { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return [];
    let sessionUser = sessionData?.session?.user || null;
    const expectedEmail = String(autoEmail || "").trim().toLowerCase();
    const currentEmail = String(sessionUser?.email || "").trim().toLowerCase();
    const shouldAutoLogin = !sessionUser || (expectedEmail && currentEmail !== expectedEmail);
    if (shouldAutoLogin && !legacyAutoLoginAttempted) {
      legacyAutoLoginAttempted = true;
      const email = String(autoEmail || "").trim();
      const password = String(autoPassword || "").trim();
      if (email && password) {
        try {
          await supabase.auth.signInWithPassword({ email, password });
          const next = await supabase.auth.getSession();
          if (!next.error) {
            sessionData = next.data;
            sessionUser = sessionData?.session?.user || null;
          }
        } catch {
          // keep current session
        }
      }
    }
    const userId = sessionUser?.id || "";

    let stateRows = [];
    if (userId) {
      const { data, error } = await supabase
        .from(appStatesTable)
        .select("state_json, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
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
        .limit(1);
      if (error) {
        if (isMissingOptionalTableError(error) || isMissingColumnError(error)) return [];
        throw error;
      }
      stateRows = Array.isArray(data) ? data : [];
    }

    const mapped = [];
    stateRows.forEach((row, rowIdx) => {
      const stateJson = row?.state_json;
      const rawTasks = Array.isArray(stateJson?.tasks) ? stateJson.tasks : [];
      rawTasks.forEach((task, idx) => {
        const stableLegacyId = buildLegacyTaskId(task) || `legacy_task_fallback_${rowIdx}_${idx}`;
        const mappedTask = mapTaskRow({
          id: task?.id ?? task?.task_id ?? stableLegacyId,
          project_id: task?.projectId ?? task?.project_id ?? task?.chantier_id ?? "",
          chantier_id: task?.projectId ?? task?.chantier_id ?? task?.project_id ?? "",
          description: task?.roomNumber ?? task?.description ?? task?.name ?? "",
          name: task?.roomNumber ?? task?.name ?? task?.description ?? "",
          owner_type: task?.owner ?? task?.owner_type ?? task?.intervenant ?? "",
          owner: task?.owner ?? task?.owner_type ?? "",
          internal_tech: task?.internalTech ?? task?.internal_tech ?? task?.technician ?? "",
          internalTech: task?.internalTech ?? task?.internal_tech ?? "",
          technician: task?.internalTech ?? task?.technician ?? task?.internal_tech ?? "",
          tech: task?.internalTech ?? task?.tech ?? task?.internal_tech ?? "",
          intervenants: task?.intervenants ?? "",
          vendor: task?.vendor ?? "",
          start_date: task?.start_date ?? task?.start ?? "",
          start: task?.start ?? task?.start_date ?? "",
          end_date: task?.end_date ?? task?.end ?? "",
          end: task?.end ?? task?.end_date ?? "",
          progress: task?.progress ?? 0,
          statuses: task?.status ?? task?.statuses ?? [],
          status: task?.status ?? task?.statuses ?? [],
          duration_days: task?.duration_days ?? 0,
          updated_date: task?.updated_date ?? task?.updatedAt ?? row?.updated_at ?? "",
          updated_at: task?.updated_at ?? task?.updatedAt ?? row?.updated_at ?? "",
          created_date: task?.created_date ?? task?.createdAt ?? "",
          created_at: task?.created_at ?? task?.createdAt ?? "",
          estimated_cost: task?.estimated_cost ?? null,
          actual_cost: task?.actual_cost ?? null,
          penalty_amount: task?.penalty_amount ?? null,
        });
        mapped.push(mappedTask);
      });
    });
    return mapped.filter((row) => matchesFiltersInMemory(row, filters));
  } catch {
    return [];
  }
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
  const mergeRow = (base = {}, incoming = {}) => {
    const baseMinutes = Number(base?.minutes);
    const inMinutes = Number(incoming?.minutes);
    const sumMinutes =
      (Number.isFinite(baseMinutes) ? baseMinutes : 0) +
      (Number.isFinite(inMinutes) ? inMinutes : 0);
    const baseTs = new Date(base?.updated_date || base?.created_date || 0).getTime();
    const inTs = new Date(incoming?.updated_date || incoming?.created_date || 0).getTime();
    const latest = inTs >= baseTs ? incoming : base;
    return {
      ...base,
      ...incoming,
      ...latest,
      minutes: Math.max(0, Math.round(sumMinutes)),
      hours: Math.round((Math.max(0, Math.round(sumMinutes)) / 60) * 100) / 100,
    };
  };

  const out = new Map();
  (legacyLogs || []).forEach((log) => {
    const key = buildTimeLogIdentityKey(log);
    const prev = out.get(key);
    out.set(key, prev ? mergeRow(prev, log) : log);
  });
  (primaryLogs || []).forEach((log) => {
    const key = buildTimeLogIdentityKey(log);
    const prev = out.get(key);
    out.set(key, prev ? mergeRow(prev, log) : log);
  });
  return Array.from(out.values());
}

function dedupeTimeLogs(logs = []) {
  const mergeRow = (base = {}, incoming = {}) => {
    const baseMinutes = Number(base?.minutes);
    const inMinutes = Number(incoming?.minutes);
    const sumMinutes =
      (Number.isFinite(baseMinutes) ? baseMinutes : 0) +
      (Number.isFinite(inMinutes) ? inMinutes : 0);
    const baseTs = new Date(base?.updated_date || base?.created_date || 0).getTime();
    const inTs = new Date(incoming?.updated_date || incoming?.created_date || 0).getTime();
    const latest = inTs >= baseTs ? incoming : base;
    return {
      ...base,
      ...incoming,
      ...latest,
      minutes: Math.max(0, Math.round(sumMinutes)),
      hours: Math.round((Math.max(0, Math.round(sumMinutes)) / 60) * 100) / 100,
    };
  };

  const out = new Map();
  (logs || []).forEach((log) => {
    const key = buildTimeLogIdentityKey(log);
    const prev = out.get(key);
    out.set(key, prev ? mergeRow(prev, log) : log);
  });
  return Array.from(out.values());
}

function applyLimit(items = [], limit = 0) {
  const max = Number(limit);
  if (!Number.isFinite(max) || max <= 0) return [...items];
  return items.slice(0, max);
}

async function fetchLegacyStateTimeLogs(filters = {}) {
  if (!appStatesTable) return [];
  try {
    let { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return [];
    let sessionUser = sessionData?.session?.user || null;
    const expectedEmail = String(autoEmail || "").trim().toLowerCase();
    const currentEmail = String(sessionUser?.email || "").trim().toLowerCase();
    const shouldAutoLogin = !sessionUser || (expectedEmail && currentEmail !== expectedEmail);
    if (shouldAutoLogin && !legacyAutoLoginAttempted) {
      legacyAutoLoginAttempted = true;
      const email = String(autoEmail || "").trim();
      const password = String(autoPassword || "").trim();
      if (email && password) {
        try {
          await supabase.auth.signInWithPassword({ email, password });
          const next = await supabase.auth.getSession();
          if (!next.error) {
            sessionData = next.data;
            sessionUser = sessionData?.session?.user || null;
          }
        } catch {
          // keep current session
        }
      }
    }
    let userId = sessionUser?.id || "";

    let stateRows = [];
    if (userId) {
      const { data, error } = await supabase
        .from(appStatesTable)
        .select("state_json, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
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
        .limit(1);
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
      const legacyTasks = Array.isArray(stateJson?.tasks) ? stateJson.tasks : [];
      const legacyProjects = Array.isArray(stateJson?.projects) ? stateJson.projects : [];
      const taskById = new Map(legacyTasks.map((t) => [toStringId(t?.id), t]));
      const projectById = new Map(legacyProjects.map((p) => [toStringId(p?.id), p]));
      rawLogs.forEach((log, idx) => {
        const taskId = toStringId(log?.taskId ?? log?.task_id ?? log?.tache_id);
        const dateVal = pickDate(log?.date ?? log?.date_key ?? log?.log_date ?? log?.day ?? "");
        const linkedTask = taskById.get(taskId) || null;
        const legacyProjectId = toStringId(log?.projectId ?? log?.project_id ?? log?.chantier_id ?? linkedTask?.projectId);
        const linkedProject = projectById.get(legacyProjectId) || null;
        mapped.push(mapTimeLogRow({
          id: toStringId(log?.id) || `legacy_${rowIdx}_${taskId}_${dateVal}_${idx}`,
          task_id: taskId,
          project_id: legacyProjectId,
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
          legacy_task_signature: linkedTask ? buildTaskSignature(linkedTask) : "",
          legacy_task_signature_loose: linkedTask ? buildTaskSignatureLoose(linkedTask) : "",
          legacy_project_key: linkedProject ? buildProjectNaturalKey(linkedProject) : "",
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
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new Error("La saisie des heures est interdite le samedi et le dimanche.");
  }

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
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error("La saisie doit etre superieure ou egale a 0 minute.");
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

function normalizeCsvNames(value = "") {
  return String(value || "")
    .split(",")
    .map((item) => normalizeTechKey(item))
    .filter(Boolean);
}

function validateTimeLogAgainstTask(normalized = {}, task = null) {
  if (!task) throw new Error("Tache introuvable pour la saisie d'heures.");
  const taskProjectId = toStringId(task.project_id ?? task.projectId ?? task.chantier_id);
  if (taskProjectId && normalized.project_id && taskProjectId !== normalized.project_id) {
    throw new Error("Incoherence projet/tache: saisie refusee.");
  }
  const d = pickDate(normalized.date);
  const start = pickDate(task.start_date ?? task.start ?? "");
  const end = pickDate(task.end_date ?? task.end ?? "");
  if (start && d < start) throw new Error("Date hors periode de la tache.");
  if (end && d > end) throw new Error("Date hors periode de la tache.");

  const expectedOwner = normalizeMobileOwnerType(task.owner_type ?? task.owner ?? "");
  const actualOwner = normalizeMobileOwnerType(normalized.role ?? normalized.owner_type ?? normalized.owner ?? "");
  if (expectedOwner && actualOwner && expectedOwner !== actualOwner) {
    throw new Error("Intervenant incoherent avec la tache: saisie refusee.");
  }

  if (expectedOwner === "INTERNE") {
    const tech = normalizeTechKey(normalized.technician || "");
    if (!tech) throw new Error("Nom technicien interne obligatoire.");
    const allowed = new Set(normalizeCsvNames(task.internal_tech ?? task.internalTech ?? ""));
    if (allowed.size && !allowed.has(tech)) {
      throw new Error("Technicien non autorise pour cette tache.");
    }
  }
  if (expectedOwner === "Prestataire externe") {
    const vendor = normalizeTechKey(normalized.vendor || "");
    if (!vendor) throw new Error("Nom prestataire externe obligatoire.");
    const expectedVendor = normalizeTechKey(task.vendor || "");
    if (expectedVendor && vendor !== expectedVendor) {
      throw new Error("Prestataire incoherent avec la tache.");
    }
  }
  if (expectedOwner === "RSG" || expectedOwner === "RI") {
    if (normalizeTechKey(normalized.technician || "") || normalizeTechKey(normalized.vendor || "")) {
      throw new Error("Pas de nom technicien/prestataire attendu pour RI/RSG.");
    }
  }
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

function buildStateJsonTimeLogIdentityKey(input = {}) {
  return [
    toStringId(input.taskId ?? input.task_id),
    pickDate(input.date || input.date_key || ""),
    normalizeTechKey(input.role_key || input.role || input.owner_type || ""),
    normalizeTechKey(input.internal_tech || input.technician || ""),
    normalizeTechKey(input.vendor || ""),
  ].join("|");
}

function buildStateJsonTimeLogRow({
  stateTaskId = "",
  stateProjectId = "",
  persisted = {},
  normalized = {},
} = {}) {
  const nowIso = new Date().toISOString();
  const minutes = Number.isFinite(Number(persisted?.minutes))
    ? Math.max(0, Math.round(Number(persisted.minutes)))
    : toLogMinutes(normalized?.minutes);
  const hours = Math.round((minutes / 60) * 100) / 100;
  const roleKey = String(
    normalized?.role_key ||
    persisted?.role_key ||
    roleKeyFromOwnerType(normalized?.role || persisted?.role || persisted?.owner_type || "", {
      technician: normalized?.technician || persisted?.technician || persisted?.internal_tech || "",
      vendor: normalized?.vendor || persisted?.vendor || "",
    })
  ).trim().toLowerCase();
  const role = normalizeMobileOwnerType(normalized?.role || persisted?.role || persisted?.owner_type || "");
  const technician = String(normalized?.technician || persisted?.technician || persisted?.internal_tech || "").trim();
  const vendor = String(normalized?.vendor || persisted?.vendor || "").trim();
  const dateKey = pickDate(normalized?.date || persisted?.date || persisted?.date_key || "");
  return {
    id: toStringId(persisted?.id) || `log_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    taskId: toStringId(stateTaskId),
    task_id: toStringId(stateTaskId),
    projectId: toStringId(stateProjectId),
    project_id: toStringId(stateProjectId),
    date: dateKey,
    date_key: dateKey,
    role: role || "",
    role_key: roleKey || "",
    owner_type: role || "",
    technician: technician || "",
    internal_tech: technician || "",
    vendor: vendor || "",
    intervenant_label: technician || vendor || role || "",
    minutes,
    hours,
    note: String(normalized?.note || persisted?.note || "").trim(),
    comment: String(normalized?.note || persisted?.note || "").trim(),
    createdAt: String(persisted?.created_date || persisted?.createdAt || nowIso),
    updatedAt: nowIso,
  };
}

async function syncStateJsonTimeLogForCurrentUser({
  requestedTaskId = "",
  normalized = {},
  taskRef = null,
  persisted = null,
} = {}) {
  if (!appStatesTable) return false;
  let session = null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return false;
    session = data?.session || null;
  } catch {
    return false;
  }
  const userId = toStringId(session?.user?.id);
  if (!userId) return false;

  const { data, error } = await supabase
    .from(appStatesTable)
    .select("state_json, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw buildError("Sync state_json timeLogs impossible", error);

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return false;
  const stateJson = row?.state_json && typeof row.state_json === "object" ? row.state_json : {};
  const tasks = Array.isArray(stateJson.tasks) ? stateJson.tasks : [];
  const logs = Array.isArray(stateJson.timeLogs) ? stateJson.timeLogs : [];

  let stateTaskId = "";
  const requested = toStringId(requestedTaskId);
  if (requested && !isUuidLike(requested)) stateTaskId = requested;

  const stateTaskByRequested = tasks.find((t) => toStringId(t?.id) === requested);
  if (!stateTaskId && stateTaskByRequested) stateTaskId = toStringId(stateTaskByRequested?.id);

  if (!stateTaskId && taskRef) {
    const strictSig = buildTaskSignature(taskRef);
    const looseSig = buildTaskSignatureLoose(taskRef);
    const match =
      tasks.find((t) => buildTaskSignature(t) === strictSig) ||
      tasks.find((t) => buildTaskSignatureLoose(t) === looseSig) ||
      null;
    stateTaskId = toStringId(match?.id);
  }
  if (!stateTaskId) return false;

  const stateTask = tasks.find((t) => toStringId(t?.id) === stateTaskId) || null;
  const stateProjectId = toStringId(
    stateTask?.projectId ??
    stateTask?.project_id ??
    normalized?.project_id ??
    taskRef?.project_id ??
    ""
  );

  const nextLog = buildStateJsonTimeLogRow({
    stateTaskId,
    stateProjectId,
    persisted: persisted || {},
    normalized,
  });
  const nextKey = buildStateJsonTimeLogIdentityKey(nextLog);

  let replaced = false;
  const nextLogs = logs.map((item) => {
    const sameIdentity = buildStateJsonTimeLogIdentityKey(item) === nextKey;
    if (!sameIdentity) return item;
    replaced = true;
    return { ...item, ...nextLog };
  });
  if (!replaced) nextLogs.push(nextLog);

  const nextState = { ...stateJson, timeLogs: nextLogs };
  const updatePayload = {
    state_json: nextState,
    updated_at: new Date().toISOString(),
  };
  const { error: updateError } = await supabase
    .from(appStatesTable)
    .update(updatePayload)
    .eq("user_id", userId);
  if (updateError) throw buildError("Ecriture state_json timeLogs impossible", updateError);
  return true;
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

function toLogMinutes(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
}

function buildAccumulatedUpdatePayload(basePayload = {}, existingMinutes = 0, addedMinutes = 0) {
  const nextMinutes = toLogMinutes(existingMinutes) + toLogMinutes(addedMinutes);
  return {
    ...basePayload,
    minutes: nextMinutes,
    hours: Math.round((nextMinutes / 60) * 100) / 100,
  };
}

async function fetchTimeLogById(id = "") {
  const targetId = toStringId(id);
  if (!targetId) return null;
  try {
    const { data, error } = await supabase
      .from(timeLogsTable)
      .select("*")
      .eq("id", targetId)
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
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
        const [projects, legacyProjects, tasks, legacyTasks] = await Promise.all([
          fetchProjects(),
          fetchLegacyStateProjects(),
          fetchTasks(),
          fetchLegacyStateTasks(),
        ]);
        const primaryProjects = strictStateJsonRead
          ? legacyProjects
          : (legacyProjects.length ? legacyProjects : mergeProjectSources(projects, legacyProjects));
        const primaryTasks = strictStateJsonRead
          ? legacyTasks
          : (legacyTasks.length ? legacyTasks : mergeTaskSources(tasks, legacyTasks));
        const tasksByProject = new Map();
        for (const task of primaryTasks) {
          const arr = tasksByProject.get(task.project_id) || [];
          arr.push(task);
          tasksByProject.set(task.project_id, arr);
        }

        const enriched = primaryProjects.map((project) => ({
          ...project,
          progress: computeProjectProgress(project, tasksByProject.get(project.id) || []),
        }));

        return applySort(enriched, sort).slice(0, limit);
      },

      filter: async (filters = {}, sort = "-updated_date", limit = 200) => {
        const [projects, legacyProjects, tasks, legacyTasks] = await Promise.all([
          fetchProjects(),
          fetchLegacyStateProjects(),
          fetchTasks(),
          fetchLegacyStateTasks(),
        ]);
        const primaryProjects = strictStateJsonRead
          ? legacyProjects
          : (legacyProjects.length ? legacyProjects : mergeProjectSources(projects, legacyProjects));
        const primaryTasks = strictStateJsonRead
          ? legacyTasks
          : (legacyTasks.length ? legacyTasks : mergeTaskSources(tasks, legacyTasks));
        const tasksByProject = new Map();

        for (const task of primaryTasks) {
          const arr = tasksByProject.get(task.project_id) || [];
          arr.push(task);
          tasksByProject.set(task.project_id, arr);
        }

        let enriched = primaryProjects.map((project) => ({
          ...project,
          progress: computeProjectProgress(project, tasksByProject.get(project.id) || []),
        }));
        enriched = enriched.filter((project) => matchesFiltersInMemory(project, filters));

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
        const [tasks, legacyTasks, projects, legacyProjects, internalTechRows] = await Promise.all([
          fetchTasks(),
          fetchLegacyStateTasks(),
          fetchProjects(),
          fetchLegacyStateProjects(),
          fetchReferential(internalTechsTable, "internal_tech"),
        ]);
        const primaryProjects = strictStateJsonRead
          ? legacyProjects
          : (legacyProjects.length ? legacyProjects : mergeProjectSources(projects, legacyProjects));
        const primaryTasks = strictStateJsonRead
          ? legacyTasks
          : (legacyTasks.length ? legacyTasks : mergeTaskSources(tasks, legacyTasks));
        const projectMap = new Map(primaryProjects.map((p) => [p.id, p]));
        const internalTechAllowBySite = buildInternalTechAllowBySite(internalTechRows);
        const enriched = enrichTasks(primaryTasks, projectMap, internalTechAllowBySite);

        return applySort(enriched, sort).slice(0, limit);
      },

      filter: async (filters = {}, sort = "-updated_date", limit = 500) => {
        const [tasks, legacyTasks, projects, legacyProjects, internalTechRows] = await Promise.all([
          fetchTasks(),
          fetchLegacyStateTasks(),
          fetchProjects(),
          fetchLegacyStateProjects(),
          fetchReferential(internalTechsTable, "internal_tech"),
        ]);
        const primaryProjects = strictStateJsonRead
          ? legacyProjects
          : (legacyProjects.length ? legacyProjects : mergeProjectSources(projects, legacyProjects));
        const primaryTasks = strictStateJsonRead
          ? legacyTasks
          : (legacyTasks.length ? legacyTasks : mergeTaskSources(tasks, legacyTasks));
        const projectMap = new Map(primaryProjects.map((p) => [p.id, p]));
        const internalTechAllowBySite = buildInternalTechAllowBySite(internalTechRows);
        let enriched = enrichTasks(primaryTasks, projectMap, internalTechAllowBySite);
        const requestedProjectId = toStringId(filters?.project_id ?? filters?.[taskProjectIdColumn] ?? "");
        if (requestedProjectId) {
          enriched = enriched.filter((task) => toStringId(task?.project_id) === requestedProjectId);
        }
        enriched = enriched.filter((task) => {
          const local = { ...task, [taskProjectIdColumn]: task?.project_id };
          return matchesFiltersInMemory(local, filters);
        });

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
        const sourceLogs = strictStateJsonRead ? legacyLogs : mergeTimeLogSources(logs, legacyLogs);
        return applyLimit(applySort(sourceLogs, sort), limit);
      },
      filter: async (filters = {}, sort = "-date", limit = 1000) => {
        const [logs, legacyLogs] = await Promise.all([
          fetchTimeLogs(filters),
          fetchLegacyStateTimeLogs(filters),
        ]);
        const sourceLogs = strictStateJsonRead ? legacyLogs : mergeTimeLogSources(logs, legacyLogs);
        return applyLimit(applySort(sourceLogs, sort), limit);
      },
      listForTask: async (taskRef = {}, sort = "-date", limit = 1000) => {
        const [logs, legacyLogs] = await Promise.all([
          fetchTimeLogs(),
          fetchLegacyStateTimeLogs(),
        ]);
        const merged = strictStateJsonRead ? legacyLogs : mergeTimeLogSources(logs, legacyLogs);
        const taskId = toStringId(taskRef?.id ?? taskRef?.task_id ?? taskRef?.taskId);
        const exact = merged.filter((log) => toStringId(log?.task_id) === taskId);

        const signature = buildTaskSignature(taskRef);
        const bySignature = merged.filter((log) => String(log?.legacy_task_signature || "") === signature);
        const signatureLoose = buildTaskSignatureLoose(taskRef);
        const bySignatureLoose = merged.filter((log) => String(log?.legacy_task_signature_loose || "") === signatureLoose);

        const directMatches = dedupeTimeLogs([...exact, ...bySignature, ...bySignatureLoose]);

        const projectId = toStringId(taskRef?.project_id ?? taskRef?.projectId ?? taskRef?.chantier_id);
        const startDate = pickDate(taskRef?.start_date ?? taskRef?.start ?? "");
        const endDate = pickDate(taskRef?.end_date ?? taskRef?.end ?? "");
        const ownerType = normalizeMobileOwnerType(taskRef?.owner_type ?? taskRef?.owner ?? "");
        const expectedIntervenant = normalizeSigText(
          taskRef?.internal_tech ??
          taskRef?.internalTech ??
          taskRef?.vendor ??
          ""
        );
        const byProjectHeuristic = merged.filter((log) => {
          const logProjectId = toStringId(log?.project_id);
          if (projectId && logProjectId && logProjectId !== projectId) return false;
          const d = pickDate(log?.date ?? "");
          if (startDate && d && d < startDate) return false;
          if (endDate && d && d > endDate) return false;
          if (ownerType) {
            const logOwner = normalizeMobileOwnerType(log?.role ?? "");
            if (logOwner && logOwner !== ownerType) return false;
          }
          if (expectedIntervenant) {
            const logInterv = normalizeSigText(log?.intervenant_label || log?.technician || log?.vendor || "");
            if (logInterv && logInterv !== expectedIntervenant) return false;
          }
          return true;
        });
        const mergedMatches = dedupeTimeLogs([...directMatches, ...byProjectHeuristic]);
        return applyLimit(applySort(mergedMatches, sort), limit);
      },
      saveForTask: async (input) => {
        assertTimeLogWriteAllowed();
        const normalized = normalizeTimeLogInput(input);
        const requestedTaskId = toStringId(normalized.task_id);
        if (!isUuidLike(requestedTaskId)) {
          const fallbackNowIso = new Date().toISOString();
          const fallbackPersisted = {
            id: `legacy_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
            task_id: requestedTaskId,
            project_id: normalized.project_id || null,
            date_key: normalized.date,
            date: normalized.date,
            role_key: normalized.role_key || "",
            role: normalized.role || "",
            owner_type: normalized.role || "",
            technician: normalized.technician || "",
            internal_tech: normalized.technician || "",
            vendor: normalized.vendor || "",
            intervenant_label: normalized.technician || normalized.vendor || normalized.role || "",
            minutes: normalized.minutes,
            hours: normalized.hours,
            note: normalized.note || "",
            comment: normalized.note || "",
            created_date: fallbackNowIso,
            updated_date: fallbackNowIso,
          };
          try {
            await syncStateJsonTimeLogForCurrentUser({
              requestedTaskId,
              normalized,
              taskRef: null,
              persisted: fallbackPersisted,
            });
          } catch (_) {
            // Fallback legacy non bloquant: on renvoie la ligne normalisée même si la sync distante échoue.
          }
          return mapTimeLogRow(fallbackPersisted);
        }
        const taskRows = await fetchTasks({ id: requestedTaskId });
        const taskRef = Array.isArray(taskRows) ? taskRows[0] : null;
        if (!taskRef?.id || !isUuidLike(taskRef.id)) {
          throw new Error(`Ecriture heures refusee: tache UUID introuvable (${requestedTaskId}).`);
        }

        normalized.task_id = toStringId(taskRef.id);
        normalized.project_id = toStringId(taskRef?.project_id || normalized.project_id);
        validateTimeLogAgainstTask(normalized, taskRef);
        normalized.role = normalizeMobileOwnerType(taskRef?.owner_type ?? normalized.role);
        normalized.role_key = roleKeyFromOwnerType(normalized.role, {
          technician: normalized.technician,
          vendor: normalized.vendor,
        });
        const identity = buildTimeLogIdentityKey(normalized);
        const baseUpdatePayload = timeLogPayloadForWrite(normalized, { includeCreatedDate: false });
        const addedMinutes = toLogMinutes(normalized.minutes);
        const finalizeSavedLog = async (rowLike, fallback = {}) => {
          const mapped = mapTimeLogRow(rowLike || fallback || {});
          await syncStateJsonTimeLogForCurrentUser({
            requestedTaskId,
            normalized,
            taskRef,
            persisted: mapped,
          });
          return mapped;
        };

        const naturalExistingId = await findExistingTimeLogIdByNaturalKey(baseUpdatePayload);
        if (naturalExistingId) {
          const existingRow = await fetchTimeLogById(naturalExistingId);
          const existingMapped = existingRow ? mapTimeLogRow(existingRow) : null;
          const updatePayload = buildAccumulatedUpdatePayload(baseUpdatePayload, existingMapped?.minutes, addedMinutes);
          const updated = await writeTimeLogWithColumnPruning({
            mode: "update",
            payload: updatePayload,
            id: naturalExistingId,
          });
          return finalizeSavedLog(updated, { ...updatePayload, id: naturalExistingId });
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
          const updatePayload = buildAccumulatedUpdatePayload(baseUpdatePayload, existing?.minutes, addedMinutes);
          const written = await writeTimeLogWithColumnPruning({
            mode: "update",
            payload: updatePayload,
            id: existing.id,
          });
          return finalizeSavedLog(written, { ...updatePayload, id: existing.id });
        }

        const payload = timeLogPayloadForWrite(normalized, { includeCreatedDate: true });
        try {
          const written = await writeTimeLogWithColumnPruning({
            mode: "insert",
            payload,
          });
          return finalizeSavedLog(written, payload);
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error;
          const duplicateId = await findExistingTimeLogIdByDuplicateError(error, payload);
          if (duplicateId) {
            const existingRow = await fetchTimeLogById(duplicateId);
            const existingMapped = existingRow ? mapTimeLogRow(existingRow) : null;
            const updatePayload = buildAccumulatedUpdatePayload(baseUpdatePayload, existingMapped?.minutes, addedMinutes);
            const updated = await writeTimeLogWithColumnPruning({
              mode: "update",
              payload: updatePayload,
              id: duplicateId,
            });
            return finalizeSavedLog(updated, { ...updatePayload, id: duplicateId });
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
          const updatePayload = buildAccumulatedUpdatePayload(baseUpdatePayload, fallbackExisting?.minutes, addedMinutes);
          const updated = await writeTimeLogWithColumnPruning({
            mode: "update",
            payload: updatePayload,
            id: fallbackExisting.id,
          });
          return finalizeSavedLog(updated, { ...updatePayload, id: fallbackExisting.id });
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

