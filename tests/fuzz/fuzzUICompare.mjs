export function computeProjectTotalsFromTaskMap(tasks = [], missingByTask = {}) {
  const out = {};
  for (const task of tasks || []) {
    const projectId = String(task?.project_id || task?.projectId || "").trim();
    const taskId = String(task?.id || task?.task_id || "").trim();
    if (!projectId || !taskId) continue;
    const value = Number(missingByTask[taskId] ?? 0);
    out[projectId] = (out[projectId] || 0) + value;
  }
  return out;
}

export function simulateTaskCardProps(tasks = [], missingByTask = {}) {
  return (tasks || []).map((task) => {
    const key = String(task?.id || task?.task_id || "");
    return {
      taskId: key,
      injected: Number(missingByTask[key] ?? 0),
      expected: Number(missingByTask[key] ?? 0),
    };
  });
}

export function simulateProjectCardProps(projects = [], projectMissingMap = {}) {
  return (projects || []).map((project) => {
    const key = String(project?.id || "");
    return {
      projectId: key,
      injected: Number(projectMissingMap[key] ?? 0),
      expected: Number(projectMissingMap[key] ?? 0),
    };
  });
}

export function compareUIInjection({ tasks = [], projects = [], missingByTask = {} }) {
  const projectMissingMap = computeProjectTotalsFromTaskMap(tasks, missingByTask);
  const taskProps = simulateTaskCardProps(tasks, missingByTask);
  const projectProps = simulateProjectCardProps(projects, projectMissingMap);
  const taskMismatches = taskProps.filter((x) => x.injected !== x.expected);
  const projectMismatches = projectProps.filter((x) => x.injected !== x.expected);
  return {
    taskMismatches,
    projectMismatches,
    projectMissingMap,
  };
}

