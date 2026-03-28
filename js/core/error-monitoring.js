(function initErrorMonitoring(windowRef, documentRef){
  if(!windowRef || !documentRef) return;
  if(windowRef.__errorMonitoringInstalled) return;
  windowRef.__errorMonitoringInstalled = true;

  const APP_ERROR_BUFFER_MAX = 50;
  let lastErrorSig = "";
  let lastErrorTs = 0;
  windowRef.__appErrors = windowRef.__appErrors || [];

  function formatErrorMessage(errLike){
    if(!errLike) return "Erreur inconnue";
    if(typeof errLike === "string") return errLike;
    if(errLike.message) return String(errLike.message);
    try{ return JSON.stringify(errLike); }catch(e){ return String(errLike); }
  }

  function showAppErrorBanner(message){
    const banner = documentRef.getElementById("appErrorBanner");
    const text = documentRef.getElementById("appErrorText");
    if(!banner || !text) return;
    text.textContent = message || "Une erreur technique est survenue.";
    banner.classList.remove("hidden");
  }

  function reportAppError(errLike, context){
    const safeContext = context || "runtime";
    const msg = formatErrorMessage(errLike);
    const sig = `${safeContext}|${msg}`;
    const now = Date.now();
    if(sig === lastErrorSig && (now - lastErrorTs) < 2000) return;
    lastErrorSig = sig;
    lastErrorTs = now;

    const item = { ts: new Date().toISOString(), context: safeContext, message: msg };
    windowRef.__appErrors.push(item);
    if(windowRef.__appErrors.length > APP_ERROR_BUFFER_MAX){
      windowRef.__appErrors.splice(0, windowRef.__appErrors.length - APP_ERROR_BUFFER_MAX);
    }

    console.error("[app-error]", safeContext, msg, errLike);
    showAppErrorBanner(`Une erreur est survenue (${safeContext}). ${msg}`);
  }

  function softCatch(errLike, context){
    const safeContext = context || "soft";
    try{
      const msg = formatErrorMessage(errLike);
      console.warn(`[soft-error] ${safeContext}: ${msg}`);
    }catch(_e){
      // no-op volontaire: ne jamais casser l'UI pour une remontee d'erreur
    }
  }

  function bindGlobalButtonClickFeedback(){
    const selector = "button, .btn, .tab, .help-btn, .login-log-sort, .cfg-accordion-head";
    documentRef.addEventListener("click", (e)=>{
      const btn = e.target?.closest?.(selector);
      if(!btn) return;
      if(btn.disabled || btn.classList.contains("is-disabled")) return;
      btn.classList.remove("btn-click-ack");
      void btn.offsetWidth;
      btn.classList.add("btn-click-ack");
      windowRef.setTimeout(()=> btn.classList.remove("btn-click-ack"), 170);
    }, true);
  }

  windowRef.reportAppError = reportAppError;
  windowRef.softCatch = softCatch;
  windowRef.bindGlobalButtonClickFeedback = bindGlobalButtonClickFeedback;

  windowRef.addEventListener("error", (ev)=>{
    const msg = String(ev?.message || "").trim();
    const src = String(ev?.filename || "").trim();
    if(msg === "Script error." && !ev?.error && !src){
      console.warn("[window.error] Script error cross-origin ignoree");
      return;
    }
    const details = ev?.error || `${msg}${src ? ` @ ${src}:${ev?.lineno||0}:${ev?.colno||0}` : ""}` || "Erreur JavaScript";
    reportAppError(details, "window.error");
  });

  windowRef.addEventListener("unhandledrejection", (ev)=>{
    reportAppError(ev?.reason || "Promesse rejetee", "promise");
  });

  documentRef.addEventListener("DOMContentLoaded", ()=>{
    documentRef.getElementById("appErrorClose")?.addEventListener("click", ()=> documentRef.getElementById("appErrorBanner")?.classList.add("hidden"));
    documentRef.getElementById("appErrorReload")?.addEventListener("click", ()=> windowRef.location.reload());
    bindGlobalButtonClickFeedback();
  });
})(window, document);

