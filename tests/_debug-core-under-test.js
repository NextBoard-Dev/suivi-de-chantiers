const ownerType = (o="")=>{

  const k=o.toLowerCase();

  if(k.includes("rsg/ri")) return "rsg";
  if(k.includes("rsg")) return "rsg";
  if(k.includes("ri")) return "ri";

  const hasInt = k.includes("interne");

  const hasExt = k.includes("externe");

  // Plus de catégorie "mixte" : on priorise "interne" si exclusif, sinon "externe".

  if(hasInt && !hasExt) return "interne";

  if(hasExt) return "externe";

  return "inconnu";

};

function isWeekday(d){

  const day = d.getDay();

  return day >= 1 && day <= 5; // lundi-vendredi

}

function countWeekdays(start, end){

  if(!start || !end || end < start) return 0;

  let count = 0;

  for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){

    if(isWeekday(d)) count += 1;

  }

  return count;

}

function durationDays(start,end){

  if(!start || !end) return "";

  const s=new Date(start+"T00:00:00");

  const e=new Date(end+"T00:00:00");

  if(isNaN(s) || isNaN(e) || e<s) return "";

  const days = countWeekdays(s, e);

  return days>0 ? days : "";

}

function startOfWeek(d){

  const x=new Date(d.getTime());

  const day=(x.getDay()+6)%7; // lundi=0

  x.setDate(x.getDate()-day);

  x.setHours(0,0,0,0);

  return x;

}

function addDays(d,n){ const x=new Date(d.getTime()); x.setDate(x.getDate()+n); return x; }

function isoWeekInfo(d){

  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

  const day = date.getUTCDay() || 7;

  date.setUTCDate(date.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));

  const weekNo = Math.ceil(((date - yearStart)/86400000 +1)/7);

  return {week:weekNo, year:date.getUTCFullYear()};

}

function barGeometry(taskStart, taskEnd, weekStart){

  const weekEnd = addDays(weekStart,4); // semaine ouvre

  const start = taskStart > weekStart ? taskStart : weekStart;

  const end = taskEnd < weekEnd ? taskEnd : weekEnd;

  const days = countWeekdays(start, end);

  if(days<=0) return {days:0,width:0,offset:0};

  let offsetDays = 0;

  if(taskStart > weekStart){

    const offsetEnd = addDays(taskStart, -1);

    const offsetLimit = offsetEnd < weekEnd ? offsetEnd : weekEnd;

    offsetDays = countWeekdays(weekStart, offsetLimit);

  }

  const offsetPct  = Math.min(100, (offsetDays/5)*100);

  let widthPct = (days/5)*100;

  // éviter dépassement au-delà de la cellule

  if(offsetPct + widthPct > 100) widthPct = 100 - offsetPct;

  widthPct = Math.max(12, Math.min(100, widthPct));

  return {days, width:widthPct, offset:offsetPct};

}

function getTaskRoleKey(t){
  const hasVendor = (t?.vendor || "").trim();
  if(hasVendor) return "externe";
  const typ = ownerType(t?.owner);
  if(typ === "rsg") return "rsg";
  if(typ === "ri") return "ri";
  if(typ === "externe" || typ === "inconnu") return "externe";
  return "interne";
}

function roleLabel(roleKey){
  if(roleKey==="rsg") return "RSG";
  if(roleKey==="ri") return "RI";
  if(roleKey==="externe") return "EXTERNE";
  return "INTERNE";
}

function roleHoursMultiplier(roleKey){
  return roleKey === "interne" ? 2 : 1;
}

function normalizeTimeLogRole(log){
  const raw = String(log?.role || log?.roleKey || "").toLowerCase();
  if(raw.includes("rsg/ri")) return "rsg";
  if(raw.includes("rsg")) return "rsg";
  if(raw.includes("ri")) return "ri";
  if(raw.includes("externe")) return "externe";
  if(raw.includes("interne")) return "interne";
  return resolveTimeLogRole(log?.userName || "", log?.userEmail || "");
}

function getTaskTimeTotals(taskRef){
  const taskId = (typeof taskRef === "string") ? taskRef : taskRef?.id;
  const roleKey = (typeof taskRef === "object" && taskRef) ? getTaskRoleKey(taskRef) : "";
  const rangeStart = (typeof taskRef === "object" && taskRef && taskRef.start) ? taskRef.start : "";
  const rangeEnd = (typeof taskRef === "object" && taskRef && taskRef.end) ? taskRef.end : "";
  const totals = new Map();
  getCanonicalTimeLogs().filter(l=>{
    if(l.taskId!==taskId) return false;
    if(!roleKey) return true;
    return normalizeTimeLogRole(l)===roleKey;
  }).forEach(l=>{
    if(rangeStart && l.date < rangeStart) return;
    if(rangeEnd && l.date > rangeEnd) return;
    const normalizedRole = normalizeTimeLogRole(l);
    const key = roleLabel(normalizedRole);
    const weightedMinutes = Math.round((Number(l.minutes || 0)) * roleHoursMultiplier(normalizedRole));
    totals.set(key, (totals.get(key)||0) + weightedMinutes);
  });
  const items = Array.from(totals.entries()).map(([name, minutes])=>({name, minutes}));
  items.sort((a,b)=>b.minutes - a.minutes);
  const totalMinutes = items.reduce((acc,it)=>acc+it.minutes,0);
  return {items, totalMinutes};
}

function computeWorkloadData(tasks, mode="week", rangeStart=null, rangeEnd=null){

  const map = new Map(); // key -> {internal, external, rsg, ri, total, anchor}

  const ids = new Set((tasks || []).map(t=>t.id));
  const roleByTask = new Map((tasks || []).map(t=>[t.id, getTaskRoleKey(t)]));
  const rangeByTask = new Map((tasks || []).map(t=>[t.id, {start:t.start||"", end:t.end||""}]));
  if(ids.size === 0) return [];

  getCanonicalTimeLogs().forEach(l=>{
    if(!ids.has(l.taskId)) return;
    if(!l.date) return;
    const d = new Date(l.date+"T00:00:00");
    if(isNaN(d)) return;
    const range = rangeByTask.get(l.taskId);
    if(range?.start && l.date < range.start) return;
    if(range?.end && l.date > range.end) return;
    if(rangeStart && d < rangeStart) return;
    if(rangeEnd && d > rangeEnd) return;

    const key = mode==="day" ? l.date : weekKey(d);
    const anchor = mode==="day" ? d.getTime() : startOfWeek(d).getTime();
    if(!map.has(key)) map.set(key,{internal:0,external:0,rsg:0,ri:0,total:0,anchor});
    const slot = map.get(key);

    const roleExpected = roleByTask.get(l.taskId);
    const role = normalizeTimeLogRole(l);
    if(roleExpected && role !== roleExpected) return;
    const hours = (Number(l.minutes||0) / 60);
    if(!hours) return;
    const mult = (typeof roleHoursMultiplier === "function")
      ? roleHoursMultiplier(role)
      : (role === "interne" ? 2 : 1);
    const weightedHours = hours * mult;
    if(role==="rsg") slot.rsg+=weightedHours;
    else if(role==="ri") slot.ri+=weightedHours;
    else if(role==="interne") slot.internal+=weightedHours;
    else slot.external+=weightedHours;
    slot.total = slot.internal + slot.external + slot.rsg + slot.ri;
  });

  const arr = Array.from(map.entries()).map(([key,val])=>({...val,key}));
  arr.sort((a,b)=> a.anchor - b.anchor);
  return arr;

}
let __testLogs = [];
function getCanonicalTimeLogs(){ return __testLogs; }
function setTestLogs(logs){ __testLogs = Array.isArray(logs) ? logs : []; }
function weekKey(d){
  const info=isoWeekInfo(d);
  return `${info.year}-S${String(info.week).padStart(2,"0")}`;
}
module.exports={ownerType,isWeekday,countWeekdays,durationDays,startOfWeek,addDays,isoWeekInfo,weekKey,barGeometry,getTaskRoleKey,roleLabel,roleHoursMultiplier,normalizeTimeLogRole,getTaskTimeTotals,computeWorkloadData,setTestLogs};