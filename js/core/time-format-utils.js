(function initTimeFormatUtils(windowRef){
  if(!windowRef) return;
  if(windowRef.__timeFormatUtilsInstalled) return;
  windowRef.__timeFormatUtilsInstalled = true;

  function formatHoursMinutes(totalMinutes){
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if(m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  }

  function splitMinutesAcross(totalMinutes, count){
    const total = Math.max(0, Math.round(Number(totalMinutes || 0)));
    const n = Math.max(1, Math.round(Number(count || 1)));
    const base = Math.floor(total / n);
    let rem = total - (base * n);
    const out = Array.from({ length:n }, ()=>base);
    for(let i=0; i<out.length && rem>0; i+=1, rem-=1){
      out[i] += 1;
    }
    return out;
  }

  function formatHoursDecimal(minutes){
    const v = Math.round(((minutes || 0) / 60) * 100) / 100;
    return String(v).replace(".", ",") + "h";
  }

  windowRef.formatHoursMinutes = windowRef.formatHoursMinutes || formatHoursMinutes;
  windowRef.splitMinutesAcross = windowRef.splitMinutesAcross || splitMinutesAcross;
  windowRef.formatHoursDecimal = windowRef.formatHoursDecimal || formatHoursDecimal;
})(window);


