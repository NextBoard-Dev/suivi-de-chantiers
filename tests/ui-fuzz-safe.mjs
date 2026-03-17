import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const target = pathToFileURL(path.join(root, "index.html")).href;

const runCount = 3;
const actionsPerRun = 180;
const global = { runs: [], totalConsoleErrors: 0, totalPageErrors: 0, totalActions: 0 };

function r(n){ return Math.floor(Math.random() * n); }

for(let run=1; run<=runCount; run++){
  const errors = [];
  const pageErrors = [];
  let actions = 0;

  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  page.on("console", msg => { if(msg.type()==="error") errors.push(msg.text()); });
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
  await page.waitForTimeout(1000);

  const clickSelectors = [
    "button", ".btn", ".tab", "summary", "[role='button']",
    "#btnSave", "#btnConfig", "#btnExportMaster", "#btnExportProject", "#btnOpenWorkload"
  ];

  const inputSelectors = [
    "input[type='text']", "input[type='search']", "input[type='date']", "input[type='number']", "textarea", "select"
  ];

  const safeValues = ["test", "alpha", "123", "CDM", "LGT", "1", "0", "2026-03-09"];

  for(let i=0;i<actionsPerRun;i++){
    try{
      const op = r(5);
      if(op <= 2){
        const sel = clickSelectors[r(clickSelectors.length)];
        const els = page.locator(sel);
        const count = await els.count();
        if(count > 0){
          const idx = r(Math.min(count, 25));
          await els.nth(idx).click({ timeout: 800 }).catch(()=>{});
          actions++;
        }
      }else if(op === 3){
        const sel = inputSelectors[r(inputSelectors.length)];
        const els = page.locator(sel);
        const count = await els.count();
        if(count > 0){
          const idx = r(Math.min(count, 20));
          const node = els.nth(idx);
          const tag = await node.evaluate(el => el.tagName.toLowerCase()).catch(()=>"");
          if(tag === "select"){
            const opts = await node.locator("option").count().catch(()=>0);
            if(opts > 1){
              const val = await node.locator("option").nth(r(opts)).getAttribute("value").catch(()=>null);
              if(val !== null) await node.selectOption(val).catch(()=>{});
            }
          }else{
            await node.fill(safeValues[r(safeValues.length)], { timeout: 800 }).catch(()=>{});
          }
          actions++;
        }
      }else{
        await page.keyboard.press("Escape").catch(()=>{});
        actions++;
      }

      if(i % 30 === 0){
        await page.evaluate(() => {
          try { window.renderAll?.(); } catch {}
        });
      }

      await page.waitForTimeout(40);
    }catch(e){
      pageErrors.push(`action_${i}: ${String(e?.message || e)}`);
    }
  }

  await page.waitForTimeout(300);
  await browser.close();

  global.runs.push({ run, actions, consoleErrors: errors.length, pageErrors: pageErrors.length, sampleConsoleErrors: errors.slice(0,3), samplePageErrors: pageErrors.slice(0,3) });
  global.totalActions += actions;
  global.totalConsoleErrors += errors.length;
  global.totalPageErrors += pageErrors.length;
}

console.log(JSON.stringify({ target, ...global }, null, 2));
