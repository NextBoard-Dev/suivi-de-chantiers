function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

function pad2(v) {
  return String(v).padStart(2, "0");
}

function toDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function randomDateAroundToday(rand, daysRange = 90) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const delta = Math.floor((rand() * 2 - 1) * daysRange);
  d.setDate(d.getDate() + delta);
  return d;
}

function maybeShiftTimezone(dateKey, rand) {
  const mode = pick(rand, ["same", "plus1", "minus1", "same", "same"]);
  const d = new Date(`${dateKey}T12:00:00`);
  if (mode === "plus1") d.setDate(d.getDate() + 1);
  if (mode === "minus1") d.setDate(d.getDate() - 1);
  return toDateKey(d);
}

function uuidLike(rand) {
  const hex = "0123456789abcdef";
  const part = (n) => Array.from({ length: n }, () => hex[Math.floor(rand() * 16)]).join("");
  return `${part(8)}-${part(4)}-${part(4)}-${part(4)}-${part(12)}`;
}

function roleToOwner(role) {
  if (role === "INTERNE") return "INTERNE";
  if (role === "EXTERNE") return "Prestataire externe";
  if (role === "RI") return "RI";
  if (role === "RSG") return "RSG";
  if (role === "RSG/RI") return "RSG/RI";
  return "";
}

function randomRole(rand) {
  return pick(rand, ["INTERNE", "EXTERNE", "RI", "RSG", "RSG/RI", "UNKNOWN", "", null]);
}

function randomInternalTechCsv(rand) {
  const pool = ["ALICE", "BOB", "CHARLIE", "DAVID", "EVA"];
  const count = Math.floor(rand() * 3);
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(pick(rand, pool));
  return Array.from(new Set(out)).join(", ");
}

function makeTask(rand, idx, projectId) {
  const start = randomDateAroundToday(rand, 120);
  const end = new Date(start);
  end.setDate(end.getDate() + Math.floor(rand() * 25) - 3);
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);
  const role = randomRole(rand);
  const owner = roleToOwner(role);
  const internalTech = randomInternalTechCsv(rand);
  const useLegacyId = rand() < 0.25;
  const id = useLegacyId ? `legacy_${idx}_${Math.floor(rand() * 100000)}` : uuidLike(rand);
  const progress = Math.floor(rand() * 121);
  return {
    id,
    task_id: id,
    project_id: projectId,
    projectId: projectId,
    description: `TASK_${idx}`,
    start_date: startKey,
    end_date: endKey,
    start: startKey,
    end: endKey,
    owner_type: role ?? "",
    owner: owner || "",
    internal_tech: internalTech,
    internalTech,
    progress,
    progress_auto: progress,
  };
}

function makeLog(rand, tasks, idx) {
  const task = tasks.length && rand() < 0.8 ? pick(rand, tasks) : null;
  const role = randomRole(rand);
  const taskId = task ? task.id : (rand() < 0.5 ? `orphan_${idx}` : "");
  const sourceDate = task ? toDateKey(randomDateAroundToday(rand, 140)) : toDateKey(randomDateAroundToday(rand, 200));
  const date = maybeShiftTimezone(sourceDate, rand);
  const tech = randomInternalTechCsv(rand).split(",")[0] || "";
  const minutes = Math.floor(rand() * 10) * 15;
  return {
    id: `log_${idx}_${Math.floor(rand() * 1000000)}`,
    task_id: taskId,
    taskId,
    project_id: task?.project_id || "",
    date,
    date_key: date,
    day: date,
    log_date: date,
    role_key: role ?? "",
    role: role ?? "",
    owner_type: roleToOwner(role),
    technician: tech,
    internal_tech: tech,
    intervenant_label: tech || roleToOwner(role) || "UNK",
    minutes,
    note: rand() < 0.2 ? "note" : "",
  };
}

function forcedCases() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const saturday = new Date(today);
  saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7));

  const p = "project_forced";
  return [
    {
      caseId: "forced_100pct_no_logs",
      seed: 1,
      tasks: [{
        id: "forced_t1", task_id: "forced_t1", project_id: p, projectId: p, description: "forced",
        start_date: toDateKey(yesterday), end_date: toDateKey(tomorrow), start: toDateKey(yesterday), end: toDateKey(tomorrow),
        owner_type: "INTERNE", owner: "INTERNE", internal_tech: "ALICE", internalTech: "ALICE", progress: 100, progress_auto: 100,
      }],
      logs: [],
    },
    {
      caseId: "forced_out_of_range",
      seed: 2,
      tasks: [{
        id: "forced_t2", task_id: "forced_t2", project_id: p, projectId: p, description: "forced",
        start_date: "2030-01-01", end_date: "2030-01-03", start: "2030-01-01", end: "2030-01-03",
        owner_type: "RI", owner: "RI", internal_tech: "", internalTech: "", progress: 50, progress_auto: 50,
      }],
      logs: [],
    },
    {
      caseId: "forced_weekend",
      seed: 3,
      tasks: [{
        id: "forced_t3", task_id: "forced_t3", project_id: p, projectId: p, description: "forced",
        start_date: toDateKey(saturday), end_date: toDateKey(saturday), start: toDateKey(saturday), end: toDateKey(saturday),
        owner_type: "RSG", owner: "RSG", internal_tech: "", internalTech: "", progress: 10, progress_auto: 10,
      }],
      logs: [],
    },
    {
      caseId: "forced_bad_logs",
      seed: 4,
      tasks: [{
        id: "forced_t4", task_id: "forced_t4", project_id: p, projectId: p, description: "forced",
        start_date: toDateKey(yesterday), end_date: toDateKey(tomorrow), start: toDateKey(yesterday), end: toDateKey(tomorrow),
        owner_type: "INTERNE", owner: "INTERNE", internal_tech: "ALICE", internalTech: "ALICE", progress: 30, progress_auto: 30,
      }],
      logs: [
        { id: "l1", task_id: "", taskId: "", project_id: p, date: toDateKey(today), role: "", role_key: "", minutes: 60, technician: "", internal_tech: "" },
        { id: "l2", task_id: "forced_t4", taskId: "forced_t4", project_id: p, date: toDateKey(today), role: "INTERNE", role_key: "INTERNE", minutes: 60, technician: "", internal_tech: "" },
      ],
    },
  ];
}

export function generateScenario(seed, caseId = `case_${seed}`) {
  const rand = mulberry32(seed);
  const projectCount = 1 + Math.floor(rand() * 5);
  const projects = Array.from({ length: projectCount }, (_, i) => ({ id: `project_${seed}_${i}` }));

  const taskCount = 1 + Math.floor(rand() * 50);
  const tasks = [];
  for (let i = 0; i < taskCount; i += 1) {
    tasks.push(makeTask(rand, i, pick(rand, projects).id));
  }

  const logCount = Math.floor(rand() * 501);
  const logs = [];
  for (let i = 0; i < logCount; i += 1) {
    logs.push(makeLog(rand, tasks, i));
  }

  if (tasks.length && rand() < 0.35) {
    const t = pick(rand, tasks);
    const todayKey = toDateKey(new Date());
    logs.push({
      id: `dup_${seed}`, task_id: t.id, taskId: t.id, project_id: t.project_id, date: todayKey, date_key: todayKey, day: todayKey,
      role: t.owner_type || "INTERNE", role_key: t.owner_type || "INTERNE", owner_type: t.owner || "INTERNE",
      technician: t.internal_tech?.split(",")[0] || "", internal_tech: t.internal_tech?.split(",")[0] || "", minutes: 60,
    });
    logs.push({
      id: `dup2_${seed}`, task_id: t.id, taskId: t.id, project_id: t.project_id, date: todayKey, date_key: todayKey, day: todayKey,
      role: t.owner_type || "INTERNE", role_key: t.owner_type || "INTERNE", owner_type: t.owner || "INTERNE",
      technician: t.internal_tech?.split(",")[0] || "", internal_tech: t.internal_tech?.split(",")[0] || "", minutes: 15,
    });
  }

  return { caseId, seed, tasks, logs, projects };
}

export function generateScenarios(total = 1000, startSeed = 1000) {
  const base = forcedCases().map((c) => ({ ...c, projects: [{ id: "project_forced" }] }));
  const out = [...base];
  for (let i = 0; i < total; i += 1) {
    const seed = startSeed + i;
    out.push(generateScenario(seed, `rnd_${seed}`));
  }
  return out;
}

