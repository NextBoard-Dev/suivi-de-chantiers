import { computeTaskProgressAuto } from "@/lib/businessRules";

function toIsoDateKey(value) {
  return String(value || "").slice(0, 10);
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
  if (!raw) return "interne";
  if (raw.includes("RSG/RI")) return "rsg";
  if (raw.includes("RSG")) return "rsg";
  if (raw.includes("RI")) return "ri";
  if (raw.includes("EXTERNE") || raw.includes("PRESTATAIRE")) return "externe";
  if (raw.includes("INTERNE")) return "interne";
  return "interne";
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

function expectedSpecsForTask(task) {
  const roleKey = normalizeRoleKey(task?.owner_type || task?.owner || "");
  if (roleKey !== "interne") {
    return [{ roleKey, internalTech: "" }];
  }
  const techs = splitInternalTechList(task?.internal_tech || task?.internalTech || "");
  if (!techs.length) return [];
  return techs.map((internalTech) => ({ roleKey: "interne", internalTech }));
}

function buildLogPresenceSetForDate(timeLogs = [], dateKey = "") {
  const set = new Set();
  (timeLogs || []).forEach((log) => {
    const taskId = String(log?.task_id || log?.taskId || "").trim();
    const logDateKey = toIsoDateKey(log?.date);
    if (!taskId || logDateKey !== dateKey) return;
    const roleKey = normalizeRoleKey(log?.role_key || log?.role || log?.owner_type || "");
    const internalTech = roleKey === "interne"
      ? normalizeInternalTech(log?.technician || log?.internal_tech || log?.intervenant_label || "")
      : "";
    set.add(`${taskId}|${roleKey}|${internalTech}`);
  });
  return set;
}

function computeMissingEntryCountsToday(tasks = [], timeLogs = [], now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  if (day === 0 || day === 6) return {};
  const todayKey = today.toISOString().slice(0, 10);

  const logPresence = buildLogPresenceSetForDate(timeLogs, todayKey);
  const out = {};

  (tasks || []).forEach((task) => {
    const taskId = String(task?.id || "").trim();
    if (!taskId) return;

    const startKey = toIsoDateKey(task?.start_date);
    const endKey = toIsoDateKey(task?.end_date);
    if (!startKey || !endKey) return;
    if (todayKey < startKey || todayKey > endKey) return;
    const progressAuto = computeTaskProgressAuto(task?.start_date || "", task?.end_date || "", today);
    if (progressAuto >= 100) return;

    const specs = expectedSpecsForTask(task);
    if (!specs.length) {
      out[taskId] = 0;
      return;
    }
    let missing = 0;
    specs.forEach((spec) => {
      const key = `${taskId}|${spec.roleKey}|${spec.internalTech || ""}`;
      if (!logPresence.has(key)) missing += 1;
    });
    out[taskId] = missing;
  });

  return out;
}

export function computeMissingEntriesByProject(tasks = [], timeLogs = [], now = new Date()) {
  const missingByTask = computeMissingEntryCountsToday(tasks, timeLogs, now);
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
  return computeMissingEntryCountsToday(tasks, timeLogs, now);
}
