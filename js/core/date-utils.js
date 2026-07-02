(function initDateUtils(windowRef){
  if(!windowRef) return;
  if(windowRef.__dateUtilsInstalled) return;
  windowRef.__dateUtilsInstalled = true;

  function formatDate(s){
    if(!s) return "";
    const parts = String(s).split("-");
    if(parts.length !== 3) return s;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function unformatDate(fr){
    if(!fr) return "";
    const parts = String(fr).split("/");
    if(parts.length !== 3) return fr;
    const [jj, mm, aa] = parts;
    return `${aa}-${mm}-${jj}`;
  }

  function isWeekday(d){
    const day = d.getDay();
    return day >= 1 && day <= 5;
  }

  function countWeekdays(start, end){
    if(!start || !end || end < start) return 0;
    let count = 0;
    for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
      if(isWeekday(d)) count += 1;
    }
    return count;
  }

  function durationDays(start, end){
    if(!start || !end) return "";
    const s = new Date(start + "T00:00:00");
    const e = new Date(end + "T00:00:00");
    if(isNaN(s) || isNaN(e) || e < s) return "";
    const days = countWeekdays(s, e);
    return days > 0 ? days : "";
  }

  function toDateInput(d){
    if(!d) return "";
    const x = new Date(d.getTime());
    return x.toISOString().slice(0,10);
  }

  function toInputDate(val){
    if(!val) return "";
    if(val instanceof Date){
      return val.toISOString().slice(0,10);
    }
    const s = String(val).trim();
    if(!s) return "";
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(m) return `${m[3]}-${m[2]}-${m[1]}`;
    return s;
  }

  function parseInputDate(v){
    if(!v) return null;
    const d = new Date(v+"T00:00:00");
    return isNaN(d) ? null : d;
  }

  function toISODateStart(d){
    if(!d) return "";
    const x = new Date(d.getTime());
    x.setHours(0,0,0,0);
    return x.toISOString();
  }

  function toISODateEnd(d){
    if(!d) return "";
    const x = new Date(d.getTime());
    x.setHours(23,59,59,999);
    return x.toISOString();
  }

  function toLocalISODate(d){
    if(!d || isNaN(d)) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }

  function toLocalDateKey(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }

  function getYesterdayKey(){
    const d = new Date();
    d.setDate(d.getDate()-1);
    return toLocalDateKey(d);
  }

  function resolveSelectedLogDate(rawValue, fallbackKey){
    const raw = String(rawValue || "").trim();
    if(raw) return raw;
    return String(fallbackKey || "").trim();
  }

  function clampLoginRange(start, end, maxDays){
    const safeMaxDays = Number.isFinite(maxDays) ? maxDays : 35;
    const s = new Date(start.getTime());
    const e = new Date(end.getTime());
    const diff = Math.floor((e - s) / 86400000);
    if(diff <= safeMaxDays) return {start:s, end:e, clamped:false};
    const ns = new Date(e.getTime());
    ns.setDate(ns.getDate() - safeMaxDays);
    return {start:ns, end:e, clamped:true};
  }

  function formatShortDate(d){
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  }

  function formatShortDateTwoLinesHTML(d){
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yy = String(d.getFullYear()).slice(-2);
    return `<span class="wk-date-top">${dd}-${mm}</span><span class="wk-date-bottom">${yy}</span>`;
  }

  windowRef.formatDate = windowRef.formatDate || formatDate;
  windowRef.unformatDate = windowRef.unformatDate || unformatDate;
  windowRef.isWeekday = windowRef.isWeekday || isWeekday;
  windowRef.countWeekdays = windowRef.countWeekdays || countWeekdays;
  windowRef.durationDays = windowRef.durationDays || durationDays;
  windowRef.toDateInput = windowRef.toDateInput || toDateInput;
  windowRef.toInputDate = windowRef.toInputDate || toInputDate;
  windowRef.parseInputDate = windowRef.parseInputDate || parseInputDate;
  windowRef.toISODateStart = windowRef.toISODateStart || toISODateStart;
  windowRef.toISODateEnd = windowRef.toISODateEnd || toISODateEnd;
  windowRef.toLocalISODate = windowRef.toLocalISODate || toLocalISODate;
  windowRef.toLocalDateKey = windowRef.toLocalDateKey || toLocalDateKey;
  windowRef.getYesterdayKey = windowRef.getYesterdayKey || getYesterdayKey;
  windowRef.resolveSelectedLogDate = windowRef.resolveSelectedLogDate || resolveSelectedLogDate;
  windowRef.clampLoginRange = windowRef.clampLoginRange || clampLoginRange;
  windowRef.formatShortDate = windowRef.formatShortDate || formatShortDate;
  windowRef.formatShortDateTwoLinesHTML = windowRef.formatShortDateTwoLinesHTML || formatShortDateTwoLinesHTML;
})(window);

