export const ALLOWED_CHANTIER_STATUSES = [
  "a_planifier",
  "en_cours",
  "en_pause",
  "clos",
  "annule",
];

export const CHANTIER_STATUS_TRANSITIONS = {
  a_planifier: ["en_cours", "annule"],
  en_cours: ["en_pause", "clos", "annule"],
  en_pause: ["en_cours", "clos", "annule"],
  clos: [],
  annule: [],
};

export const ALLOWED_OWNER_TYPES = ["INTERNE", "RSG", "RI", "Prestataire externe"];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

export function normalizeString(value, { maxLength = 250, allowEmpty = true } = {}) {
  if (value === undefined || value === null) return "";
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (!allowEmpty && !normalized) {
    throw new Error("Champ texte obligatoire");
  }
  if (normalized.length > maxLength) {
    throw new Error(`Texte trop long (${maxLength} max)`);
  }
  return normalized;
}

export function normalizeIsoDate(value, { field = "date", allowEmpty = true } = {}) {
  if (value === undefined || value === null || value === "") {
    if (allowEmpty) return "";
    throw new Error(`${field} obligatoire`);
  }

  const normalized = String(value).trim();
  if (!DATE_PATTERN.test(normalized)) {
    throw new Error(`${field} invalide (format YYYY-MM-DD attendu)`);
  }

  const d = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`${field} invalide`);
  }

  return normalized;
}

export function normalizeFiniteNumber(
  value,
  { field = "nombre", min = -1e12, max = 1e12, decimals = 2, allowEmpty = true, defaultValue = null } = {}
) {
  if (value === undefined || value === null || value === "") {
    if (allowEmpty) return defaultValue;
    throw new Error(`${field} obligatoire`);
  }

  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) {
    throw new Error(`${field} invalide (NaN/Infinity interdit)`);
  }
  if (n < min || n > max) {
    throw new Error(`${field} hors bornes`);
  }

  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

export function normalizeStatuses(value) {
  const input = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const out = [];
  for (const item of input) {
    const clean = normalizeString(item, { maxLength: 60, allowEmpty: true });
    if (!clean) continue;
    if (!out.includes(clean)) out.push(clean);
  }
  return out;
}

export function validateDateOrder(startDate, endDate) {
  if (!startDate || !endDate) return;
  if (startDate > endDate) {
    throw new Error("La date de fin doit etre >= date de debut");
  }
}

function toLocalMidnight(isoDate) {
  return new Date(`${isoDate}T00:00:00`);
}

function countWeekdaysInclusive(startDate, endDate) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) return 0;
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return 0;

  let count = 0;
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  const last = new Date(endDate);
  last.setHours(0, 0, 0, 0);

  while (cursor <= last) {
    const day = cursor.getDay();
    if (day >= 1 && day <= 5) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

export function computeTaskProgressAuto(startDate, endDate, now = new Date()) {
  if (!startDate || !endDate) return 0;

  const start = toLocalMidnight(startDate);
  const end = toLocalMidnight(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (today <= start) return 0;
  if (today >= end) return 100;

  const totalWeekdays = countWeekdaysInclusive(start, end);
  if (!totalWeekdays) return 0;

  const elapsedWeekdays = countWeekdaysInclusive(start, today);
  const pct = Math.round((elapsedWeekdays / totalWeekdays) * 100);
  return Math.max(0, Math.min(100, pct));
}

export function ensureValidChantierTransition(previousStatus, nextStatus) {
  if (!previousStatus || previousStatus === nextStatus) return;
  const allowed = CHANTIER_STATUS_TRANSITIONS[previousStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`Transition chantier interdite: ${previousStatus} -> ${nextStatus}`);
  }
}

function readStatus(input = {}) {
  return input.lifecycle_status || input.status || "a_planifier";
}

export function normalizeChantierInput(input = {}, { existing = null } = {}) {
  const previous = readStatus(existing || {});
  const next = readStatus(input || existing || {});

  if (!ALLOWED_CHANTIER_STATUSES.includes(next)) {
    throw new Error(`Statut chantier non autorise: ${next}`);
  }
  ensureValidChantierTransition(previous, next);

  const startDate = normalizeIsoDate(input.start_date ?? existing?.start_date ?? "", {
    field: "start_date",
    allowEmpty: true,
  });
  const endDate = normalizeIsoDate(input.end_date ?? existing?.end_date ?? "", {
    field: "end_date",
    allowEmpty: true,
  });
  validateDateOrder(startDate, endDate);

  const name = normalizeString(input.name ?? existing?.name ?? "", {
    maxLength: 120,
    allowEmpty: false,
  });

  const progress = computeTaskProgressAuto(startDate, endDate);

  const payload = {
    name,
    site: normalizeString(input.site ?? existing?.site ?? "", { maxLength: 120, allowEmpty: true }),
    subproject: normalizeString(input.subproject ?? existing?.subproject ?? "", { maxLength: 120, allowEmpty: true }),
    lifecycle_status: next,
    progress,
    start_date: startDate || null,
    end_date: endDate || null,
    updated_date: new Date().toISOString(),
  };

  if (hasOwn(input, "budget_estimated") || hasOwn(existing || {}, "budget_estimated")) {
    payload.budget_estimated = normalizeFiniteNumber(input.budget_estimated ?? existing?.budget_estimated ?? null, {
      field: "budget_estimated",
      min: 0,
      max: 1e9,
      decimals: 2,
      allowEmpty: true,
      defaultValue: null,
    });
  }

  if (hasOwn(input, "budget_actual") || hasOwn(existing || {}, "budget_actual")) {
    payload.budget_actual = normalizeFiniteNumber(input.budget_actual ?? existing?.budget_actual ?? null, {
      field: "budget_actual",
      min: 0,
      max: 1e9,
      decimals: 2,
      allowEmpty: true,
      defaultValue: null,
    });
  }

  if (hasOwn(input, "penalty_amount") || hasOwn(existing || {}, "penalty_amount")) {
    payload.penalty_amount = normalizeFiniteNumber(input.penalty_amount ?? existing?.penalty_amount ?? null, {
      field: "penalty_amount",
      min: 0,
      max: 1e9,
      decimals: 2,
      allowEmpty: true,
      defaultValue: null,
    });
  }

  return payload;
}

export function normalizeTaskInput(input = {}, { existing = null } = {}) {
  const startDate = normalizeIsoDate(input.start_date ?? existing?.start_date ?? "", {
    field: "start_date",
    allowEmpty: true,
  });
  const endDate = normalizeIsoDate(input.end_date ?? existing?.end_date ?? "", {
    field: "end_date",
    allowEmpty: true,
  });
  validateDateOrder(startDate, endDate);

  const ownerType = normalizeString(input.owner_type ?? existing?.owner_type ?? "", {
    maxLength: 60,
    allowEmpty: true,
  });
  if (ownerType && !ALLOWED_OWNER_TYPES.includes(ownerType)) {
    throw new Error(`owner_type non autorise: ${ownerType}`);
  }

  const progress = normalizeFiniteNumber(input.progress ?? existing?.progress ?? 0, {
    field: "progress",
    min: 0,
    max: 100,
    decimals: 0,
    allowEmpty: false,
  });

  const projectIdRaw = input.project_id ?? existing?.project_id;
  const projectId = projectIdRaw === undefined || projectIdRaw === null || projectIdRaw === ""
    ? ""
    : String(projectIdRaw).trim();

  if (!projectId) {
    throw new Error("project_id obligatoire pour une tache");
  }

  const durationDays = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(`${endDate}T00:00:00.000Z`) - new Date(`${startDate}T00:00:00.000Z`)) / 86400000) + 1)
    : 0;

  const payload = {
    project_id: projectId,
    description: normalizeString(input.description ?? existing?.description ?? "", { maxLength: 240, allowEmpty: false }),
    owner_type: ownerType || null,
    vendor: normalizeString(input.vendor ?? existing?.vendor ?? "", { maxLength: 140, allowEmpty: true }) || null,
    start_date: startDate || null,
    end_date: endDate || null,
    progress,
    statuses: normalizeStatuses(input.statuses ?? existing?.statuses ?? []),
    duration_days: durationDays,
    updated_date: new Date().toISOString(),
  };

  if (hasOwn(input, "estimated_cost") || hasOwn(existing || {}, "estimated_cost")) {
    payload.estimated_cost = normalizeFiniteNumber(input.estimated_cost ?? existing?.estimated_cost ?? null, {
      field: "estimated_cost",
      min: 0,
      max: 1e9,
      decimals: 2,
      allowEmpty: true,
      defaultValue: null,
    });
  }

  if (hasOwn(input, "actual_cost") || hasOwn(existing || {}, "actual_cost")) {
    payload.actual_cost = normalizeFiniteNumber(input.actual_cost ?? existing?.actual_cost ?? null, {
      field: "actual_cost",
      min: 0,
      max: 1e9,
      decimals: 2,
      allowEmpty: true,
      defaultValue: null,
    });
  }

  if (hasOwn(input, "penalty_amount") || hasOwn(existing || {}, "penalty_amount")) {
    payload.penalty_amount = normalizeFiniteNumber(input.penalty_amount ?? existing?.penalty_amount ?? null, {
      field: "penalty_amount",
      min: 0,
      max: 1e9,
      decimals: 2,
      allowEmpty: true,
      defaultValue: null,
    });
  }

  return payload;
}
