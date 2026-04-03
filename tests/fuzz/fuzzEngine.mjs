import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { computeMissingEntriesByTask as computeMissingEntriesByTaskSmartphone } from "../../smartphone/src/lib/missingHours.js";
import { compareUIInjection, computeProjectTotalsFromTaskMap } from "./fuzzUICompare.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function findBalancedBlock(src, startIndex) {
  let depth = 0;
  let i = startIndex;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTemplate && ch === "'" && !inSingle) {
      inSingle = true;
      continue;
    } else if (inSingle && ch === "'") {
      inSingle = false;
      continue;
    }
    if (!inSingle && !inTemplate && ch === "\"" && !inDouble) {
      inDouble = true;
      continue;
    } else if (inDouble && ch === "\"") {
      inDouble = false;
      continue;
    }
    if (!inSingle && !inDouble && ch === "`" && !inTemplate) {
      inTemplate = true;
      continue;
    } else if (inTemplate && ch === "`") {
      inTemplate = false;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractFunction(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`Function not found: ${name}`);
  const openBrace = src.indexOf("{", start);
  const closeBrace = findBalancedBlock(src, openBrace);
  if (openBrace < 0 || closeBrace < 0) throw new Error(`Unbalanced function: ${name}`);
  return src.slice(start, closeBrace + 1);
}

let pcEngine = null;
function loadPcEngine() {
  if (pcEngine) return pcEngine;
  const appJs = fs.readFileSync(path.join(repoRoot, "app.js"), "utf8");
  const parts = [
    extractFunction(appJs, "isWeekday"),
    extractFunction(appJs, "normalizeTimeLogRole"),
    extractFunction(appJs, "normalizeTimeLogInternalTech"),
    extractFunction(appJs, "getTaskRoleKey"),
    extractFunction(appJs, "getInternalTechsForTaskHours"),
    extractFunction(appJs, "findTimeLogByRole"),
    extractFunction(appJs, "getExpectedLogSpecsForTask"),
    extractFunction(appJs, "hasAllExpectedLogsForTaskDate"),
    extractFunction(appJs, "getMissingDaysList"),
    extractFunction(appJs, "countMissingDaysForTask"),
    extractFunction(appJs, "buildMissingDaysMap"),
  ];

  const code = `
const window = globalThis;
const ownerType = (o="")=>{
  const k = String(o || "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toUpperCase()
    .trim();
  if(!k) return "inconnu";
  if(k === "RSG/RI" || k === "RSG RI") return "rsg";
  if(k === "RSG") return "rsg";
  if(k === "RI") return "ri";
  const hasInt = /\\bINTERNE\\b/.test(k);
  const hasExt = /\\bEXTERNE\\b/.test(k) || /\\bPRESTATAIRE\\b/.test(k);
  if(hasInt && !hasExt) return "interne";
  if(hasExt) return "externe";
  return "inconnu";
};
const normalizeInternalTech = (v="")=>
  String(v || "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/\\s+/g, " ")
    .trim()
    .toUpperCase();
const dedupInternalTechs = (arr=[])=>{
  const seen = new Set();
  const out = [];
  arr.forEach(v=>{
    const parts = String(v || "")
      .split(/[;,/|]+/)
      .map((x)=>normalizeInternalTech(x))
      .filter(Boolean);
    parts.forEach((norm)=>{
      const key = norm.toLowerCase();
      if(seen.has(key)) return;
      seen.add(key);
      out.push(norm);
    });
  });
  return out;
};
const normalizeInternalTechList = (raw="")=>
  dedupInternalTechs(
    String(raw || "")
      .split(/[;,/|]+/)
      .map((v)=>normalizeInternalTech(v))
      .filter(Boolean)
  );
const toLocalDateKey = window.toLocalDateKey || ((d)=>{
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return \`\${y}-\${m}-\${day}\`;
});
${parts.join("\n\n")}
let __logs = [];
const runtimePerf = { totalMissingMapCalls: 0 };
function resolveTimeLogRole(){ return "interne"; }
function getCanonicalTimeLogs(){ return __logs; }
function projectSiteById(){ return ""; }
function canonSiteKey(){ return ""; }
function sanitizeTechSitesMap(v){ return v || {}; }
function loadInternalTechSitesMap(){ return {}; }
function loadInternalTechRegistry(){ return []; }
function setLogs(v){ __logs = Array.isArray(v) ? v : []; }
function computeMissingEntriesByTaskPc(tasks = [], logs = []){
  setLogs(logs);
  const map = buildMissingDaysMap(tasks);
  const out = {};
  (tasks || []).forEach((t)=>{
    const key = String(t?.id || "").trim();
    if(!key) return;
    out[key] = Number(map.get(t.id) || 0);
  });
  return out;
}
module.exports = { computeMissingEntriesByTaskPc };
`;
  const sandbox = { module: { exports: {} }, exports: {}, console, Date, Math, Map, Set };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(code, sandbox, { timeout: 4000, filename: "fuzz-pc-missing-hours.js" });
  pcEngine = sandbox.module.exports;
  return pcEngine;
}

function normalizeTasksForPc(tasks = []) {
  return (tasks || []).map((t) => ({
    ...t,
    id: String(t?.id || t?.task_id || ""),
    projectId: String(t?.projectId || t?.project_id || ""),
    start: String(t?.start || t?.start_date || ""),
    end: String(t?.end || t?.end_date || ""),
    owner: String(t?.owner || t?.owner_type || ""),
    internalTech: String(t?.internalTech || t?.internal_tech || ""),
  }));
}

function normalizeLogsForPc(logs = []) {
  return (logs || []).map((l) => ({
    ...l,
    taskId: String(l?.taskId || l?.task_id || ""),
    date: String(l?.date || l?.date_key || l?.day || l?.log_date || "").slice(0, 10),
    role: String(l?.role || l?.role_key || l?.owner_type || ""),
    internalTech: String(l?.internalTech || l?.internal_tech || l?.technician || ""),
  }));
}

function normalizeTasksForSmartphone(tasks = []) {
  return (tasks || []).map((t) => ({
    ...t,
    id: String(t?.id || t?.task_id || ""),
    task_id: String(t?.task_id || t?.id || ""),
    project_id: String(t?.project_id || t?.projectId || ""),
    start_date: String(t?.start_date || t?.start || ""),
    end_date: String(t?.end_date || t?.end || ""),
    owner_type: String(t?.owner_type || t?.owner || ""),
    internal_tech: String(t?.internal_tech || t?.internalTech || ""),
  }));
}

function normalizeLogsForSmartphone(logs = []) {
  return (logs || []).map((l) => {
    const date = String(l?.date || l?.date_key || l?.day || l?.log_date || "").slice(0, 10);
    return {
      ...l,
      task_id: String(l?.task_id || l?.taskId || ""),
      taskId: String(l?.taskId || l?.task_id || ""),
      date,
      date_key: date,
      day: date,
      log_date: date,
      role_key: String(l?.role_key || l?.role || l?.owner_type || ""),
      role: String(l?.role || l?.role_key || l?.owner_type || ""),
      technician: String(l?.technician || l?.internal_tech || l?.internalTech || ""),
      internal_tech: String(l?.internal_tech || l?.technician || l?.internalTech || ""),
    };
  });
}

function compareObjectNumbers(a = {}, b = {}) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffs = [];
  for (const key of keys) {
    const av = Number(a[key] ?? 0);
    const bv = Number(b[key] ?? 0);
    if (av !== bv) diffs.push({ key, smartphone: av, pc: bv });
  }
  return diffs;
}

export function classifyCause(caseData, diff) {
  if (diff.ui.taskMismatches.length || diff.ui.projectMismatches.length) return "ui";
  if ((caseData.logs || []).some((l) => !String(l?.task_id || l?.taskId || "").trim())) return "mapping";
  if ((caseData.logs || []).some((l) => !String(l?.role || l?.role_key || "").trim())) return "role";
  if ((caseData.tasks || []).some((t) => !String(t?.start_date || t?.start || "").trim() || !String(t?.end_date || t?.end || "").trim())) return "date";
  return "date";
}

export function runCase(caseData) {
  const tasksSmart = normalizeTasksForSmartphone(caseData.tasks);
  const logsSmart = normalizeLogsForSmartphone(caseData.logs);
  const tasksPc = normalizeTasksForPc(caseData.tasks);
  const logsPc = normalizeLogsForPc(caseData.logs);

  const smartphoneByTask = computeMissingEntriesByTaskSmartphone(tasksSmart, logsSmart);
  const { computeMissingEntriesByTaskPc } = loadPcEngine();
  const pcByTask = computeMissingEntriesByTaskPc(tasksPc, logsPc);

  const smartphoneByProject = computeProjectTotalsFromTaskMap(tasksSmart, smartphoneByTask);
  const pcByProject = computeProjectTotalsFromTaskMap(tasksPc, pcByTask);
  const ui = compareUIInjection({
    tasks: tasksSmart,
    projects: caseData.projects || [],
    missingByTask: smartphoneByTask,
  });

  const taskDiffs = compareObjectNumbers(smartphoneByTask, pcByTask);
  const projectDiffs = compareObjectNumbers(smartphoneByProject, pcByProject);
  const taskSumSmartphone = Object.values(smartphoneByTask).reduce((s, v) => s + (Number(v) || 0), 0);
  const taskSumPc = Object.values(pcByTask).reduce((s, v) => s + (Number(v) || 0), 0);
  const same = taskDiffs.length === 0
    && projectDiffs.length === 0
    && taskSumSmartphone === taskSumPc
    && ui.taskMismatches.length === 0
    && ui.projectMismatches.length === 0;

  return {
    same,
    smartphone: {
      byTask: smartphoneByTask,
      byProject: smartphoneByProject,
      taskSum: taskSumSmartphone,
    },
    pc: {
      byTask: pcByTask,
      byProject: pcByProject,
      taskSum: taskSumPc,
    },
    diff: { taskDiffs, projectDiffs, ui },
  };
}
