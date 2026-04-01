const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const txt = fs.readFileSync(filePath, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

async function main() {
  const env = {
    ...parseEnvFile(path.join(process.cwd(), ".env.local")),
    ...process.env,
  };
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  const email = env.VITE_SUPABASE_AUTO_EMAIL || "sebastien_duc@outlook.fr";
  const password = env.VITE_SUPABASE_AUTO_PASSWORD || "Mililum@tt45";
  const appStatesTable = env.VITE_SUPABASE_APP_STATES_TABLE || "app_states";
  const readMode = String(env.VITE_STATE_JSON_READ_MODE || "strict").toLowerCase();

  if (!url || !key) throw new Error("Supabase env manquante (URL/KEY).");
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const sign = await sb.auth.signInWithPassword({ email, password });
  if (sign.error) throw new Error(`Auth Supabase impossible: ${sign.error.message}`);
  const sess = await sb.auth.getSession();
  const userId = sess?.data?.session?.user?.id || "";
  if (!userId) throw new Error("Session Supabase absente.");

  const res = await sb.from(appStatesTable).select("state_json,updated_at").eq("user_id", userId).limit(1);
  if (res.error) throw new Error(`Lecture app_states impossible: ${res.error.message}`);
  const row = Array.isArray(res.data) ? res.data[0] : null;
  const stateJson = row?.state_json || {};
  const projects = Array.isArray(stateJson.projects) ? stateJson.projects : [];
  const tasks = Array.isArray(stateJson.tasks) ? stateJson.tasks : [];

  if (readMode === "strict" && (projects.length === 0 || tasks.length === 0)) {
    throw new Error(`Parité bloquante: state_json vide/incomplet (projects=${projects.length}, tasks=${tasks.length}).`);
  }

  console.log(`[PARITE OK] mode=${readMode} state_json projects=${projects.length} tasks=${tasks.length} updated_at=${row?.updated_at || "n/a"}`);
}

main().catch((err) => {
  console.error(`[PARITE ERROR] ${err?.message || err}`);
  process.exit(1);
});

