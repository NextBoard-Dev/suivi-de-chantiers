import fs from "node:fs";

const FILE = "suivi_chantiers_backup.json";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toStr(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

function isDate(v) {
  return DATE_RE.test(toStr(v));
}

function ownerType(ownerRaw) {
  const k = toStr(ownerRaw).toLowerCase();
  if (!k) return "inconnu";
  if (k.includes("rsg")) return "rsg";
  if (k === "ri") return "ri";
  if (k.includes("interne")) return "interne";
  if (k.includes("externe")) return "externe";
  return "inconnu";
}

function readJson(path) {
  const txt = fs.readFileSync(path, "utf8");
  return JSON.parse(txt);
}

function main() {
  const issues = [];
  const data = readJson(FILE);

  const projects = Array.isArray(data.projects) ? data.projects : [];
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const logs = Array.isArray(data.timeLogs) ? data.timeLogs : [];

  if (!Array.isArray(data.projects)) issues.push("projects absent ou invalide");
  if (!Array.isArray(data.tasks)) issues.push("tasks absent ou invalide");
  if (!Array.isArray(data.timeLogs)) issues.push("timeLogs absent ou invalide");

  const projectIds = new Set();
  for (const p of projects) {
    const id = toStr(p?.id);
    if (!id) issues.push("project sans id");
    if (id && projectIds.has(id)) issues.push(`project id duplique: ${id}`);
    if (id) projectIds.add(id);
  }

  const taskIds = new Set();
  for (const t of tasks) {
    const id = toStr(t?.id);
    const projectId = toStr(t?.projectId);
    const owner = toStr(t?.owner);
    const oType = ownerType(owner);
    const start = toStr(t?.start);
    const end = toStr(t?.end);
    const status = toStr(t?.status);
    const internalTech = toStr(t?.internalTech);
    const vendor = toStr(t?.vendor);

    if (!id) issues.push("task sans id");
    if (id && taskIds.has(id)) issues.push(`task id duplique: ${id}`);
    if (id) taskIds.add(id);

    if (!projectId) issues.push(`task ${id || "(sans id)"} sans projectId`);
    if (projectId && !projectIds.has(projectId)) issues.push(`task ${id || "(sans id)"} projectId inconnu: ${projectId}`);

    if (!owner) issues.push(`task ${id || "(sans id)"} sans owner`);
    if (oType === "inconnu") issues.push(`task ${id || "(sans id)"} owner invalide: ${owner}`);
    if (oType === "interne" && !internalTech) issues.push(`task ${id || "(sans id)"} interne sans internalTech`);
    if (oType === "externe" && !vendor) issues.push(`task ${id || "(sans id)"} externe sans vendor`);

    if (!isDate(start)) issues.push(`task ${id || "(sans id)"} start invalide: ${start}`);
    if (!isDate(end)) issues.push(`task ${id || "(sans id)"} end invalide: ${end}`);
    if (isDate(start) && isDate(end) && end < start) issues.push(`task ${id || "(sans id)"} end < start`);
    if (!status) issues.push(`task ${id || "(sans id)"} sans status`);

    // Compat smartphone: owner_type, statuses[], start_date/end_date doivent etre derivables.
    if (oType === "inconnu") issues.push(`smartphone incompatible owner_type sur task ${id || "(sans id)"}`);
    if (!status.split(",").map((x) => toStr(x)).filter(Boolean).length) {
      issues.push(`smartphone incompatible statuses sur task ${id || "(sans id)"}`);
    }
  }

  for (const l of logs) {
    const id = toStr(l?.id);
    const taskId = toStr(l?.taskId);
    const date = toStr(l?.date);
    const minutes = Number(l?.minutes);
    if (!id) issues.push("log sans id");
    if (!taskId) issues.push(`log ${id || "(sans id)"} sans taskId`);
    if (taskId && !taskIds.has(taskId)) issues.push(`log ${id || "(sans id)"} taskId inconnu: ${taskId}`);
    if (!isDate(date)) issues.push(`log ${id || "(sans id)"} date invalide: ${date}`);
    if (!Number.isFinite(minutes) || minutes < 0) issues.push(`log ${id || "(sans id)"} minutes invalides: ${l?.minutes}`);
  }

  console.log(`Fichier: ${FILE}`);
  console.log(`Projects: ${projects.length} | Tasks: ${tasks.length} | TimeLogs: ${logs.length}`);
  if (!issues.length) {
    console.log("OK: contrat JSON valide (PC + compat smartphone)");
    process.exit(0);
  }

  console.log(`KO: ${issues.length} anomalie(s)`);
  for (const i of issues.slice(0, 80)) console.log(`- ${i}`);
  if (issues.length > 80) console.log(`- ... +${issues.length - 80} autre(s)`);
  process.exit(2);
}

main();

