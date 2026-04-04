function toIsoDateKey(value) {
  return String(value || "").slice(0, 10);
}

function toLocalDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeRoleKey(value) {
  const raw = normalizeText(value);
  if (!raw) return "inconnu";
  if (raw.includes("RSG/RI")) return "rsg";
  if (raw.includes("RSG")) return "rsg";
  if (raw.includes("RI")) return "ri";
  if (raw.includes("EXTERNE") || raw.includes("PRESTATAIRE")) return "externe";
  if (raw.includes("INTERNE")) return "interne";
  return "inconnu";
}

function normalizeInternalTech(value) {
  return normalizeText(value);
}

function splitInternalTechList(value) {
  return String(value || "")
    .split(",")
    .map((name) => normalizeInternalTech(name))
    .filter(Boolean);
}

function dedupTechs(values = []) {
  const seen = new Set();
  const out = [];
  (values || []).forEach((value) => {
    const norm = normalizeInternalTech(value);
    if (!norm) return;
    const key = norm.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(norm);
  });
  return out;
}

function getTaskRoleKey(task) {
  return normalizeRoleKey(task?.owner_type || task?.owner || "");
}

function getInternalTechsForTask(task, timeLogs = []) {
  if (getTaskRoleKey(task) !== "interne") return [];
  const selected = dedupTechs([
    ...splitInternalTechList(task?.internal_tech || ""),
    ...splitInternalTechList(task?.internalTech || ""),
  ]);
  if (selected.length) return selected;

  const taskId = String(task?.id || "").trim();
  if (!taskId) return [];
  const fromLogs = dedupTechs(
    (timeLogs || [])
      .filter((log) => String(log?.task_id || log?.taskId || "").trim() === taskId)
      .filter((log) => normalizeRoleKey(log?.role_key || log?.role || log?.owner_type || "") === "interne")
      .map((log) => log?.technician || log?.internal_tech || log?.intervenant_label || "")
  );
  return fromLogs;
}

function expectedSpecsForTask(task, timeLogs = []) {
  const roleKey = getTaskRoleKey(task);
  if (roleKey === "inconnu") return [];
  if (roleKey !== "interne") {
    return [{ roleKey, internalTech: "" }];
  }
  const techs = getInternalTechsForTask(task, timeLogs);
  if (!techs.length) return [];
  return techs.map((internalTech) => ({ roleKey: "interne", internalTech }));
}

function buildLogPresenceByDate(timeLogs = []) {
  const byDate = new Map();
  (timeLogs || []).forEach((log) => {
    const taskId = String(log?.task_id || log?.taskId || "").trim();
    const logDateKey = toIsoDateKey(log?.date || log?.date_key || log?.log_date || log?.day || "");
    if (!taskId || !logDateKey) return;
    const roleKey = normalizeRoleKey(log?.role_key || log?.role || log?.owner_type || "");
    const internalTech = roleKey === "interne"
      ? normalizeInternalTech(log?.technician || log?.internal_tech || log?.intervenant_label || "")
      : "";
    const key = `${taskId}|${roleKey}|${internalTech}`;
    if (!byDate.has(logDateKey)) byDate.set(logDateKey, new Set());
    byDate.get(logDateKey).add(key);
  });
  return byDate;
}

function buildLogRowsByDate(timeLogs = []) {
  const byDate = new Map();
  (timeLogs || []).forEach((log) => {
    const taskId = String(log?.task_id || log?.taskId || "").trim();
    const logDateKey = toIsoDateKey(log?.date || log?.date_key || log?.log_date || log?.day || "");
    if (!taskId || !logDateKey) return;
    const roleKey = normalizeRoleKey(log?.role_key || log?.role || log?.owner_type || "");
    const internalTech = roleKey === "interne"
      ? normalizeInternalTech(log?.technician || log?.internal_tech || log?.intervenant_label || "")
      : "";
    const key = `${taskId}|${roleKey}|${internalTech}`;
    if (!byDate.has(logDateKey)) byDate.set(logDateKey, new Map());
    const byKey = byDate.get(logDateKey);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(log);
  });
  return byDate;
}

function isMissingHoursValue(value) {
  return value === null || value === undefined || value === "";
}

function hasRealHoursFilled(log) {
  if (!log) return false;
  return !(isMissingHoursValue(log?.minutes) && isMissingHoursValue(log?.hours));
}

function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function computeMissingEntryCountsAligned(tasks = [], timeLogs = [], now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayKey = toLocalDateKey(today);
  const out = {};
  if (!isWeekday(today)) {
    (tasks || []).forEach((t) => {
      const id = String(t?.id || "").trim();
      if (id) out[id] = 0;
    });
    return out;
  }
  const logPresenceByDate = buildLogPresenceByDate(timeLogs);

  (tasks || []).forEach((task) => {
    const taskId = String(task?.id || "").trim();
    if (!taskId) return;

    const startDate = new Date(`${toIsoDateKey(task?.start_date)}T00:00:00`);
    const endDate = new Date(`${toIsoDateKey(task?.end_date)}T00:00:00`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return;
    if (today < startDate || today > endDate) {
      out[taskId] = 0;
      return;
    }

    const specs = expectedSpecsForTask(task, timeLogs);
    if (!specs.length) {
      out[taskId] = 0;
      return;
    }
    const dayPresence = logPresenceByDate.get(todayKey) || new Set();
    const hasAll = specs.every((spec) => {
      const key = `${taskId}|${spec.roleKey}|${spec.internalTech || ""}`;
      return dayPresence.has(key);
    });
    out[taskId] = hasAll ? 0 : 1;
  });

  return out;
}

export function computeMissingEntriesByProject(tasks = [], timeLogs = [], now = new Date()) {
  const missingByTask = computeMissingEntryCountsAligned(tasks, timeLogs, now);
  const out = {};
  (tasks || []).forEach((task) => {
    const taskId = String(task?.id || "").trim();
    const projectId = String(task?.project_id || "").trim();
    if (!taskId || !projectId) return;
    const missing = Number(missingByTask[taskId] || 0);
    if (missing <= 0) return;
    out[projectId] = (out[projectId] || 0) + missing;
  });
  return out;
}

export function computeMissingEntriesByTask(tasks = [], timeLogs = [], now = new Date()) {
  return computeMissingEntryCountsAligned(tasks, timeLogs, now);
}

export function computeHoursToFillEntryCount(tasks = [], timeLogs = [], now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (!isWeekday(today)) return 0;
  const todayKey = toLocalDateKey(today);
  const logRowsByDate = buildLogRowsByDate(timeLogs);
  const byKey = logRowsByDate.get(todayKey) || new Map();

  let total = 0;
  (tasks || []).forEach((task) => {
    const taskId = String(task?.id || "").trim();
    if (!taskId) return;
    const startDate = new Date(`${toIsoDateKey(task?.start_date)}T00:00:00`);
    const endDate = new Date(`${toIsoDateKey(task?.end_date)}T00:00:00`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return;
    if (today < startDate || today > endDate) return;

    const specs = expectedSpecsForTask(task, timeLogs);
    if (!specs.length) return;
    specs.forEach((spec) => {
      const key = `${taskId}|${spec.roleKey}|${spec.internalTech || ""}`;
      const logs = byKey.get(key) || [];
      const hasFilled = logs.some((log) => hasRealHoursFilled(log));
      if (!hasFilled) total += 1;
    });
  });

  return total;
}
