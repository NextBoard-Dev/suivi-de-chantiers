import {
  ALLOWED_CHANTIER_STATUSES,
  CHANTIER_STATUS_TRANSITIONS,
  normalizeChantierInput,
  normalizeTaskInput,
} from "../src/lib/businessRules.js";

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function maybe(value) {
  return Math.random() < 0.5 ? value : "";
}

function randomDate() {
  const y = randInt(2024, 2028);
  const m = String(randInt(1, 12)).padStart(2, "0");
  const d = String(randInt(1, 28)).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function randomStatus() {
  return Math.random() < 0.9 ? pick(ALLOWED_CHANTIER_STATUSES) : "hors_ref";
}

let validOutputs = 0;
let invalidOutputs = 0;
let handledRejections = 0;

for (let i = 0; i < 4000; i += 1) {
  const previousStatus = pick(ALLOWED_CHANTIER_STATUSES);
  const nextStatus = randomStatus();

  const chantierInput = {
    name: `Chantier ${i}`,
    site: maybe(`Site ${randInt(1, 40)}`),
    subproject: maybe(`Sous-projet ${randInt(1, 20)}`),
    start_date: maybe(randomDate()),
    end_date: maybe(randomDate()),
    progress: randInt(-10, 130),
    lifecycle_status: nextStatus,
    budget_estimated: maybe(randInt(0, 1_000_000) / 10),
    budget_actual: maybe(randInt(0, 1_000_000) / 10),
    penalty_amount: maybe(randInt(0, 100_000) / 10),
  };

  const existing = {
    name: `Exist ${i}`,
    site: "X",
    subproject: "Y",
    progress: randInt(0, 100),
    start_date: maybe(randomDate()),
    end_date: maybe(randomDate()),
    lifecycle_status: previousStatus,
  };

  try {
    const out = normalizeChantierInput(chantierInput, { existing });
    const transitionAllowed = previousStatus === out.lifecycle_status
      || (CHANTIER_STATUS_TRANSITIONS[previousStatus] || []).includes(out.lifecycle_status);

    if (!out.name || out.progress < 0 || out.progress > 100 || !transitionAllowed) {
      invalidOutputs += 1;
    } else {
      validOutputs += 1;
    }
  } catch {
    handledRejections += 1;
  }
}

for (let i = 0; i < 4000; i += 1) {
  const start = maybe(randomDate());
  const end = maybe(randomDate());
  const owner = pick(["INTERNE", "RSG", "RI", "Prestataire externe", "BAD_OWNER"]);

  const input = {
    project_id: Math.random() < 0.95 ? String(randInt(1, 1000)) : "",
    description: Math.random() < 0.97 ? `Task ${i}` : "",
    owner_type: owner,
    vendor: maybe(`Vendor ${randInt(1, 99)}`),
    start_date: start,
    end_date: end,
    progress: randInt(-10, 130),
    statuses: ["Etude", "Peinture", "Etude"],
    estimated_cost: maybe(randInt(0, 100000) / 10),
    actual_cost: maybe(randInt(0, 100000) / 10),
    penalty_amount: maybe(randInt(0, 100000) / 10),
  };

  try {
    const out = normalizeTaskInput(input);
    const statusOk = Array.isArray(out.statuses);
    const progressOk = Number.isFinite(out.progress) && out.progress >= 0 && out.progress <= 100;

    if (!out.project_id || !out.description || !statusOk || !progressOk) {
      invalidOutputs += 1;
    } else {
      validOutputs += 1;
    }
  } catch {
    handledRejections += 1;
  }
}

if (invalidOutputs > 0) {
  console.error(`Fuzz FAILED | invalidOutputs=${invalidOutputs} valid=${validOutputs} rejected=${handledRejections}`);
  process.exit(1);
}

console.log(`Fuzz OK | invalidOutputs=0 valid=${validOutputs} rejected=${handledRejections}`);
