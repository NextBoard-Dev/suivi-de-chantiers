import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateScenarios } from "./fuzzDataGenerator.mjs";
import { classifyCause, runCase } from "./fuzzEngine.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const randomCases = Number(process.env.FUZZ_CASES || 1000);
const stressRuns = Number(process.env.FUZZ_STRESS || 10000);
const scenarios = generateScenarios(randomCases, 7000);

const anomalies = [];
const causes = new Map();

for (let i = 0; i < stressRuns; i += 1) {
  const base = scenarios[i % scenarios.length];
  const caseData = {
    ...base,
    caseId: `${base.caseId}_run_${i + 1}`,
    seed: Number(base.seed || 0) + i,
  };
  const result = runCase(caseData);
  if (result.same) continue;
  const cause = classifyCause(caseData, result.diff);
  causes.set(cause, (causes.get(cause) || 0) + 1);
  const row = {
    caseId: caseData.caseId,
    seed: caseData.seed,
    tasks: caseData.tasks,
    logs: caseData.logs,
    smartphone: result.smartphone,
    pc: result.pc,
    diff: result.diff,
    cause,
  };
  anomalies.push(row);
  console.error(JSON.stringify(row));
}

const total = stressRuns;
const diffCount = anomalies.length;
const coherencePct = total > 0 ? (((total - diffCount) / total) * 100).toFixed(2) : "100.00";
const topCauses = Array.from(causes.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3)
  .map(([cause, count]) => ({ cause, count }));

const report = {
  totalRuns: total,
  diffCount,
  coherencePct: Number(coherencePct),
  topCauses,
  anomalies,
};

const reportPath = path.join(__dirname, "fuzz-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

console.log(`FUZZ_TOTAL=${total}`);
console.log(`FUZZ_DIFFS=${diffCount}`);
console.log(`FUZZ_COHERENCE_PCT=${coherencePct}`);
console.log(`FUZZ_REPORT=${reportPath}`);
console.log(`FUZZ_TOP_CAUSES=${JSON.stringify(topCauses)}`);

if (diffCount > 0) {
  process.exitCode = 1;
}

