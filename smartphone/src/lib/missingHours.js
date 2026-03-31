import { computeTaskProgressAuto } from "@/lib/businessRules";

function toIsoDateKey(value) {
  return String(value || "").slice(0, 10);
}

function computeMissingTaskIdsToday(tasks = [], timeLogs = [], now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  if (day === 0 || day === 6) return new Set();
  const todayKey = today.toISOString().slice(0, 10);

  const logsTodayByTask = new Set();
  (timeLogs || []).forEach((log) => {
    const taskId = String(log?.task_id || log?.taskId || "").trim();
    const dateKey = toIsoDateKey(log?.date);
    const minutes = Number.isFinite(Number(log?.minutes)) ? Number(log.minutes) : 0;
    if (!taskId || dateKey !== todayKey || minutes <= 0) return;
    logsTodayByTask.add(taskId);
  });

  const missingTaskIds = new Set();
  (tasks || []).forEach((task) => {
    const taskId = String(task?.id || "").trim();
    if (!taskId) return;

    const progressAuto = computeTaskProgressAuto(task?.start_date || "", task?.end_date || "", today);
    if (progressAuto >= 100) return;

    const startKey = toIsoDateKey(task?.start_date);
    const endKey = toIsoDateKey(task?.end_date);
    if (!startKey || !endKey) return;
    if (todayKey < startKey || todayKey > endKey) return;

    if (!logsTodayByTask.has(taskId)) missingTaskIds.add(taskId);
  });

  return missingTaskIds;
}

export function computeMissingEntriesByProject(tasks = [], timeLogs = [], now = new Date()) {
  const missingTaskIds = computeMissingTaskIdsToday(tasks, timeLogs, now);
  const out = {};
  (tasks || []).forEach((task) => {
    const taskId = String(task?.id || "").trim();
    const projectId = String(task?.project_id || "").trim();
    if (!taskId || !projectId) return;
    if (!missingTaskIds.has(taskId)) return;
    out[projectId] = (out[projectId] || 0) + 1;
  });
  return out;
}

export function computeMissingEntriesByTask(tasks = [], timeLogs = [], now = new Date()) {
  const missingTaskIds = computeMissingTaskIdsToday(tasks, timeLogs, now);
  const out = {};
  (tasks || []).forEach((task) => {
    const taskId = String(task?.id || "").trim();
    if (!taskId) return;
    out[taskId] = missingTaskIds.has(taskId) ? 1 : 0;
  });
  return out;
}
