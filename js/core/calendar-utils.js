(function initCalendarUtils(windowRef){
  if(!windowRef) return;
  if(windowRef.__calendarUtilsInstalled) return;
  windowRef.__calendarUtilsInstalled = true;

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
    const s = new Date(start+"T00:00:00");
    const e = new Date(end+"T00:00:00");
    if(isNaN(s) || isNaN(e) || e < s) return "";
    const days = countWeekdays(s, e);
    return days > 0 ? days : "";
  }

  function isTaskActiveOn(task, dateKey){
    if(!task || !task.start || !task.end || !dateKey) return false;
    return task.start <= dateKey && task.end >= dateKey;
  }

  function startOfWeek(d){
    const x = new Date(d.getTime());
    const day = (x.getDay()+6)%7; // lundi=0
    x.setDate(x.getDate()-day);
    x.setHours(0,0,0,0);
    return x;
  }

  function endOfWeek(d){
    const x = startOfWeek(d);
    x.setDate(x.getDate()+6);
    x.setHours(23,59,59,999);
    return x;
  }

  function isTodayInWeek(weekStart){
    const today = new Date();
    const s = startOfWeek(today);
    return +s === +weekStart;
  }

  windowRef.isWeekday = windowRef.isWeekday || isWeekday;
  windowRef.countWeekdays = windowRef.countWeekdays || countWeekdays;
  windowRef.durationDays = windowRef.durationDays || durationDays;
  windowRef.isTaskActiveOn = windowRef.isTaskActiveOn || isTaskActiveOn;
  windowRef.startOfWeek = windowRef.startOfWeek || startOfWeek;
  windowRef.endOfWeek = windowRef.endOfWeek || endOfWeek;
  windowRef.isTodayInWeek = windowRef.isTodayInWeek || isTodayInWeek;
})(window);
