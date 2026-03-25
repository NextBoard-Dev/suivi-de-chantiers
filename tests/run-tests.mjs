import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const root = process.cwd();
const appJsPath = path.join(root, "app.js");
const indexHtmlPath = path.join(root, "index.html");

const appJs = fs.readFileSync(appJsPath, "utf8");
const indexHtml = fs.readFileSync(indexHtmlPath, "utf8");

function findBalancedBlock(src, startIndex) {
  let depth = 0;
  let i = startIndex;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let templateExprDepth = 0;
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
    if (!inSingle && !inTemplate && ch === '"' && !inDouble) {
      inDouble = true;
      continue;
    } else if (inDouble && ch === '"') {
      inDouble = false;
      continue;
    }
    if (!inSingle && !inDouble && ch === "`" && !inTemplate) {
      inTemplate = true;
      continue;
    } else if (inTemplate && templateExprDepth === 0 && ch === "`") {
      inTemplate = false;
      continue;
    }
    if (inTemplate) {
      if (ch === "$" && src[i + 1] === "{") {
        templateExprDepth += 1;
        i += 1;
        continue;
      }
      if (templateExprDepth > 0 && ch === "{") {
        depth += 1;
        continue;
      }
      if (templateExprDepth > 0 && ch === "}") {
        depth -= 1;
        templateExprDepth -= 1;
        if (depth === 0) return i;
        continue;
      }
      if (templateExprDepth === 0) continue;
    }
    if (inSingle || inDouble) continue;
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

function extractConstArrow(src, name) {
  const marker = `const ${name} =`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`Const arrow not found: ${name}`);
  const openBrace = src.indexOf("{", start);
  const closeBrace = findBalancedBlock(src, openBrace);
  if (openBrace < 0 || closeBrace < 0) throw new Error(`Unbalanced const arrow: ${name}`);
  const semi = src.indexOf(";", closeBrace);
  if (semi < 0) throw new Error(`Const arrow missing ';': ${name}`);
  return src.slice(start, semi + 1);
}

function loadCoreForTests() {
  const parts = [
    extractConstArrow(appJs, "ownerType"),
    extractFunction(appJs, "isWeekday"),
    extractFunction(appJs, "countWeekdays"),
    extractFunction(appJs, "durationDays"),
    extractFunction(appJs, "startOfWeek"),
    extractFunction(appJs, "addDays"),
    extractFunction(appJs, "isoWeekInfo"),
    extractFunction(appJs, "barGeometry"),
    extractFunction(appJs, "getTaskRoleKey"),
    extractFunction(appJs, "roleLabel"),
    extractFunction(appJs, "roleHoursMultiplier"),
    extractFunction(appJs, "normalizeTimeLogRole"),
    extractFunction(appJs, "normalizeTimeLogInternalTech"),
    extractFunction(appJs, "getExpectedLogSpecsForTask"),
    extractFunction(appJs, "hasAllExpectedLogsForTaskDate"),
    extractFunction(appJs, "getTaskTimeTotals"),
    extractFunction(appJs, "computeWorkloadData"),
  ];
  const code = `${parts.join("\n\n")}
let __testLogs = [];
const normalizeInternalTech = (v="") => (v || "").toString().trim();
const dedupInternalTechs = (arr=[]) => {
  const seen = new Set();
  const out = [];
  (arr || []).forEach((v)=>{
    const norm = normalizeInternalTech(v);
    if(!norm) return;
    const key = norm.toLowerCase();
    if(seen.has(key)) return;
    seen.add(key);
    out.push(norm);
  });
  return out;
};
const normalizeInternalTechList = (raw="") =>
  dedupInternalTechs(
    String(raw || "")
      .split(/[;,]/)
      .map((v)=>normalizeInternalTech(v))
      .filter(Boolean)
  );
function resolveTimeLogRole(){ return "interne"; }
function getCanonicalTimeLogs(){ return __testLogs; }
function setTestLogs(logs){ __testLogs = Array.isArray(logs) ? logs : []; }
function buildTimeLogKey(taskId, dateKey, roleKey, internalTech=""){
  const rk = normalizeTimeLogRole(roleKey);
  const techKey = rk === "interne" ? normalizeInternalTech(internalTech || "") : "";
  return [taskId, dateKey, rk, techKey.toLowerCase()].join("|");
}
function findTimeLogByRole(taskId, dateKey, roleKey, internalTech=""){
  const logs = getCanonicalTimeLogs();
  const targetRole = normalizeTimeLogRole(roleKey);
  const targetTech = targetRole === "interne" ? normalizeInternalTech(internalTech || "") : "";
  const matchAnyInternalTech = targetRole === "interne" && !targetTech;
  return logs.find((l)=>{
    if(l.taskId!==taskId || l.date!==dateKey) return false;
    const rk = normalizeTimeLogRole(l);
    if(rk!==targetRole) return false;
    if(matchAnyInternalTech) return true;
    const tk = rk === "interne" ? normalizeTimeLogInternalTech(l, rk) : "";
    return tk.toLowerCase() === targetTech.toLowerCase();
  }) || null;
}
function getInternalTechsForTaskHours(task){
  const selected = normalizeInternalTechList(task?.internalTech || "");
  if(selected.length) return dedupInternalTechs(selected);
  return [];
}
function weekKey(d){
  const info=isoWeekInfo(d);
  return \`\${info.year}-S\${String(info.week).padStart(2,"0")}\`;
}
module.exports={ownerType,normalizeInternalTech,dedupInternalTechs,normalizeInternalTechList,isWeekday,countWeekdays,durationDays,startOfWeek,addDays,isoWeekInfo,weekKey,barGeometry,getTaskRoleKey,roleLabel,roleHoursMultiplier,normalizeTimeLogRole,normalizeTimeLogInternalTech,buildTimeLogKey,findTimeLogByRole,getExpectedLogSpecsForTask,hasAllExpectedLogsForTaskDate,getTaskTimeTotals,computeWorkloadData,setTestLogs};`;
  const sandbox = { module: { exports: {} }, exports: {}, console, Date, Math, Set, Map };
  fs.writeFileSync(path.join(root, "tests", "_debug-core-under-test.js"), code, "utf8");
  vm.runInNewContext(code, sandbox, { timeout: 2000, filename: "core-under-test.js" });
  return sandbox.module.exports;
}

const core = loadCoreForTests();
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test("Jours ouvres: lundi-vendredi = 5", () => {
  const s = new Date("2026-02-02T00:00:00");
  const e = new Date("2026-02-06T00:00:00");
  assert.equal(core.countWeekdays(s, e), 5);
});

test("Jours ouvres: weekend exclu", () => {
  assert.equal(core.durationDays("2026-02-06", "2026-02-10"), 3);
  assert.equal(core.durationDays("2026-02-07", "2026-02-08"), "");
});

test("Semaine ISO: 16/02/2026 = semaine 8", () => {
  const monday = new Date("2026-02-16T00:00:00");
  const info = core.isoWeekInfo(monday);
  assert.equal(info.week, 8);
});

test("Vacances Zone B 2025-2026 configurees", () => {
  assert.match(appJs, /"2025-2026"\s*:\s*\[8,9,16,17,28,29,30,31,32,33,34,35,43,44,52\]/);
});

test("Geometrie Gantt: semaine complete", () => {
  const weekStart = new Date("2026-02-16T00:00:00");
  const g = core.barGeometry(new Date("2026-02-16T00:00:00"), new Date("2026-02-20T00:00:00"), weekStart);
  assert.equal(g.days, 5);
  assert.equal(g.offset, 0);
  assert.equal(g.width, 100);
});

test("Metriques workload: interne/externe/rsg/ri", () => {
  const tasks = [
    { id: "t1", start: "2026-02-16", end: "2026-02-20", owner: "Équipe interne", vendor: "" },
    { id: "t2", start: "2026-02-16", end: "2026-02-17", owner: "Prestataire externe", vendor: "MARION" },
    { id: "t3", start: "2026-02-18", end: "2026-02-19", owner: "RSG", vendor: "" },
    { id: "t4", start: "2026-02-18", end: "2026-02-19", owner: "RI", vendor: "" },
  ];
  core.setTestLogs([
    { taskId: "t1", date: "2026-02-16", minutes: 120, role: "INTERNE" },
    { taskId: "t2", date: "2026-02-16", minutes: 180, role: "EXTERNE" },
    { taskId: "t3", date: "2026-02-18", minutes: 60, role: "RSG" },
    { taskId: "t4", date: "2026-02-19", minutes: 30, role: "RI" },
  ]);
  const rows = core.computeWorkloadData(tasks, "week");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].internal, 2);
  assert.equal(rows[0].external, 3);
  assert.equal(rows[0].rsg, 1);
  assert.equal(rows[0].ri, 0.5);
  assert.equal(rows[0].total, 6.5);
});

test("Totaux tâche: interne unitaire", () => {
  const task = { id: "ti", start: "2026-02-16", end: "2026-02-20", owner: "Équipe interne", vendor: "" };
  core.setTestLogs([
    { taskId: "ti", date: "2026-02-16", minutes: 60, role: "INTERNE" },
    { taskId: "ti", date: "2026-02-17", minutes: 30, role: "INTERNE" },
  ]);
  const totals = core.getTaskTimeTotals(task);
  assert.equal(totals.totalMinutes, 90);
});

test("Totaux tâche: externe reste unitaire", () => {
  const task = { id: "te", start: "2026-02-16", end: "2026-02-20", owner: "Prestataire externe", vendor: "X" };
  core.setTestLogs([
    { taskId: "te", date: "2026-02-16", minutes: 60, role: "EXTERNE" },
    { taskId: "te", date: "2026-02-17", minutes: 90, role: "EXTERNE" },
  ]);
  const totals = core.getTaskTimeTotals(task);
  assert.equal(totals.totalMinutes, 150);
});

test("Rappel veille: interne multi-techniciens exige tous les logs attendus", () => {
  const task = {
    id: "tm",
    start: "2026-02-16",
    end: "2026-02-20",
    owner: "Équipe interne",
    vendor: "",
    internalTech: "ALICE, BOB",
  };
  const dateKey = "2026-02-18";

  core.setTestLogs([
    { taskId: "tm", date: dateKey, minutes: 60, role: "INTERNE", internalTech: "ALICE" },
  ]);
  assert.equal(core.hasAllExpectedLogsForTaskDate(task, dateKey), false);

  core.setTestLogs([
    { taskId: "tm", date: dateKey, minutes: 60, role: "INTERNE", internalTech: "ALICE" },
    { taskId: "tm", date: dateKey, minutes: 30, role: "INTERNE", internalTech: "BOB" },
  ]);
  assert.equal(core.hasAllExpectedLogsForTaskDate(task, dateKey), true);
});

test("Export PDF: fonction unifiée presente", () => {
  assert.match(appJs, /function\s+runUnifiedPdfExport\s*\(/);
  assert.match(appJs, /function\s+ensurePrintTemplate\s*\(/);
});

test("Export PDF: template impression contient concepteur", () => {
  assert.match(indexHtml, /Concepteur\s*:\s*Sébastien DUC/);
  assert.match(indexHtml, /config-copyright/);
});

test("Export PDF: helpers de sélection des variantes heures présents", () => {
  assert.match(appJs, /function\s+resolveHoursVariantsFromModalState\s*\(/);
  assert.match(appJs, /function\s+buildSelectedExportDefinitions\s*\(/);
});

test("Export PDF: suppression des drapeaux redondants de variantes heures", () => {
  assert.doesNotMatch(appJs, /projectHoursModuleDone|masterHoursModuleDone/);
});

test("Export PDF: repartition et analyse heures projet forcent une page dédiée", () => {
  assert.match(appJs, /if\(def\.key === "project_pie"[\s\S]*?forceNewPage:true/);
  assert.match(appJs, /if\(\(def\.key === "project_hours" \|\| def\.key === "project_hours_internal_only"\)[\s\S]*?forceNewPage:true/);
});

let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log(`PASS ${t.name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${t.name}`);
    console.error(`  ${err.message}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) en echec.`);
  process.exit(1);
}

console.log(`\nOK ${tests.length} tests passes.`);

