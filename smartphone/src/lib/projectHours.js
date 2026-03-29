function toStringId(value) {
  return value === undefined || value === null ? "" : String(value);
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

function pickDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function normalizeRole(value) {
  const raw = String(value || "").trim();
  const up = raw.toUpperCase();
  if (!up) return "interne";
  if (up === "RSG") return "rsg";
  if (up === "RI") return "ri";
  if (up === "EXTERNE" || up === "PRESTATAIRE EXTERNE" || up === "PRESTATAIRE") return "externe";
  return "interne";
}

function isExternalTask(task = {}) {
  const role = normalizeRole(task.owner_type ?? task.owner);
  const hasVendor = String(task.vendor || "").trim().length > 0;
  return role === "externe" || hasVendor;
}

function parseMinutes(log = {}) {
  const direct = Number(log?.minutes);
  if (Number.isFinite(direct)) {
    // Some legacy/mobile rows stored decimal hours in `minutes` (e.g. 0.5, 0.75).
    // Heuristic: non-integer small values are interpreted as hours.
    if (!Number.isInteger(direct) && direct > 0 && direct <= 24) {
      return Math.max(0, Math.round(direct * 60));
    }
    return Math.max(0, Math.round(direct));
  }

  const minutesStr = String(log?.minutes ?? "").trim().replace(",", ".");
  const minutesFromString = Number(minutesStr);
  if (Number.isFinite(minutesFromString)) {
    if (!Number.isInteger(minutesFromString) && minutesFromString > 0 && minutesFromString <= 24) {
      return Math.max(0, Math.round(minutesFromString * 60));
    }
    return Math.max(0, Math.round(minutesFromString));
  }

  const hoursRaw = Number(log?.hours);
  if (Number.isFinite(hoursRaw)) return Math.max(0, Math.round(hoursRaw * 60));

  const hoursStr = String(log?.hours ?? "").trim().replace(",", ".");
  const hoursFromString = Number(hoursStr);
  if (Number.isFinite(hoursFromString)) return Math.max(0, Math.round(hoursFromString * 60));

  return 0;
}

export function computeProjectHoursById(projects = [], tasks = [], timeLogs = []) {
  const knownProjectIds = new Set((projects || []).map((p) => toStringId(p?.id)).filter(Boolean));
  const projectIdByKey = new Map();
  const tasksById = new Map();
  const tasksByProject = new Map();

  (projects || []).forEach((project) => {
    const projectId = toStringId(project?.id);
    if (!projectId) return;
    const key = buildProjectNaturalKey(project);
    if (key) projectIdByKey.set(key, projectId);
  });

  (tasks || []).forEach((task) => {
    const taskId = toStringId(task?.id);
    const projectId = toStringId(task?.project_id);
    if (!taskId || !projectId || !knownProjectIds.has(projectId)) return;
    tasksById.set(taskId, {
      projectId,
      startDate: pickDate(task?.start_date ?? task?.start ?? ""),
      endDate: pickDate(task?.end_date ?? task?.end ?? ""),
      isExternalTask: isExternalTask(task),
    });
    const arr = tasksByProject.get(projectId) || [];
    arr.push({
      startDate: pickDate(task?.start_date ?? task?.start ?? ""),
      endDate: pickDate(task?.end_date ?? task?.end ?? ""),
      isExternalTask: isExternalTask(task),
    });
    tasksByProject.set(projectId, arr);
  });

  const out = {};
  (timeLogs || []).forEach((log) => {
    const logRole = normalizeRole(log?.role ?? log?.owner_type ?? log?.owner);
    const mins = parseMinutes(log);
    if (!mins) return;

    const taskId = toStringId(log?.task_id);
    const taskMeta = tasksById.get(taskId);
    const logDate = pickDate(log?.date);

    if (taskMeta) {
      if (logDate) {
        if (taskMeta.startDate && logDate < taskMeta.startDate) return;
        if (taskMeta.endDate && logDate > taskMeta.endDate) return;
      }
      if (taskMeta.isExternalTask && logRole !== "externe") return;
      if (!taskMeta.isExternalTask && logRole === "externe") return;
      out[taskMeta.projectId] = (out[taskMeta.projectId] || 0) + mins;
      return;
    }

    let projectId = toStringId(log?.project_id);
    if (!projectId || !knownProjectIds.has(projectId)) {
      const byKey = toStringId(projectIdByKey.get(String(log?.legacy_project_key || "").trim()));
      projectId = byKey;
    }
    if (!projectId || !knownProjectIds.has(projectId)) return;

    const projectTasks = tasksByProject.get(projectId) || [];
    if (!projectTasks.length) return;

    const isExternalLog = logRole === "externe";
    const hasEligibleTask = projectTasks.some((t) => {
      if (t.isExternalTask !== isExternalLog) return false;
      if (!logDate) return true;
      if (t.startDate && logDate < t.startDate) return false;
      if (t.endDate && logDate > t.endDate) return false;
      return true;
    });
    if (!hasEligibleTask) return;

    out[projectId] = (out[projectId] || 0) + mins;
  });

  return out;
}
