import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const appJsPath = path.join(root, "app.js");
const appJs = fs.readFileSync(appJsPath, "utf8");

function findBalancedBlock(src, startIndex) {
  let depth = 0, i = startIndex;
  let inSingle = false, inDouble = false, inTemplate = false, escaped = false;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (!inDouble && !inTemplate && ch === "'" && !inSingle) { inSingle = true; continue; }
    if (inSingle && ch === "'") { inSingle = false; continue; }
    if (!inSingle && !inTemplate && ch === '"' && !inDouble) { inDouble = true; continue; }
    if (inDouble && ch === '"') { inDouble = false; continue; }
    if (!inSingle && !inDouble && ch === "`" && !inTemplate) { inTemplate = true; continue; }
    if (inTemplate && ch === "`") { inTemplate = false; continue; }
    if (inSingle || inDouble || inTemplate) continue;
    if (ch === "{") depth += 1;
    if (ch === "}") { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

function extractFunction(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`Function not found: ${name}`);
  const openBrace = src.indexOf("{", start);
  const closeBrace = findBalancedBlock(src, openBrace);
  if (openBrace < 0 || closeBrace < 0) throw new Error(`Unbalanced function: ${name}`);
  return src.slice(start, closeBrace + 1);
}
function extractConstArrow(src, name) {
  const marker = `const ${name} =`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`Const arrow not found: ${name}`);
  const openBrace = src.indexOf("{", start);
  const closeBrace = findBalancedBlock(src, openBrace);
  if (openBrace < 0 || closeBrace < 0) throw new Error(`Unbalanced const arrow: ${name}`);
  const semi = src.indexOf(";", closeBrace);
  if (semi < 0) throw new Error(`Const arrow missing ';': ${name}`);
  return src.slice(start, semi + 1);
}
function extractConstLine(src, name){
  const rx = new RegExp(`const\\s+${name}\\s*=\\s*[^\\n]+;`);
  const m = src.match(rx);
  if(!m) throw new Error(`Const line not found: ${name}`);
  return m[0];
}

const code = [
  extractConstArrow(appJs, "ownerType"),
  extractConstLine(appJs, "attrEscape"),
  extractFunction(appJs, "isWeekday"),
  extractFunction(appJs, "countWeekdays"),
  extractFunction(appJs, "durationDays"),
  extractFunction(appJs, "startOfWeek"),
  extractFunction(appJs, "addDays"),
  extractFunction(appJs, "isoWeekInfo"),
  extractFunction(appJs, "barGeometry"),
  `module.exports={ownerType,attrEscape,isWeekday,countWeekdays,durationDays,startOfWeek,addDays,isoWeekInfo,barGeometry};`
].join("\n\n");

const sandbox = { module: { exports: {} }, exports: {}, console, Date, Math, Set, Map };
vm.runInNewContext(code, sandbox, { timeout: 2000, filename: "security-fuzz-core.js" });
const core = sandbox.module.exports;

function randInt(n){ return Math.floor(Math.random()*n); }
function randDate(){
  const y = 2024 + randInt(6);
  const m = 1 + randInt(12);
  const d = 1 + randInt(28);
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
function randStr(){
  const pool = ["", "<script>alert(1)</script>", "\" onmouseover=alert(1) x=\"", "Équipe interne", "Prestataire externe", "RSG/RI", "😀", "\\u0000", "&<>\"'", "../../etc/passwd", "   "];
  return pool[randInt(pool.length)] + String(randInt(10000));
}

const failures = [];
const warnings = [];

// ownerType fuzz
const allowed = new Set(["rsg","ri","interne","externe","inconnu"]);
for(let i=0;i<10000;i++){
  try{
    const out = core.ownerType(randStr());
    if(!allowed.has(out)){
      failures.push(`ownerType output invalide: ${out}`);
      break;
    }
  }catch(e){ failures.push(`ownerType throw: ${e.message}`); break; }
}

// attrEscape fuzz
for(let i=0;i<5000;i++){
  try{
    const input = randStr();
    const out = core.attrEscape(String(input));
    if(out.includes("<") || out.includes(">") || out.includes('"')){
      failures.push(`attrEscape non échappé: ${out}`);
      break;
    }
  }catch(e){ failures.push(`attrEscape throw: ${e.message}`); break; }
}

// Date / bar geometry robustness fuzz
for(let i=0;i<3000;i++){
  try{
    const s = randInt(4)===0 ? randStr() : randDate();
    const e = randInt(4)===0 ? randStr() : randDate();
    core.durationDays(s, e);
    const weekStart = new Date(randDate()+"T00:00:00");
    core.barGeometry(new Date(s+"T00:00:00"), new Date(e+"T00:00:00"), weekStart);
  }catch(e){ failures.push(`dates/barGeometry throw: ${e.message}`); break; }
}

// Static checks
if(/\beval\s*\(/.test(appJs)) warnings.push("Usage de eval détecté");
if(/new\s+Function\s*\(/.test(appJs)) warnings.push("Usage de Function constructor détecté");
const innerHtmlCount = (appJs.match(/innerHTML\s*=/g) || []).length;
warnings.push(`Sinks innerHTML détectés: ${innerHtmlCount}`);

if(failures.length){
  console.error("FUZZ_FAIL");
  failures.forEach(f=>console.error(" -", f));
  process.exit(1);
}

console.log("FUZZ_OK");
console.log("ownerType: 10000 cas");
console.log("attrEscape: 5000 cas");
console.log("dates/barGeometry: 3000 cas");
warnings.forEach(w=>console.log("WARN", w));
