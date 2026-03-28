const fs = require('fs');
const data = JSON.parse(fs.readFileSync('suivi_chantiers_backup.json','utf8'));
const tasks = Array.isArray(data.tasks) ? data.tasks : [];
const logs = Array.isArray(data.timeLogs) ? data.timeLogs : [];

function norm(s){ return String(s || '').trim(); }
function normTech(s){ return norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase(); }
function listTech(raw){
  return String(raw || '')
    .split(/[,;\n\/]+/)
    .map(normTech)
    .filter(Boolean)
    .filter((v,i,a)=>a.indexOf(v)===i);
}
function ownerType(o){
  const s = String(o || '').toLowerCase();
  if(s.includes('rsg/ri')) return 'rsg';
  if(s.includes('rsg')) return 'rsg';
  if(s.includes('ri')) return 'ri';
  const hasInt = s.includes('interne');
  const hasExt = s.includes('externe') || s.includes('prestataire');
  if(hasInt && !hasExt) return 'interne';
  if(hasExt) return 'externe';
  return 'inconnu';
}
function getTaskRoleKey(t){
  if(norm(t && t.vendor)) return 'externe';
  const hasCsv = listTech(t && t.internalTech).length > 0;
  const hasArr = Array.isArray(t && t.internalTechs) && t.internalTechs.some(x=>!!normTech(x || ''));
  if(hasCsv || hasArr) return 'interne';
  const typ = ownerType(t && t.owner);
  if(typ === 'rsg') return 'rsg';
  if(typ === 'ri') return 'ri';
  if(typ === 'externe') return 'externe';
  if(typ === 'inconnu'){
    if(hasCsv || hasArr) return 'interne';
    return 'externe';
  }
  return 'interne';
}
function normalizeRole(log){
  const raw = String((typeof log === 'string') ? log : (log && (log.role || log.roleKey) || '')).toLowerCase();
  if(raw.includes('rsg/ri')) return 'rsg';
  if(raw.includes('rsg')) return 'rsg';
  if(raw.includes('ri')) return 'ri';
  if(raw.includes('externe')) return 'externe';
  if(raw.includes('interne')) return 'interne';
  return 'interne';
}
function normalizeLogTech(l, role){ return role === 'interne' ? normTech(l && l.internalTech) : ''; }
function logKey(taskId, date, role, tech){
  const t = role === 'interne' ? normTech(tech).toLowerCase() : '';
  return String(taskId) + '|' + String(date).slice(0,10) + '|' + role + '|' + t;
}
function isWeekday(d){ const g = d.getDay(); return g >= 1 && g <= 5; }

const canonMap = new Map();
for(const l of logs){
  if(!l || !l.taskId || !l.date) continue;
  const rk = normalizeRole(l);
  const tk = normalizeLogTech(l, rk);
  const k = logKey(l.taskId, l.date, rk, tk);
  if(!canonMap.has(k)) canonMap.set(k, { ...l, roleKey: rk, internalTech: tk });
  else {
    const e = canonMap.get(k);
    e.minutes = Math.max(0, Math.round(Number(e.minutes || 0) + Number(l.minutes || 0)));
    canonMap.set(k, e);
  }
}
const canon = Array.from(canonMap.values());

function findByRole(taskId, date, role, tech){
  const targetRole = normalizeRole(role);
  const targetTech = targetRole === 'interne' ? normTech(tech) : '';
  const matchAnyInternalTech = targetRole === 'interne' && !targetTech;
  return canon.find((l)=>{
    if(String(l.taskId) !== String(taskId)) return false;
    if(String(l.date).slice(0,10) !== date) return false;
    const rk = normalizeRole(l);
    if(rk !== targetRole) return false;
    if(matchAnyInternalTech) return true;
    const tk = rk === 'interne' ? normTech(l.internalTech || '') : '';
    return tk.toLowerCase() === targetTech.toLowerCase();
  }) || null;
}

function specsForTask(t){
  const role = getTaskRoleKey(t);
  if(role !== 'interne') return [{ roleKey: role, internalTech: '' }];
  const techs = listTech(t && t.internalTech);
  if(!techs.length) return [];
  return techs.map((n)=>({ roleKey: 'interne', internalTech: n }));
}

const today = '2026-03-28';
const missingTasks = [];
let missingEntries = 0;
for(const t of tasks){
  if(!t || !t.start || !t.end) continue;
  const s = new Date(t.start + 'T00:00:00');
  const e = new Date(t.end + 'T00:00:00');
  if(Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) continue;
  let missForTask = 0;
  const specs = specsForTask(t);
  if(!specs.length) continue;
  for(let d = new Date(s); d <= e; d.setDate(d.getDate()+1)){
    if(!isWeekday(d)) continue;
    const dk = d.toISOString().slice(0,10);
    if(dk > today) continue;
    for(const spec of specs){
      if(!findByRole(t.id, dk, spec.roleKey, spec.internalTech)){
        missForTask += 1;
        missingEntries += 1;
      }
    }
  }
  if(missForTask > 0){
    missingTasks.push({ id:t.id, task:t.roomNumber || '', owner:t.owner || '', vendor:t.vendor || '', internalTech:t.internalTech || '', start:t.start, end:t.end, missForTask });
  }
}

console.log(JSON.stringify({ tasks: tasks.length, timeLogs: logs.length, missingTasksCount: missingTasks.length, missingEntries }, null, 2));
for(const x of missingTasks.slice(0,30)){
  console.log(x.id + ' | ' + x.task + ' | owner=' + x.owner + ' | vendor=' + x.vendor + ' | tech=' + x.internalTech + ' | miss=' + x.missForTask + ' | ' + x.start + '->' + x.end);
}
