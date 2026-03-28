import fs from "node:fs";

const FILE = "suivi_chantiers_backup.json";
const OUT_DIR = "archives/reports";

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

function nowTag() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}${m}${day}_${hh}${mm}`;
}

function readJson(path) {
  const txt = fs.readFileSync(path, "utf8");
  return JSON.parse(txt);
}

function main() {
  const data = readJson(FILE);
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const logs = Array.isArray(data.timeLogs) ? data.timeLogs : [];

  const projectIds = new Set(projects.map((p) => toStr(p?.id)).filter(Boolean));
  const taskIds = new Set(tasks.map((t) => toStr(t?.id)).filter(Boolean));

  const owners = new Map();
  for (const t of tasks) {
    const k = toStr(t?.owner).toUpperCase() || "(VIDE)";
    owners.set(k, (owners.get(k) || 0) + 1);
  }

  const issues = [];
  const interneNoTech = [];
  const externeNoVendor = [];
  const unknownOwner = [];

  for (const t of tasks) {
    const id = toStr(t?.id) || "(sans id)";
    const projectId = toStr(t?.projectId);
    const oType = ownerType(t?.owner);
    const start = toStr(t?.start);
    const end = toStr(t?.end);
    const status = toStr(t?.status);
    const internalTech = toStr(t?.internalTech);
    const vendor = toStr(t?.vendor);

    if (!projectId || !projectIds.has(projectId)) issues.push(`Task ${id}: projectId invalide`);
    if (!isDate(start) || !isDate(end) || (isDate(start) && isDate(end) && end < start)) {
      issues.push(`Task ${id}: dates invalides`);
    }
    if (!status) issues.push(`Task ${id}: status vide`);

    if (oType === "interne" && !internalTech) interneNoTech.push(id);
    if (oType === "externe" && !vendor) externeNoVendor.push(id);
    if (oType === "inconnu") unknownOwner.push(id);
  }

  let logsInvalid = 0;
  for (const l of logs) {
    const taskId = toStr(l?.taskId);
    const date = toStr(l?.date);
    const mins = Number(l?.minutes);
    if (!taskId || !taskIds.has(taskId)) logsInvalid += 1;
    else if (!isDate(date)) logsInvalid += 1;
    else if (!Number.isFinite(mins) || mins < 0) logsInvalid += 1;
  }

  const ownerRows = [...owners.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const ok =
    issues.length === 0 &&
    interneNoTech.length === 0 &&
    externeNoVendor.length === 0 &&
    unknownOwner.length === 0 &&
    logsInvalid === 0;

  const lines = [];
  lines.push("RAPPORT CONTRAT JSON (PC + SMARTPHONE)");
  lines.push(`Date: ${new Date().toISOString()}`);
  lines.push(`Fichier: ${FILE}`);
  lines.push("");
  lines.push(`Projects: ${projects.length}`);
  lines.push(`Tasks: ${tasks.length}`);
  lines.push(`TimeLogs: ${logs.length}`);
  lines.push("");
  lines.push("Repartition owner:");
  lines.push(ownerRows || "- (aucune)");
  lines.push("");
  lines.push("Controles metier:");
  lines.push(`- INTERNE sans technicien: ${interneNoTech.length}`);
  lines.push(`- EXTERNE sans prestataire: ${externeNoVendor.length}`);
  lines.push(`- Owner invalide: ${unknownOwner.length}`);
  lines.push(`- Logs invalides: ${logsInvalid}`);
  lines.push("");
  lines.push("Compat smartphone:");
  lines.push("- owner_type derivable: " + (unknownOwner.length === 0 ? "OK" : "KO"));
  lines.push("- start_date/end_date derivables: " + (issues.some((x) => x.includes("dates")) ? "KO" : "OK"));
  lines.push("- statuses derivables: " + (issues.some((x) => x.includes("status vide")) ? "KO" : "OK"));
  lines.push("");
  lines.push("Conclusion:");
  lines.push(ok ? "- OK: contrat valide" : "- KO: corrections necessaires");
  if (!ok) {
    lines.push("");
    lines.push("Details (max 40):");
    for (const row of [...issues, ...interneNoTech.map((id) => `Task ${id}: INTERNE sans technicien`), ...externeNoVendor.map((id) => `Task ${id}: EXTERNE sans prestataire`), ...unknownOwner.map((id) => `Task ${id}: owner invalide`)].slice(0, 40)) {
      lines.push(`- ${row}`);
    }
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = `${OUT_DIR}/json_contract_report_${nowTag()}.txt`;
  fs.writeFileSync(outFile, lines.join("\n") + "\n", "utf8");

  console.log(`Rapport ecrit: ${outFile}`);
  console.log(ok ? "OK: contrat valide" : "KO: contrat invalide");
}

main();

