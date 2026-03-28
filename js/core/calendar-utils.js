(function initCalendarUtils(windowRef){
  if(!windowRef) return;
  if(windowRef.__calendarUtilsInstalled) return;
  windowRef.__calendarUtilsInstalled = true;

  function isWeekday(d){
    const day = d.getDay();
    return day >= 1 && day <= 5;
  }

  function startOfWeek(d){
    const x = new Date(d.getTime());
    const day = (x.getDay()+6)%7; // lundi=0
    x.setDate(x.getDate()-day);
    x.setHours(0,0,0,0);
    return x;
  }

  windowRef.isWeekday = windowRef.isWeekday || isWeekday;
  windowRef.startOfWeek = windowRef.startOfWeek || startOfWeek;
})(window);

