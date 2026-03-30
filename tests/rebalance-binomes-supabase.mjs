import fs from "node:fs";

const APP_FILE = "app.js";
const PAIRS = [
  ["NICOLAS L", "OILI F"],
  ["SEBASTIEN L", "PAUL G"],
];

function pick(content, re) {
  const m = content.match(re);
  return m ? m[1] : "";
}

function norm(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseTechList(v) {
  return String(v || "")
    .split(",")
    .map((s) => norm(s))
    .filter(Boolean);
}

function isInternalRole(log) {
  return norm(log?.role) === "INTERNE";
}

function safeNum(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function splitEven(totalMinutes, names) {
  const count = names.length;
  const base = Math.floor(totalMinutes / count);
  let rem = totalMinutes - base * count;
  return names.map((name, idx) => {
    const add = rem > 0 ? 1 : 0;
    if (rem > 0) rem -= 1;
    return { name, minutes: base + add, idx };
  });
}

function makeStableId(taskId, date, techName) {
  const slug = norm(techName).replace(/[^A-Z0-9]+/g, "_");
  return `split_${taskId}_${date}_${slug}`;
}

async function getSession() {
  const app = fs.readFileSync(APP_FILE, "utf8");
  const url = pick(app, /const SUPABASE_URL\s*=\s*"([^"]+)"/);
  const key = pick(app, /const SUPABASE_KEY\s*=\s*"([^"]+)"/);
  const email = pick(app, /const SUPABASE_AUTO_EMAIL\s*=\s*"([^"]+)"/);
  const password = pick(app, /const SUPABASE_AUTO_PASSWORD\s*=\s*"([^"]+)"/);

  if (!url || !key || !email || !password) {
    throw new Error("Config Supabase introuvable dans app.js");
  }

  const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!authRes.ok) throw new Error(`Auth KO (${authRes.status})`);
  const auth = await authRes.json();
  const token = auth?.access_token;
  const userId = auth?.user?.id;
  if (!token || !userId) throw new Error("Session invalide");

  return { url, key, token, userId };
}

async function loadState(session) {
  const res = await fetch(
    `${session.url}/rest/v1/app_states?select=user_id,state_json,updated_at&user_id=eq.${encodeURIComponent(session.userId)}&limit=1`,
    {
      headers: {
        apikey: session.key,
        Authorization: `Bearer ${session.token}`,
        Accept: "application/json",
      },
    }
  );
  if (!res.ok) throw new Error(`Lecture app_states KO (${res.status})`);
  const rows = await res.json();
  const row = rows?.[0];
  if (!row?.state_json) throw new Error("state_json vide");
  return row;
}

function buildTaskPairMap(tasks) {
  const pairMap = new Map();
  for (const t of tasks) {
    const techs = parseTechList(t?.internalTech || t?.internal_tech || "");
    for (const pair of PAIRS) {
      if (pair.every((name) => techs.includes(name))) {
        pairMap.set(String(t.id), pair);
        break;
      }
    }
  }
  return pairMap;
}

function transformState(state) {
  const tasks = Array.isArray(state?.tasks) ? state.tasks : [];
  const logs = Array.isArray(state?.timeLogs) ? state.timeLogs : [];
  const taskPair = buildTaskPairMap(tasks);

  const grouped = new Map();
  const untouched = [];

  for (const log of logs) {
    const taskId = String(log?.taskId || "");
    const date = String(log?.date || "");
    const pair = taskPair.get(taskId);
    if (!pair || !date || !isInternalRole(log)) {
      untouched.push(log);
      continue;
    }
    const key = `${taskId}|${date}`;
    if (!grouped.has(key)) grouped.set(key, { taskId, date, pair, logs: [] });
    grouped.get(key).logs.push(log);
  }

  const replacedGroups = [];
  const rebuilt = [...untouched];

  for (const { taskId, date, pair, logs: glogs } of grouped.values()) {
    const total = glogs.reduce((s, l) => s + safeNum(l.minutes), 0);
    if (total <= 0) {
      rebuilt.push(...glogs);
      continue;
    }

    const template = glogs.find((l) => l && typeof l === "object") || {};
    const note = glogs.map((l) => String(l?.note || "").trim()).find(Boolean) || "";
    const meta = splitEven(total, pair);

    for (const part of meta) {
      rebuilt.push({
        ...template,
        id: makeStableId(taskId, date, part.name),
        taskId,
        date,
        role: "INTERNE",
        internalTech: part.name,
        minutes: part.minutes,
        note,
        updatedAt: new Date().toISOString(),
      });
    }

    replacedGroups.push({
      taskId,
      date,
      pair: pair.join(" / "),
      beforeMinutes: total,
      afterMinutes: total,
    });
  }

  return {
    nextState: {
      ...state,
      timeLogs: rebuilt,
    },
    stats: {
      targetedTaskCount: taskPair.size,
      replacedGroupCount: replacedGroups.length,
      replacedGroups,
      beforeLogs: logs.length,
      afterLogs: rebuilt.length,
    },
  };
}

function summarizePairTotals(state) {
  const tasks = Array.isArray(state?.tasks) ? state.tasks : [];
  const logs = Array.isArray(state?.timeLogs) ? state.timeLogs : [];
  const taskPair = buildTaskPairMap(tasks);

  const out = {
    "NICOLAS L": 0,
    "OILI F": 0,
    "SEBASTIEN L": 0,
    "PAUL G": 0,
  };

  for (const log of logs) {
    if (!isInternalRole(log)) continue;
    const pair = taskPair.get(String(log?.taskId || ""));
    if (!pair) continue;
    const tech = norm(log?.internalTech || "");
    if (Object.prototype.hasOwnProperty.call(out, tech)) {
      out[tech] += safeNum(log.minutes);
    }
  }

  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, +(v / 60).toFixed(2)]));
}

async function saveState(session, userId, stateJson) {
  const res = await fetch(
    `${session.url}/rest/v1/app_states?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: session.key,
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ state_json: stateJson }),
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PATCH KO (${res.status}) ${txt}`);
  }
  const rows = await res.json();
  return rows?.[0] || null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const session = await getSession();
  const row = await loadState(session);

  const beforeState = row.state_json;
  const beforeTotals = summarizePairTotals(beforeState);
  const { nextState, stats } = transformState(beforeState);
  const afterTotals = summarizePairTotals(nextState);

  console.log("Mode:", apply ? "APPLY" : "DRY-RUN");
  console.log("Supabase updated_at:", row.updated_at || "(vide)");
  console.log("Pair totals BEFORE (h):", beforeTotals);
  console.log("Pair totals AFTER  (h):", afterTotals);
  console.log("Stats:", {
    targetedTaskCount: stats.targetedTaskCount,
    replacedGroupCount: stats.replacedGroupCount,
    beforeLogs: stats.beforeLogs,
    afterLogs: stats.afterLogs,
  });

  if (!apply) return;

  const saved = await saveState(session, row.user_id, nextState);
  console.log("PATCH OK. New updated_at:", saved?.updated_at || "(non retourne)");
}

main().catch((e) => {
  console.error("Erreur:", e?.message || e);
  process.exit(1);
});
