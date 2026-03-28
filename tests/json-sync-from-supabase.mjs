import fs from "node:fs";

const LOCAL_JSON = "suivi_chantiers_backup.json";
const APP_FILE = "app.js";

function pick(content, re) {
  const m = content.match(re);
  return m ? m[1] : "";
}

function countState(state) {
  return {
    projects: Array.isArray(state?.projects) ? state.projects.length : 0,
    tasks: Array.isArray(state?.tasks) ? state.tasks.length : 0,
    timeLogs: Array.isArray(state?.timeLogs) ? state.timeLogs.length : 0,
  };
}

async function fetchSupabaseState() {
  const app = fs.readFileSync(APP_FILE, "utf8");
  const url = pick(app, /const SUPABASE_URL\s*=\s*"([^"]+)"/);
  const key = pick(app, /const SUPABASE_KEY\s*=\s*"([^"]+)"/);
  const email = pick(app, /const SUPABASE_AUTO_EMAIL\s*=\s*"([^"]+)"/);
  const password = pick(app, /const SUPABASE_AUTO_PASSWORD\s*=\s*"([^"]+)"/);

  if (!url || !key || !email || !password) {
    throw new Error("Configuration Supabase introuvable dans app.js");
  }

  const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!authRes.ok) throw new Error(`Auth Supabase KO (${authRes.status})`);
  const auth = await authRes.json();
  const token = auth?.access_token;
  const userId = auth?.user?.id;
  if (!token || !userId) throw new Error("Session Supabase invalide");

  const stateRes = await fetch(
    `${url}/rest/v1/app_states?select=state_json,updated_at,user_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${token}`, Accept: "application/json" } }
  );
  if (!stateRes.ok) throw new Error(`Lecture app_states KO (${stateRes.status})`);
  const rows = await stateRes.json();
  const row = rows?.[0];
  if (!row?.state_json) throw new Error("state_json Supabase vide");
  return { state: row.state_json, updatedAt: row.updated_at || "" };
}

async function main() {
  const writeMode = process.argv.includes("--write");
  const localRaw = fs.readFileSync(LOCAL_JSON, "utf8");
  const local = JSON.parse(localRaw);
  const localCounts = countState(local);

  const remote = await fetchSupabaseState();
  const remoteCounts = countState(remote.state);

  const same = JSON.stringify(local) === JSON.stringify(remote.state);

  console.log("Mode:", writeMode ? "WRITE" : "DRY-RUN");
  console.log("Supabase updated_at:", remote.updatedAt || "(vide)");
  console.log("Local:", localCounts);
  console.log("Remote:", remoteCounts);
  console.log("Equal:", same ? "YES" : "NO");

  if (writeMode && !same) {
    fs.writeFileSync(LOCAL_JSON, `${JSON.stringify(remote.state, null, 2)}\n`, "utf8");
    console.log("Action: JSON local mis a jour depuis Supabase");
  } else if (writeMode && same) {
    console.log("Action: aucune ecriture (deja aligne)");
  } else {
    console.log("Action: aucune ecriture (dry-run)");
  }
}

main().catch((e) => {
  console.error("Erreur:", e?.message || e);
  process.exit(1);
});

