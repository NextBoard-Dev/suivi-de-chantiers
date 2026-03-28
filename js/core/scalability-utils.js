(function initScalabilityUtils(windowRef){
  if(!windowRef) return;
  if(windowRef.__scalabilityUtilsInstalled) return;
  windowRef.__scalabilityUtilsInstalled = true;

  function normalizeComparableField(v){
    if(v === null || v === undefined) return "";
    if(typeof v === "number") return String(Math.round(v));
    return String(v).trim();
  }

  function computeMapDiffStats(localMap, remoteMap){
    const keys = new Set([...(localMap?.keys?.() || []), ...(remoteMap?.keys?.() || [])]);
    let onlyLocal = 0;
    let onlyRemote = 0;
    let valueDiff = 0;
    keys.forEach((k)=>{
      const l = localMap.get(k);
      const r = remoteMap.get(k);
      if(l === undefined){ onlyRemote += 1; return; }
      if(r === undefined){ onlyLocal += 1; return; }
      if(l !== r) valueDiff += 1;
    });
    return {
      onlyLocal,
      onlyRemote,
      valueDiff,
      total: onlyLocal + onlyRemote + valueDiff
    };
  }

  function estimateStateBytes(obj){
    try{
      const txt = JSON.stringify(obj || {});
      return new Blob([txt]).size;
    }catch(e){
      return 0;
    }
  }

  windowRef.normalizeComparableField = windowRef.normalizeComparableField || normalizeComparableField;
  windowRef.computeMapDiffStats = windowRef.computeMapDiffStats || computeMapDiffStats;
  windowRef.estimateStateBytes = windowRef.estimateStateBytes || estimateStateBytes;
})(window);

