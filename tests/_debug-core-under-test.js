const ownerType = (o="")=>{

  const k=o.toLowerCase();

  if(k.includes("rsg/ri") || k.includes("rsg") || k.includes("ri")) return "rsgri";

  const hasInt = k.includes("interne");

  const hasExt = k.includes("externe");

  // Plus de catgorie "mixte" : on priorise "interne" si exclusif, sinon "externe".

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

function computeWorkloadData(tasks, mode="week", rangeStart=null, rangeEnd=null){

  const map = new Map(); // key -> {internal, external, rsgri, total, anchor}

  tasks.filter(t=>t.start && t.end).forEach(t=>{

    const start=new Date(t.start+"T00:00:00");

    const end=new Date(t.end+"T00:00:00");

    if(isNaN(start)||isNaN(end)|| end<start) return;

    const typ = ownerType(t.owner);

    for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){

      if(!isWeekday(d)) continue;

      if(rangeStart && d < rangeStart) continue;

      if(rangeEnd && d > rangeEnd) continue;

      const key = mode==="day" ? d.toISOString().slice(0,10) : weekKey(d);

      const anchor = mode==="day" ? d.getTime() : startOfWeek(d).getTime();

      if(!map.has(key)) map.set(key,{internal:0,external:0,rsgri:0,total:0,anchor});

      const slot = map.get(key);

      if(typ==="rsgri") slot.rsgri+=1;
      else if(typ==="interne") slot.internal+=1;

      else slot.external+=1; // "externe" + inconnus

      slot.total = slot.internal + slot.external + slot.rsgri;

    }

  });

  const arr = Array.from(map.entries()).map(([key,val])=>({...val,key}));

  arr.sort((a,b)=> a.anchor - b.anchor);

  return arr;

}
function weekKey(d){
  const info=isoWeekInfo(d);
  return `${info.year}-S${String(info.week).padStart(2,"0")}`;
}
module.exports={ownerType,isWeekday,countWeekdays,durationDays,startOfWeek,addDays,isoWeekInfo,weekKey,barGeometry,computeWorkloadData};