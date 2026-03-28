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

  function formatHoursDecimal(minutes){
    const v = Math.round(((minutes || 0) / 60) * 100) / 100;
    return String(v).replace(".", ",") + "h";
  }

  windowRef.formatHoursMinutes = windowRef.formatHoursMinutes || formatHoursMinutes;
  windowRef.formatHoursDecimal = windowRef.formatHoursDecimal || formatHoursDecimal;
})(window);

