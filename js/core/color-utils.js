(function initColorUtils(windowRef){
  if(!windowRef) return;
  if(windowRef.__colorUtilsInstalled) return;
  windowRef.__colorUtilsInstalled = true;

  function hexToRgba(hex, alpha){
    const v = (hex || "").replace("#","").trim();
    if(v.length !== 6) return `rgba(15,23,42,${alpha})`;
    const r = parseInt(v.slice(0,2),16);
    const g = parseInt(v.slice(2,4),16);
    const b = parseInt(v.slice(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  windowRef.hexToRgba = windowRef.hexToRgba || hexToRgba;
})(window);

