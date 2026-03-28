(function initStateSegmentation(windowRef){
  if(!windowRef) return;
  if(windowRef.__stateSegmentationInstalled) return;
  windowRef.__stateSegmentationInstalled = true;

  function safeClone(obj){
    try{ return JSON.parse(JSON.stringify(obj || {})); }catch(e){ return {}; }
  }

  function bytesOf(obj){
    try{ return (new TextEncoder()).encode(JSON.stringify(obj || {})).length; }catch(e){ return 0; }
  }

  function segmentStateForStorage(state){
    const src = safeClone(state || {});
    return {
      meta: {
        schemaVersion: 1,
        segmentedAt: new Date().toISOString()
      },
      projects: Array.isArray(src.projects) ? src.projects : [],
      tasks: Array.isArray(src.tasks) ? src.tasks : [],
      timeLogs: Array.isArray(src.timeLogs) ? src.timeLogs : [],
      orphanTimeLogs: Array.isArray(src.orphanTimeLogs) ? src.orphanTimeLogs : [],
      ui: {
        selectedProjectId: src.selectedProjectId || "",
        selectedTaskId: src.selectedTaskId || ""
      },
      refs: {
        internalTechs: Array.isArray(src.internalTechs) ? src.internalTechs : [],
        vendors: Array.isArray(src.vendors) ? src.vendors : []
      }
    };
  }

  function composeStateFromSegments(segments, fallbackState){
    const base = safeClone(fallbackState || {});
    const seg = safeClone(segments || {});
    base.projects = Array.isArray(seg.projects) ? seg.projects : (Array.isArray(base.projects) ? base.projects : []);
    base.tasks = Array.isArray(seg.tasks) ? seg.tasks : (Array.isArray(base.tasks) ? base.tasks : []);
    base.timeLogs = Array.isArray(seg.timeLogs) ? seg.timeLogs : (Array.isArray(base.timeLogs) ? base.timeLogs : []);
    base.orphanTimeLogs = Array.isArray(seg.orphanTimeLogs) ? seg.orphanTimeLogs : (Array.isArray(base.orphanTimeLogs) ? base.orphanTimeLogs : []);
    base.selectedProjectId = seg?.ui?.selectedProjectId || base.selectedProjectId || "";
    base.selectedTaskId = seg?.ui?.selectedTaskId || base.selectedTaskId || "";
    return base;
  }

  function estimateSegmentSizes(state){
    const segments = segmentStateForStorage(state);
    return {
      totalBytes: bytesOf(state || {}),
      segmentsBytes: {
        meta: bytesOf(segments.meta),
        projects: bytesOf(segments.projects),
        tasks: bytesOf(segments.tasks),
        timeLogs: bytesOf(segments.timeLogs),
        orphanTimeLogs: bytesOf(segments.orphanTimeLogs),
        ui: bytesOf(segments.ui),
        refs: bytesOf(segments.refs)
      }
    };
  }

  windowRef.segmentStateForStorage = windowRef.segmentStateForStorage || segmentStateForStorage;
  windowRef.composeStateFromSegments = windowRef.composeStateFromSegments || composeStateFromSegments;
  windowRef.estimateSegmentSizes = windowRef.estimateSegmentSizes || estimateSegmentSizes;
})(window);

