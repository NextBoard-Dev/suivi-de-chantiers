(function initRoleUtils(windowRef){
  if(!windowRef) return;
  if(windowRef.__roleUtilsInstalled) return;
  windowRef.__roleUtilsInstalled = true;

  function roleLabel(roleKey){
    if(roleKey === "rsg") return "RSG";
    if(roleKey === "ri") return "RI";
    if(roleKey === "externe") return "EXTERNE";
    return "INTERNE";
  }

  function roleHoursMultiplier(){
    return 1;
  }

  windowRef.roleLabel = windowRef.roleLabel || roleLabel;
  windowRef.roleHoursMultiplier = windowRef.roleHoursMultiplier || roleHoursMultiplier;
})(window);

