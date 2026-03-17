import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const target = pathToFileURL(path.join(root, "index.html")).href;

const errors = [];
const pageErrors = [];
const actions = [];

const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();

page.on("console", msg => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", err => pageErrors.push(String(err?.message || err)));

await page.addInitScript(() => {
  try {
    sessionStorage.setItem("unlocked", "1");
    sessionStorage.setItem("current_user", "Fuzz Bot");
    sessionStorage.setItem("current_role", "admin");
    sessionStorage.setItem("current_email", "fuzz@local");
  } catch {}
});

await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1200);

const candidateSelectors = [
  "button",
  ".btn",
  ".tab",
  ".help-btn",
  "[role='button']",
  "summary"
];

const textInputs = [
  "input[type='text']",
  "input[type='search']",
  "input[type='date']",
  "textarea"
];

const fuzzTexts = [
  "test",
  "<script>alert(1)</script>",
  "\" onmouseover=alert(1) x=\"",
  "éàèù ç",
  "LONG_" + "A".repeat(200)
];

function r(n){ return Math.floor(Math.random() * n); }

for (let i = 0; i < 220; i++) {
  const op = r(4);
  try {
    if (op <= 1) {
      const sel = candidateSelectors[r(candidateSelectors.length)];
      const els = page.locator(sel);
      const count = await els.count();
      if (count > 0) {
        const idx = r(Math.min(count, 25));
        await els.nth(idx).click({ timeout: 1000 }).catch(() => {});
        actions.push(`click:${sel}[${idx}]`);
      }
    } else if (op === 2) {
      const sel = textInputs[r(textInputs.length)];
      const els = page.locator(sel);
      const count = await els.count();
      if (count > 0) {
        const idx = r(Math.min(count, 20));
        const val = fuzzTexts[r(fuzzTexts.length)];
        await els.nth(idx).fill(val, { timeout: 1000 }).catch(() => {});
        actions.push(`fill:${sel}[${idx}]`);
      }
    } else {
      await page.keyboard.press("Escape").catch(() => {});
      actions.push("key:Escape");
    }

    if (i % 20 === 0) {
      await page.evaluate(() => {
        try { window.renderAll?.(); } catch {}
      });
    }

    await page.waitForTimeout(60);
  } catch (e) {
    pageErrors.push(`action_${i}: ${String(e?.message || e)}`);
  }
}

await page.waitForTimeout(400);

const summary = {
  target,
  actions: actions.length,
  consoleErrors: errors.length,
  pageErrors: pageErrors.length,
  sampleConsoleErrors: errors.slice(0, 10),
  samplePageErrors: pageErrors.slice(0, 10)
};

console.log(JSON.stringify(summary, null, 2));

await browser.close();
