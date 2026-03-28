(function initStatusUtils(windowRef){
  if(!windowRef) return;
  if(windowRef.__statusUtilsInstalled) return;
  windowRef.__statusUtilsInstalled = true;

  function normalizeStatusId(label){
    const base = (label || "").trim();
    if(!base) return "";
    const ascii = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return ascii.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function normalizeStatusList(list){
    const out = [];
    const seen = new Set();
    (list || []).forEach((item)=>{
      if(!item) return;
      const label = (item.label || item.name || "").toString().trim();
      if(!label) return;
      const vRaw = (item.v || "").toString().trim();
      const v = (vRaw ? vRaw : normalizeStatusId(label)).toUpperCase();
      if(!v) return;
      if(seen.has(v)) return;
      seen.add(v);
      out.push({v, label});
    });
    return out;
  }

  windowRef.normalizeStatusId = windowRef.normalizeStatusId || normalizeStatusId;
  windowRef.normalizeStatusList = windowRef.normalizeStatusList || normalizeStatusList;
})(window);

