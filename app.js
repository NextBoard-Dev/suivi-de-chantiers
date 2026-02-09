// SUiVI DE CHANTIERS - état embarqu forc (pas de localStorage)

// Projet : Rénovation Bureau Pastorale + 1 tâche date



const el = (id)=>document.getElementById(id);

const STORAGE_KEY = "suivi_chantiers_state_v1";



/* =========================================================

   SUPABASE GREFFE MINIMALE (NE TOUCHE PAS A L'UI)

   - Pas de module

   - Pas de refactor

   - Supabase est appele APRES saveState()

   - Chargement Supabase APRES premier rendu UI

   Fonctions autorisees (globals) :

     window.supabaseLogin(email, password)

     window.saveAppStateToSupabase(state)

     window.loadAppStateFromSupabase()

========================================================= */



// ---- CONFIG (TES VALEURS) ----

const SUPABASE_URL  = "https://uioqchhbakcvemknqikh.supabase.co";

const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpb3FjaGhiYWtjdmVta25xaWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NjA4MTUsImV4cCI6MjA4NTMzNjgxNX0.W345e_uwKLGaFcP9KAZq0kNECBUSFluh2ErgHaHeO5w";

const SUPABASE_TABLE = "app_states";
const SUPABASE_USERS_TABLE = "dashboard_users";


// Auto-login (pour ne PAS utiliser la console)

const SUPABASE_AUTO_EMAIL = "sebastien_duc@outlook.fr";

const SUPABASE_AUTO_PASSWORD = "Mililum@tt45";



// ---- client ----

let _sb = null;

function _getSupabaseClient(){

  try{

    if(_sb) return _sb;

    if(!window.supabase || !window.supabase.createClient){

      console.warn("Supabase CDN non charge");

      return null;

    }

    _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    return _sb;

  }catch(e){

    console.warn("Supabase init failed", e);

    return null;

  }

}



// ---- helper : session ----

async function _ensureSession(){

  const sb = _getSupabaseClient();

  if(!sb) return null;



  try{

    const s = await sb.auth.getSession();

    if(s && s.data && s.data.session) return s.data.session;



    // pas de session -> auto login (si creds presentes)

    if(SUPABASE_AUTO_EMAIL && SUPABASE_AUTO_PASSWORD){

      const res = await sb.auth.signInWithPassword({

        email: SUPABASE_AUTO_EMAIL,

        password: SUPABASE_AUTO_PASSWORD

      });

      if(res && res.data && res.data.session) return res.data.session;

    }

  }catch(e){

    console.warn("Supabase session failed", e);

  }

  return null;

}



/* ===============================

   API GLOBALE AUTORISEE

================================ */

window.supabaseLogin = async function(email, password){

  const sb = _getSupabaseClient();

  if(!sb) return false;

  try{

    const res = await sb.auth.signInWithPassword({ email, password });

    return !!(res && res.data && res.data.session);

  }catch(e){

    console.warn("supabaseLogin failed", e);

    return false;

  }

};



window.saveAppStateToSupabase = async function(stateObj){
  const sb = _getSupabaseClient();
  if(!sb) return false;


  const session = await _ensureSession();

  if(!session || !session.user) return false;



  try{

    const payload = {

      user_id: session.user.id,

      state_json: stateObj,

      updated_at: new Date().toISOString()

    };

    const { error } = await sb.from(SUPABASE_TABLE).upsert(payload, { onConflict: "user_id" });

    if(error){ console.warn("Supabase upsert error", error); return false; }

    return true;

  }catch(e){

    console.warn("saveAppStateToSupabase failed", e);

    return false;

  }

};

// ---- users (simple, sans RLS) ----
async function saveUsersToSupabase(users){
  const sb = _getSupabaseClient();
  if(!sb) return false;
  const session = await _ensureSession();
  if(!session || !session.user) return false;
  try{
    const payload = {
      user_id: session.user.id,
      users_json: users,
      updated_at: new Date().toISOString()
    };
    const { error } = await sb.from(SUPABASE_USERS_TABLE).upsert(payload, { onConflict: "user_id" });
    if(error){ console.warn("Supabase users upsert error", error); return false; }
    return true;
  }catch(e){
    console.warn("saveUsersToSupabase failed", e);
    return false;
  }
}

// expose for login overlay (index.html)
window.saveUsersToSupabase = saveUsersToSupabase;

async function loadUsersFromSupabase(force=false){
  const sb = _getSupabaseClient();
  if(!sb) return false;
  const session = await _ensureSession();
  if(!session || !session.user) return false;
  try{
    if(!force){
      const localUsers = loadUsers();
      if(localUsers && localUsers.length > 0){
        return false;
      }
    }
    const { data, error } = await sb
      .from(SUPABASE_USERS_TABLE)
      .select("users_json, updated_at")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if(error){ console.warn("Supabase users select error", error); return false; }
    if(!data || !data.users_json) return false;
    saveUsers(data.users_json);
    if(typeof window.populateLoginUsers === "function") window.populateLoginUsers();
    return true;
  }catch(e){
    console.warn("loadUsersFromSupabase failed", e);
    return false;
  }
}
window.forceLoadUsersFromSupabase = async function(){
  try{
    return await loadUsersFromSupabase(true);
  }catch(e){
    return false;
  }
};


window.loadAppStateFromSupabase = async function(){

  const sb = _getSupabaseClient();

  if(!sb) return false;



  const session = await _ensureSession();

  if(!session || !session.user) return false;



  try{

    const { data, error } = await sb

      .from(SUPABASE_TABLE)

      .select("state_json, updated_at")

      .eq("user_id", session.user.id)

      .maybeSingle();



    if(error){ console.warn("Supabase select error", error); return false; }

    if(!data || !data.state_json) return false;



    // IMPORTANT : on remplace UNIQUEMENT l'eétat global, puis on rend

    state = normalizeState(data.state_json);

    renderAll();

    clearDirty();

    return true;

  }catch(e){

    console.warn("loadAppStateFromSupabase failed", e);

    return false;

  }

};



// ---- auto-load apres 1er rendu UI ----

let _supabaseAutoloadScheduled = false;
function _scheduleSupabaseAutoLoad(){
  if(_supabaseAutoloadScheduled) return;
  _supabaseAutoloadScheduled = true;

  // pas d'await au chargement initial : on laisse l'UI se rendre d'abord
  setTimeout(function(){
    try{
      window.loadAppStateFromSupabase();
      loadUsersFromSupabase();
    }catch(e){}
  }, 120);
}


const uid = ()=> Math.random().toString(16).slice(2,10) + Date.now().toString(16);

const normId = (v)=> (v===undefined || v===null) ? "" : String(v).trim();



let state = null;

let selectedProjectId = null;

let selectedTaskId = null;

let taskOrderMap = {};

let selectedStatusSet = new Set();

let sortMaster = {key:"start", dir:"asc"};

let sortProject = {key:"start", dir:"asc"};

let unsavedChanges = false;

let isLocked = true; // verrou lecture seule par défaut

let workloadRangeType = "all"; // all | custom | school | civil

let workloadRangeStart = "";

let workloadRangeEnd = "";

let workloadRangeYear = "";

let workloadRangeTypeProject = "all";
let workloadRangeStartProject = "";
let workloadRangeEndProject = "";
let workloadRangeYearProject = "";
const CONFIG_KEY = "dashboard_config_v1";
const USERS_KEY = "dashboard_users_v1";
let ganttColVisibility = {

  masterVendor: true,

  masterStatus: true,

  projectVendor: true,

  projectStatus: true

};



const STATUSES = [

  {v:"CHANTIER_COMPLET", label:"Chantier complet"},

  {v:"ELECTRICITE", label:"Électricité"},

  {v:"PEINTURE", label:"Peinture"},

  {v:"SOL", label:"Sol"},

  {v:"PLACO", label:"Placo / cloisons"},

  {v:"FAUX_PLAFOND", label:"Faux plafond"},

  {v:"AMENAGEMENTS", label:"Aménagements"},

  {v:"MOBILIER", label:"Mobilier"},

  {v:"PLOMBERIE", label:"Plomberie"},

  {v:"PREPARATION", label:"Préparation"},

  {v:"TDV",          label:"TDV"},

  {v:"MACONNERIE",   label:"Maçonnerie"},

  {v:"HUIS_SER",     label:"Huisseries"},

  {v:"RESEAUX",      label:"Réseaux"},

  {v:"TOITURE",      label:"Toiture / étanchéité"},

  {v:"ETUDE",        label:"Étude"},

];

const sortedStatuses = ()=> [...STATUSES].sort((a,b)=> a.label.localeCompare(b.label,"fr",{sensitivity:"base"}));



const STATUS_COLORS = {

  CHANTIER_COMPLET: "#1e3a8a",

  ELECTRICITE:      "#d97706",

  PEINTURE:         "#2563eb",

  SOL:              "#0f766e",

  PLACO:            "#7c3aed",

  FAUX_PLAFOND:     "#b45309",

  AMENAGEMENTS:     "#db2777",

  MOBILIER:         "#9333ea",

  PLOMBERIE:        "#15803d",

  PREPARATION:      "#16a34a",

  TDV:              "#f97316",

  MACONNERIE:       "#a16207",

  HUIS_SER:         "#6b7280",

  RESEAUX:          "#0ea5b0",

  TOITURE:          "#0d9488",

  ETUDE:            "#0284c7",

};

const THEMES = [
  { id:"sable", label:"Sable doux", swatch:["#f2e8d5","#d2b48c"] },
  { id:"ardoise", label:"Ardoise", swatch:["#94a3b8","#475569"] },
  { id:"clair", label:"Clair neutre", swatch:["#f8fafc","#e2e8f0"] },
  { id:"industriel", label:"Industriel sombre", swatch:["#6b7280","#111827"] },
  { id:"chantier", label:"Chantier orange", swatch:["#f59e0b","#b45309"] },
  { id:"nuit", label:"Bleu nuit", swatch:["#0ea5e9","#1e3a8a"] },
  { id:"carbone", label:"Carbone contrasté", swatch:["#1f2937","#0f172a"] },
  { id:"noir_or", label:"Noir & Or", swatch:["#111111","#f59e0b"] },
  { id:"noir", label:"Noir absolu", swatch:["#0b0b0b","#f8fafc"] },
  { id:"gris", label:"Gris profond", swatch:["#374151","#111827"] },
  { id:"marine", label:"Bleu marine", swatch:["#0f172a","#2563eb"] },
  { id:"orange_brule", label:"Orange brûlé", swatch:["#9a3412","#f97316"] },
  { id:"petrole", label:"Vert pétrole", swatch:["#0f766e","#14b8a6"] },
  { id:"obsidienne", label:"Obsidienne", swatch:["#0a0a0a","#1f2937"] },
  { id:"acier_bleu", label:"Acier bleu", swatch:["#0b1b2b","#1e3a8a"] },
  { id:"vert_nuit", label:"Vert nuit", swatch:["#0b1f18","#14532d"] }
];



const statusColor = (v)=> STATUS_COLORS[(v||"").toUpperCase()] || "#1f2937";

const statusDot = (v)=> `<span class="icon-dot" style="background:${statusColor(v)};border-color:${statusColor(v)}"></span>`;

const parseStatuses = (s)=> (s||"").split(",").map(x=>x.trim()).filter(Boolean);

const deepClone = (obj)=> JSON.parse(JSON.stringify(obj));

const siteColor = (_site="")=>"transparent";

const attrEscape = (s="")=> s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

function updateTopbarHeight(){

  const tb = document.querySelector(".topbar");

  if(!tb) return;

  document.documentElement.style.setProperty("--topbar-h", `${tb.offsetHeight}px`);

}

function updateSidebarTop(){
  const tb = document.querySelector(".topbar");
  if(!tb) return;
  const top = Math.max(0, tb.offsetHeight + 14);
  window.__sidebarTopLocked = top;
  document.documentElement.style.setProperty("--sidebar-top", `${top}px`);
}
function updateSidebarScrollState(){
  const sb = document.querySelector(".sidebar");
  if(!sb) return;
  // Sidebar ne doit plus scroller : seul le bloc Onglets scrolle
  sb.classList.remove("sidebar-scroll");
}

// verrouille la position de la sidebar une fois la mise en page stabilise
function _lockSidebarAfterLayout(){
  updateSidebarTop();
  updateSidebarScrollState();
  applySidebarTopLock();
}
window.addEventListener("load", _lockSidebarAfterLayout);
function applySidebarTopLock(){
  if(typeof window.__sidebarTopLocked !== "number") return;
  document.documentElement.style.setProperty("--sidebar-top", `${window.__sidebarTopLocked}px`);
}

function updateTaskDatesWarning(){

  const warn = el("t_dates_warn");

  const start = el("t_start")?.value;

  const end = el("t_end")?.value;

  if(!warn) return;

  if(start && end && end < start){

    warn.classList.remove("hidden");

  }else{

    warn.classList.add("hidden");

  }

}

function formatShortDate(d){

  const dd = String(d.getDate()).padStart(2,"0");

  const mm = String(d.getMonth()+1).padStart(2,"0");

  const yy = String(d.getFullYear()).slice(-2);

  return `${dd}-${mm}-${yy}`;

}

function isTodayInWeek(weekStart){

  const today = new Date();

  const s = startOfWeek(today);

  return +s === +weekStart;

}

function setToggleBtnState(id, isOn){

  const b = el(id);

  if(!b) return;

  b.classList.toggle("btn-primary", !!isOn);

  b.classList.toggle("btn-ghost", !isOn);

}

function applyGanttColumnVisibility(){

  const masterTable = document.querySelector("#masterGantt table");

  if(masterTable){

    masterTable.classList.toggle("hide-vendor", !ganttColVisibility.masterVendor);

    masterTable.classList.toggle("hide-status", !ganttColVisibility.masterStatus);

  }

  const projectTable = document.querySelector("#gantt table");

  if(projectTable){

    projectTable.classList.toggle("hide-vendor", !ganttColVisibility.projectVendor);

    projectTable.classList.toggle("hide-status", !ganttColVisibility.projectStatus);

  }

  setToggleBtnState("btnToggleMasterVendor", ganttColVisibility.masterVendor);

  setToggleBtnState("btnToggleMasterStatus", ganttColVisibility.masterStatus);

  setToggleBtnState("btnToggleProjectVendor", ganttColVisibility.projectVendor);

  setToggleBtnState("btnToggleProjectStatus", ganttColVisibility.projectStatus);

}

function openTaskFromGantt(taskId){
  const task = state.tasks.find(x=>x.id===taskId);
  if(!task) return;
  selectedTaskId = taskId;
  navigateTo(task.projectId, taskId, true);
}
function closeAllOverlays(){
  try{ showVendorDropdown(false); }catch(e){}
  try{ showDescriptionDropdown(false); }catch(e){}
  try{ toggleStatusMenu(false); }catch(e){}
  const vBox = el("vendorDropdown");
  if(vBox){ vBox.style.display="none"; vBox.classList.remove("open"); }
  const dBox = el("descDropdown");
  if(dBox){ dBox.style.display="none"; dBox.classList.remove("open"); }
  const vPanel = el("vendorManagerPanel");
  if(vPanel) vPanel.style.display="none";
  const dPanel = el("descManagerPanel");
  if(dPanel) dPanel.style.display="none";
  const statusMenu = el("t_status_menu");
  if(statusMenu) statusMenu.classList.add("hidden");
  const overlay = el("descOverlay");
  if(overlay) overlay.classList.remove("show");
  document.querySelectorAll(".vendor-open").forEach(n=>n.classList.remove("vendor-open"));
  document.querySelectorAll(".desc-open").forEach(n=>n.classList.remove("desc-open"));
  document.querySelectorAll(".desc-panel-open").forEach(n=>n.classList.remove("desc-panel-open"));
  floatingMap.forEach((anchor, el)=>{ closeFloating(el); });
}
function loadConfig(){
  try{
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){
    return {};
  }
}
function saveConfig(cfg){
  try{
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg||{}));
  }catch(e){}
}
function loadUsers(){
  try{
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    return [];
  }
}
function saveUsers(list){
  try{
    localStorage.setItem(USERS_KEY, JSON.stringify(list||[]));
    try{
      if(typeof window.populateLoginUsers === "function") window.populateLoginUsers();
    }catch(e){}
    try{ saveUsersToSupabase(list||[]); }catch(e){}
  }catch(e){}
}

function getCurrentUserName(){
  return sessionStorage.getItem("current_user") || "";
}
function getCurrentUserRecord(){
  const name = getCurrentUserName();
  if(!name) return null;
  const users = loadUsers();
  return users.find(u=>u.name===name) || null;
}
function applyTheme(themeId){
  const id = themeId || "sable";
  document.documentElement.setAttribute("data-theme", id);
  const grid = el("themeGrid");
  if(grid){
    grid.querySelectorAll(".theme-swatch").forEach(n=>{
      n.classList.toggle("active", n.dataset.theme===id);
    });
  }
}
function applyThemeForCurrentUser(){
  const u = getCurrentUserRecord();
  const theme = (u && u.theme) ? u.theme : "sable";
  applyTheme(theme);
}
function setCurrentUserTheme(themeId){
  const name = getCurrentUserName();
  if(!name){
    applyTheme(themeId);
    return;
  }
  const users = loadUsers();
  const idx = users.findIndex(u=>u.name===name);
  if(idx>=0){
    users[idx].theme = themeId;
    saveUsers(users);
  }
  applyTheme(themeId);
}
function initThemePicker(){
  const grid = el("themeGrid");
  const picker = el("themePicker");
  const toggle = el("themeToggle");
  if(!grid || !picker || !toggle) return;
  grid.innerHTML = THEMES.map(t=>{
    const colors = t.swatch || ["#e2e8f0","#94a3b8"];
    const style = `background:linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%);`;
    return `<button type="button" class="theme-swatch" data-theme="${t.id}" title="${t.label}" style="${style}"></button>`;
  }).join("");
  grid.querySelectorAll(".theme-swatch").forEach(btn=>{
    btn.addEventListener("click", ()=> setCurrentUserTheme(btn.dataset.theme || "sable"));
  });
  toggle.addEventListener("click", (e)=>{
    e.stopPropagation();
    picker.classList.toggle("open");
  });
  document.addEventListener("click", (e)=>{
    if(!picker.classList.contains("open")) return;
    if(picker.contains(e.target)) return;
    picker.classList.remove("open");
  });
  applyThemeForCurrentUser();
}
function getCurrentRole(){
  return sessionStorage.getItem("current_role") || "admin";
}
function updateRoleUI(){
  const role = getCurrentRole();
  const cfgBtn = el("btnConfig");
  if(cfgBtn) cfgBtn.style.display = (!isLocked && role==="admin") ? "inline-flex" : "none";
  const gear = el("gear-btn");
  const gearWrap = gear ? gear.closest(".gear-wrap") : null;
  if(gearWrap) gearWrap.style.display = role==="admin" ? "flex" : "none";
  const topUser = el("topbarUser");
  if(topUser){
    const name = sessionStorage.getItem("current_user") || "Invit";
    const roleLabel = role==="admin" ? "Admin" : "Utilisateur";
    topUser.textContent = `Utilisateur connecté: ${name} - ${roleLabel}`;
  }
  applyThemeForCurrentUser();
}
async function hashPassword(str){
  const enc = new TextEncoder().encode(str || "");
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function renderUsersList(){
  const list = el("cfg_users_list");
  if(!list) return;
  const users = loadUsers();
  if(users.length===0){
    list.innerHTML = `<div class="config-user-meta">Aucun utilisateur</div>`;
    return;
  }
  list.innerHTML = users.map(u=>`
    <div class="config-user-item">
      <div>
        <div><strong>${attrEscape(u.name||"")}</strong></div>
        <div class="config-user-meta">${attrEscape(u.email||"") || ""}  ${u.role==="admin" ? "Admin" : "Utilisateur"}</div>
      </div>
      <div class="config-user-actions">
        <button class="btn btn-ghost cfg-user-edit" data-user="${attrEscape(u.name)}">Modifier</button>
        <button class="btn btn-ghost cfg-user-pass" data-user="${attrEscape(u.name)}">Changer mdp</button>
        <button class="btn btn-danger cfg-user-del" data-user="${attrEscape(u.name)}">Supprimer</button>
      </div>
    </div>
  `).join("");
  list.querySelectorAll(".cfg-user-pass").forEach(btn=>{
    btn.onclick = async ()=>{
      const name = btn.dataset.user;
      const next = prompt(`Nouveau mot de passe pour ${name} :`);
      if(!next) return;
      const users = loadUsers();
      const h = await hashPassword(next);
      users.forEach(u=>{ if(u.name===name) u.hash = h; });
      saveUsers(users);
      renderUsersList();
    };
  });
  list.querySelectorAll(".cfg-user-edit").forEach(btn=>{
    btn.onclick = ()=>{
      const name = btn.dataset.user;
      const users = loadUsers();
      const idx = users.findIndex(u=>u.name===name);
      if(idx<0) return;
      const newName = prompt("Nom d'utilisateur :", users[idx].name) || "";
      if(!newName) return;
      const newEmail = prompt("Email :", users[idx].email||"") || "";
      const newRole = (prompt("Rle (admin/user) :", users[idx].role||"user") || users[idx].role || "user").toLowerCase();
      const role = newRole === "admin" ? "admin" : "user";
      if(users.some((u,i)=> i!==idx && u.name.toLowerCase()===newName.toLowerCase())){
        alert("Nom dj utilis."); return;
      }
      if(newEmail && users.some((u,i)=> i!==idx && (u.email||"").toLowerCase()===newEmail.toLowerCase())){
        alert("Email dj utilis."); return;
      }
      users[idx].name = newName;
      users[idx].email = newEmail;
      users[idx].role = role;
      saveUsers(users);
      const current = sessionStorage.getItem("current_user") || "";
      if(current && current === name){
        sessionStorage.setItem("current_user", newName);
        sessionStorage.setItem("current_role", role);
        updateRoleUI();
      }
      renderUsersList();
    };
  });
  list.querySelectorAll(".cfg-user-del").forEach(btn=>{
    btn.onclick = ()=>{
      const name = btn.dataset.user;
      if(!confirm(`Supprimer ${name} ?`)) return;
      let users = loadUsers();
      const admins = users.filter(u=>u.role==="admin");
      if(admins.length<=1 && admins.some(u=>u.name===name)){
        alert("Impossible de supprimer le dernier admin.");
        return;
      }
      users = users.filter(u=>u.name!==name);
      saveUsers(users);
      renderUsersList();
    };
  });
}
function openConfigModal(){
  const modal = el("configModal");
  if(!modal) return;
  const cfg = loadConfig();
  el("cfg_name").value = cfg.name || "";
  el("cfg_http").value = cfg.http || "";
  el("cfg_front").value = cfg.front || "";
  el("cfg_back").value = cfg.back || "";
  const role = getCurrentRole();
  const usersSection = el("cfg_users_section");
  if(usersSection) usersSection.style.display = role==="admin" ? "block" : "none";
  if(role==="admin") renderUsersList();
  modal.classList.remove("hidden");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden","false");
}
function closeConfigModal(){
  const modal = el("configModal");
  if(!modal) return;
  modal.classList.add("hidden");
  modal.style.display = "none";
  modal.setAttribute("aria-hidden","true");
}
function navigateTo(projectId=null, taskId=null, push=true){
  selectedProjectId = projectId || null;
  selectedTaskId = taskId || null;
  if(push){
    try{
      history.pushState({projectId:selectedProjectId, taskId:selectedTaskId}, "");
    }catch(e){}
  }
  closeAllOverlays();
  setTimeout(()=> closeAllOverlays(), 0);
  renderAll();
}
function selectTaskInProject(taskId){
  selectedTaskId = taskId || null;
  renderProject();
}
const FLOAT_Z = 1000000;

const floatingMap = new Map();

function positionFloating(el, anchor){

  if(!el || !anchor) return;

  const rect = anchor.getBoundingClientRect();

  const top = rect.bottom + 4;

  const maxH = Math.max(120, window.innerHeight - top - 12);

  el.style.position = "fixed";

  el.style.left = `${rect.left}px`;

  el.style.top = `${top}px`;

  el.style.width = `${rect.width}px`;

  el.style.maxHeight = `${maxH}px`;

  el.style.zIndex = `${FLOAT_Z}`;

}

function openFloating(el, anchor){

  if(!el || !anchor) return;

  if(!el.__floatParent){

    el.__floatParent = el.parentElement;

    el.__floatNext = el.nextSibling;

  }

  document.body.appendChild(el);

  positionFloating(el, anchor);

  floatingMap.set(el, anchor);

}

function closeFloating(el){

  if(!el || !el.__floatParent) return;

  floatingMap.delete(el);

  el.style.position = "";

  el.style.left = "";

  el.style.top = "";

  el.style.width = "";

  el.style.maxHeight = "";

  el.style.zIndex = "";

  if(el.__floatNext) el.__floatParent.insertBefore(el, el.__floatNext);

  else el.__floatParent.appendChild(el);

}

let vendorsCache = [];

let descCache = [];

const VENDOR_STORE_KEY = "vendors_registry";

const VENDOR_DELETE_KEY = "vendors_deleted";

const DESC_STORE_KEY = "descriptions_registry";

const DESC_DELETE_KEY = "descriptions_deleted";

const normalizeVendor = (v="")=> v.trim();

const normalizeDesc = (v="")=> v.trim();

const dedupVendors = (arr=[])=>{

  const seen=new Set();

  const out=[];

  arr.forEach(v=>{

    const norm = normalizeVendor(v);

    if(!norm) return;

    const key = norm.toLowerCase();

    if(seen.has(key)) return;

    seen.add(key);

    out.push(norm);

  });

  return out;

};

const dedupDescriptions = (arr=[])=>{

  const seen=new Set();

  const out=[];

  arr.forEach(v=>{

    const norm = normalizeDesc(v);

    if(!norm) return;

    const key = norm.toLowerCase();

    if(seen.has(key)) return;

    seen.add(key);

    out.push(norm);

  });

  return out;

};

const ownerType = (o="")=>{

  const k=o.toLowerCase();

  if(k.includes("rsg/ri") || k.includes("rsg") || k.includes("ri")) return "rsgri";

  const hasInt = k.includes("interne");

  const hasExt = k.includes("externe");

  // Plus de catgorie "mixte" : on priorise "interne" si exclusif, sinon "externe".

  if(hasInt && !hasExt) return "interne";

  if(hasExt) return "externe";

  return "inconnu";

};

const ownerBadge = (o="")=>{

  const k = o.toLowerCase();

  // Palette aligne avec le graphique de charge

  let color = "#16a34a"; // interne par défaut

  if(k.includes("rsg/ri") || k.includes("rsg") || k.includes("ri")) color = "#2563eb"; // RSG/RI
  if(k.includes("interne") && k.includes("externe")) color = "#b45309"; // mix -> externe

  else if(k.includes("externe")) color = "#b45309"; // prestataire externe

  else if(k.includes("interne")) color = "#16a34a"; // Équipe interne

  return `<span class="badge owner" style="background:${color};border-color:${color};color:#fff;">${o}</span>`;

};

const SITE_PHOTOS = {
  "CDM": "assets/sites/CDM.jpg",
  "LGT": "assets/sites/LGT.jpg",
  "COLLÈGE": "assets/sites/College.jpg",
  "COLLEGE": "assets/sites/College.jpg",
  "ÉCOLE": "assets/sites/Ecole.jpg",
  "ECOLE": "assets/sites/Ecole.jpg",
  "NDC": "assets/sites/NDC.jpg"
};

function updateSitePhoto(site){
  const img = el("sitePhoto");
  const empty = el("sitePhotoEmpty");
  if(!img || !empty) return;
  const key = (site||"").trim().toUpperCase();
  const src = SITE_PHOTOS[key];
  if(!src){
    img.src = "";
    img.style.display = "none";
    empty.style.display = "block";
    return;
  }
  img.onerror = () => {
    img.style.display = "none";
    empty.style.display = "block";
  };
  img.onload = () => {
    img.style.display = "block";
    empty.style.display = "none";
  };
  img.src = src;
}
const ownerColor = (o="")=>{
  const typ = ownerType(o);
  if(typ === "interne") return "#16a34a";
  if(typ === "externe") return "#b45309";
  if(typ === "rsgri") return "#2563eb";
  return "#4b5563";
};



const vendorBadge = (v="")=>{

  const k = v.toLowerCase();

  if(k.includes("rsg/ri") || k.includes("rsg") || k.includes("ri")){
    return `<span class="badge owner" style="background:#2563eb;border-color:#2563eb;color:#fff;">${v}</span>`;
  }

  const isInternal = k.includes("interne");

  const color = isInternal ? "#16a34a" : "#4b5563";

  return `<span class="badge owner" style="background:${color};border-color:${color};color:#fff;">${v}</span>`;

};



function refreshVendorsList(){

  const input = el("t_vendor");

  if(!input) return;

  const registry = loadVendorsRegistry();

  const deleted = new Set(loadDeletedVendors().map(x=>x.toLowerCase()));

  const fromTasks = (state?.tasks||[])

    .map(t=> normalizeVendor(t.vendor||""))

    .filter(Boolean)

    .filter(v=> !deleted.has(v.toLowerCase()));

  vendorsCache = dedupVendors([...registry, ...fromTasks])

    .filter(v=> !deleted.has(v.toLowerCase()))

    .sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));

  const current = normalizeVendor(input.value);

  if(current && !vendorsCache.map(x=>x.toLowerCase()).includes(current.toLowerCase())){

    vendorsCache.unshift(current);

  }

  saveVendorsRegistry(vendorsCache);

  renderVendorDropdown(current);

}



function refreshDescriptionsList(){

  const input = el("t_room");

  if(!input) return;

  const registry = loadDescriptionsRegistry();

  const deleted = new Set(loadDeletedDescriptions().map(x=>x.toLowerCase()));

  const fromTasks = (state?.tasks||[])

    .map(t=> normalizeDesc(t.roomNumber||""))

    .filter(Boolean)

    .filter(v=> !deleted.has(v.toLowerCase()));

  descCache = dedupDescriptions([...registry, ...fromTasks])

    .filter(v=> !deleted.has(v.toLowerCase()))

    .sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));

  const current = normalizeDesc(input.value);

  if(current && !descCache.map(x=>x.toLowerCase()).includes(current.toLowerCase())){

    descCache.unshift(current);

  }

  saveDescriptionsRegistry(descCache);

  renderDescriptionDropdown(current);

}



function setupVendorPicker(){

  const input = el("t_vendor");

  const manageBtn = el("btnManageVendors");

  const panel = el("vendorManagerPanel");

  const wrap = input ? input.closest(".vendor-wrap") : null;

  const card = input ? input.closest(".card") : null;

  const setManagerOpen = (open)=>{

    if(panel) panel.style.display = open ? "block" : "none";

    wrap?.classList.toggle("vendor-open", !!open);

    card?.classList.toggle("vendor-panel-open", !!open);

    if(open && input && panel) openFloating(panel, input);

    else closeFloating(panel);

  };

  if(!input) return;

  const openList = ()=>{

    renderVendorDropdown(input.value);

    showVendorDropdown(true);

  };

  input.addEventListener("click", openList);

  input.addEventListener("focus", openList);

  input.addEventListener("keydown",(e)=>{

    if(e.key==="ArrowDown" || e.key==="F4"){

      e.preventDefault();

      openList();

    }else if(e.key==="Escape"){

      showVendorDropdown(false);

    }

  });

  input.addEventListener("input", ()=>{

    renderVendorDropdown(input.value);

    showVendorDropdown(true);

  });

  document.addEventListener("click",(e)=>{

    const box = el("vendorDropdown");

    if(!box || !input) return;

    if(!box.contains(e.target) && e.target!==input){ showVendorDropdown(false); }

    if(panel && !panel.contains(e.target) && e.target!==manageBtn){ setManagerOpen(false); }

  });

  const box = el("vendorDropdown");

  if(box){

    box.addEventListener("mousedown",(e)=>e.preventDefault()); // empcher blur avant le click

  }

  if(manageBtn){

    manageBtn.disabled = isLocked;

    manageBtn.onclick=(e)=>{

      e.stopPropagation();

      if(isLocked) return;

      const visible = panel?.style.display==="block";

      if(visible){

        setManagerOpen(false);

      }else{

        renderVendorManager();

        setManagerOpen(true);

        showVendorDropdown(false);

      }

    };

  }

}



function setupDescriptionPicker(){

  const input = el("t_room");

  const manageBtn = el("btnManageDescriptions");

  const panel = el("descManagerPanel");

  const wrap = input ? input.closest(".desc-wrap") : null;

  const card = input ? input.closest(".card") : null;

  const setManagerOpen = (open)=>{

    if(panel) panel.style.display = open ? "block" : "none";

    wrap?.classList.toggle("desc-open", !!open);

    card?.classList.toggle("desc-panel-open", !!open);

    if(open && input && panel) openFloating(panel, input);

    else closeFloating(panel);

  };

  if(!input) return;

  const openList = ()=>{

    renderDescriptionDropdown(input.value);

    showDescriptionDropdown(true);

  };

  input.addEventListener("click", openList);

  input.addEventListener("focus", openList);

  input.addEventListener("keydown",(e)=>{

    if(e.key==="ArrowDown" || e.key==="F4"){

      e.preventDefault();

      openList();

    }else if(e.key==="Escape"){

      showDescriptionDropdown(false);

    }

  });

  input.addEventListener("input", ()=>{

    renderDescriptionDropdown(input.value);

    showDescriptionDropdown(true);

  });

  document.addEventListener("click",(e)=>{

    const box = el("descDropdown");

    if(!box || !input) return;

    if(!box.contains(e.target) && e.target!==input){ showDescriptionDropdown(false); }

    if(panel && !panel.contains(e.target) && e.target!==manageBtn){ setManagerOpen(false); }

  });

  const box = el("descDropdown");

  if(box){

    box.addEventListener("mousedown",(e)=>e.preventDefault()); // empcher blur avant le click

  }

  if(manageBtn){

    manageBtn.disabled = isLocked;

    manageBtn.onclick=(e)=>{

      e.stopPropagation();

      if(isLocked) return;

      const visible = panel?.style.display==="block";

      if(visible){

        setManagerOpen(false);

      }else{

        renderDescriptionManager();

        setManagerOpen(true);

        showDescriptionDropdown(false);

      }

    };

  }

}



function renderVendorDropdown(filter=""){

  const box = el("vendorDropdown");

  const input = el("t_vendor");

  if(!box || !input) return;

  // s'assurer que les prestataires supprims ne rapparaissent pas

  const deleted = new Set(loadDeletedVendors().map(x=>x.toLowerCase()));

  const q = normalizeVendor(filter||"").toLowerCase();

  const list = vendorsCache

    .filter(v=> !deleted.has(v.toLowerCase()))

    .filter(v=>!q || v.toLowerCase().includes(q))

    .slice(0,50);

  if(list.length===0){

    box.innerHTML = `<div class="vendor-empty">Aucun rsultat</div>`;

  }else{

    box.innerHTML = list.map(v=>`<div class="vendor-item" role="option" tabindex="0">${attrEscape(v)}</div>`).join("");

  }

  box.querySelectorAll(".vendor-item").forEach(item=>{

    item.onclick=()=>{ input.value=item.textContent; showVendorDropdown(false); };

    item.onkeydown=(e)=>{ if(e.key==="Enter"){ input.value=item.textContent; showVendorDropdown(false); } };

  });

  showVendorDropdown(list.length>0);

}



function showVendorDropdown(show){

  const box = el("vendorDropdown");

  if(!box) return;

  box.style.display = show ? "block" : "none";

  box.classList.toggle("open", !!show);

  const input = el("t_vendor");

  if(show && input) openFloating(box, input);

  else closeFloating(box);

}



function renderVendorManager(){

  const panel = el("vendorManagerPanel");

  if(!panel) return;

  if(vendorsCache.length===0){

    panel.innerHTML = `<div class="vendor-empty">Aucun prestataire enregistr</div>`;

    return;

  }

  panel.innerHTML = dedupVendors(vendorsCache).map(v=>`

    <div class="vendor-row">

      <span class="vendor-name">${attrEscape(v)}</span>

      <div class="vendor-actions">

        <button class="btn btn-ghost vendor-rename" data-v="${attrEscape(v)}">Renommer</button>

        <button class="btn btn-danger vendor-delete" data-v="${attrEscape(v)}">Supprimer</button>

      </div>

    </div>

  `).join("");

  panel.querySelectorAll(".vendor-rename").forEach(btn=>{

    btn.onclick=()=>{

      const oldName = btn.dataset.v || "";

      const newName = prompt("Nouveau nom du prestataire :", oldName) || "";

      const trimmed = newName.trim();

      if(!trimmed) return;

      // retirer de la liste des supprims si prsent

      let deleted = loadDeletedVendors().filter(x=> x.toLowerCase()!==oldName.toLowerCase());

      saveDeletedVendors(deleted);

      vendorsCache = vendorsCache.map(x=> x.toLowerCase()===oldName.toLowerCase() ? trimmed : x);

      vendorsCache = dedupVendors(vendorsCache);

      vendorsCache = Array.from(new Set(vendorsCache)).sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));

      saveVendorsRegistry(vendorsCache);

      // mettre  jour toutes les tâches utilisant l'ancien nom

      (state?.tasks||[]).forEach(t=>{

        if((t.vendor||"").toLowerCase()===oldName.toLowerCase()) t.vendor = trimmed;

      });

      renderVendorDropdown(el("t_vendor")?.value||"");

      renderVendorManager();

      renderAll();

    };

  });

  panel.querySelectorAll(".vendor-delete").forEach(btn=>{

    btn.onclick=()=>{

      const name = btn.dataset.v || "";

      if(!name) return;

      if(!confirm(`Supprimer le prestataire "${name}" ?`)) return;

      vendorsCache = vendorsCache.filter(x=>x.toLowerCase()!==name.toLowerCase());

      vendorsCache = dedupVendors(vendorsCache);

      saveVendorsRegistry(vendorsCache);

      // ajouter  la liste des supprims pour filtrage futur

      const deleted = Array.from(new Set([...loadDeletedVendors(), name]));

      saveDeletedVendors(deleted);

      // retirer ce prestataire des tâches existantes

      (state?.tasks||[]).forEach(t=>{

        if((t.vendor||"").toLowerCase()===name.toLowerCase()) t.vendor = "";

      });

      saveState();

      renderVendorDropdown(el("t_vendor")?.value||"");

      renderVendorManager();

      renderAll();

    };

  });

}



function renderDescriptionDropdown(filter=""){

  const box = el("descDropdown");

  const input = el("t_room");

  if(!box || !input) return;

  const deleted = new Set(loadDeletedDescriptions().map(x=>x.toLowerCase()));

  const q = normalizeDesc(filter||"").toLowerCase();

  const list = descCache

    .filter(v=> !deleted.has(v.toLowerCase()))

    .filter(v=>!q || v.toLowerCase().includes(q))

    .slice(0,50);

  if(list.length===0){

    box.innerHTML = `<div class="vendor-empty">Aucun rsultat</div>`;

  }else{

    box.innerHTML = list.map(v=>`<div class="vendor-item" role="option" tabindex="0">${attrEscape(v)}</div>`).join("");

  }

  box.querySelectorAll(".vendor-item").forEach(item=>{

    item.onclick=()=>{ input.value=item.textContent; showDescriptionDropdown(false); };

    item.onkeydown=(e)=>{ if(e.key==="Enter"){ input.value=item.textContent; showDescriptionDropdown(false); } };

  });

  showDescriptionDropdown(list.length>0);

}



function showDescriptionDropdown(show){

  const box = el("descDropdown");

  if(!box) return;

  const input = el("t_room");

  const wrap = input ? input.closest(".desc-wrap") : null;

  const card = input ? input.closest(".card") : null;

  box.style.display = show ? "block" : "none";

  box.classList.toggle("open", !!show);

  wrap?.classList.toggle("desc-open", !!show);

  card?.classList.toggle("desc-panel-open", !!show);

  if(show && input) openFloating(box, input);

  else closeFloating(box);

}



function renderDescriptionManager(){

  const panel = el("descManagerPanel");

  if(!panel) return;

  if(descCache.length===0){

    panel.innerHTML = `<div class="vendor-empty">Aucune description enregistre</div>`;

    return;

  }

  panel.innerHTML = dedupDescriptions(descCache).map(v=>`

    <div class="vendor-row">

      <span class="vendor-name">${attrEscape(v)}</span>

      <div class="vendor-actions">

        <button class="btn btn-ghost desc-rename" data-v="${attrEscape(v)}">Renommer</button>

        <button class="btn btn-danger desc-delete" data-v="${attrEscape(v)}">Supprimer</button>

      </div>

    </div>

  `).join("");

  panel.querySelectorAll(".desc-rename").forEach(btn=>{

    btn.onclick=()=>{

      const oldName = btn.dataset.v || "";

      const newName = prompt("Nouvelle description :", oldName) || "";

      const trimmed = newName.trim();

      if(!trimmed) return;

      let deleted = loadDeletedDescriptions().filter(x=> x.toLowerCase()!==oldName.toLowerCase());

      saveDeletedDescriptions(deleted);

      descCache = descCache.map(x=> x.toLowerCase()===oldName.toLowerCase() ? trimmed : x);

      descCache = dedupDescriptions(descCache);

      descCache = Array.from(new Set(descCache)).sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));

      saveDescriptionsRegistry(descCache);

      (state?.tasks||[]).forEach(t=>{

        if((t.roomNumber||"").toLowerCase()===oldName.toLowerCase()) t.roomNumber = trimmed;

      });

      markDirty();

      renderDescriptionDropdown(el("t_room")?.value||"");

      renderProject();

    };

  });

  panel.querySelectorAll(".desc-delete").forEach(btn=>{

    btn.onclick=()=>{

      const name = btn.dataset.v || "";

      if(!name) return;

      if(!confirm(`Supprimer "${name}" ?`)) return;

      descCache = descCache.filter(x=>x.toLowerCase()!==name.toLowerCase());

      descCache = dedupDescriptions(descCache);

      saveDescriptionsRegistry(descCache);

      const deleted = Array.from(new Set([...loadDeletedDescriptions(), name]));

      saveDeletedDescriptions(deleted);

      (state?.tasks||[]).forEach(t=>{

        if((t.roomNumber||"").toLowerCase()===name.toLowerCase()) t.roomNumber = "";

      });

      markDirty();

      renderDescriptionDropdown(el("t_room")?.value||"");

      renderProject();

    };

  });

}



function normalizeState(raw){

  if(!raw) return defaultState();

  const normalizeStatus = (s)=> (s||"").split(",").filter(Boolean).map(v=>{

    if(v==="PREPA") return "PREPARATION";

    return v;

  }).join(",");

  const normProjects = (raw.projects||[]).map(p=>({...p, id:normId(p.id)}));

  const normTasks = (raw.tasks||[]).map(t=>({

    ...t,

    projectId:normId(t.projectId),

    status: normalizeStatus(t.status)

  }));

  // filtrer les prestataires supprims

  const deleted = new Set(loadDeletedVendors().map(x=>x.toLowerCase()));

  normTasks.forEach(t=>{

    if(t.vendor && deleted.has(t.vendor.toLowerCase())) t.vendor = "";

  });

  return {projects:normProjects, tasks:normTasks, ui: raw.ui||{}};

}

const formatDate = (s)=>{

  if(!s) return "";

  const parts = s.split("-");

  if(parts.length!==3) return s;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;

};

const unformatDate = (fr)=>{

  if(!fr) return "";

  const parts = fr.split("/");

  if(parts.length!==3) return fr;

  const [jj,mm,aa] = parts;

  return `${aa}-${mm}-${jj}`;

};

function toInputDate(val){
  if(!val) return "";
  if(val instanceof Date){
    return val.toISOString().slice(0,10);
  }
  const s = String(val).trim();
  if(!s) return "";
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}



// -------- Multislection Statuts / Corps d'état --------

function buildStatusMenu(){

  const menu = el("t_status_menu");

  if(!menu) return;

  let h="";

  sortedStatuses().forEach(s=>{

    h+=`<div class="ms-item" data-v="${s.v}">

          <span class="ms-checkbox"></span>

          <span class="ms-label">${s.label}</span>

        </div>`;

  });

  menu.innerHTML=h;

  menu.querySelectorAll(".ms-item").forEach(item=>{

    item.onclick=(e)=>{

      e.stopPropagation(); // garder le menu ouvert pendant la multi-slection

      const v=item.dataset.v;

      if(selectedStatusSet.has(v)) selectedStatusSet.delete(v);

      else selectedStatusSet.add(v);

      updateStatusDisplay();

    };

  });

}



function updateStatusDisplay(){

  const display = el("t_status_display");

  const menu = el("t_status_menu");

  if(!display || !menu) return;

  // visuels des coche

  menu.querySelectorAll(".ms-item").forEach(item=>{

    const v=item.dataset.v;

    if(selectedStatusSet.has(v)) item.classList.add("selected");

    else item.classList.remove("selected");

  });

  if(selectedStatusSet.size===0){

    display.textContent="Sélectionner";

  }else{

    const labels = STATUSES.filter(s=>selectedStatusSet.has(s.v)).map(s=>s.label);

    display.textContent = labels.join(", ");

  }

}



function setStatusSelection(values){

  selectedStatusSet = new Set((values||"").split(",").filter(Boolean));

  updateStatusDisplay();

}



function toggleStatusMenu(show){

  const menu = el("t_status_menu");

  if(!menu) return;

  const shouldShow = show!==undefined ? show : menu.classList.contains("hidden");

  if(shouldShow) menu.classList.remove("hidden");

  else menu.classList.add("hidden");

}



const EMBEDDED_BACKUP = {

  projects: [

    { id:"3e86100919c04fb8456", name:"Bureau Pastorale", site:"CDM", constraints:"", subproject:"Rénovation" },

    { id:"0c644af019c05700845", name:"Internat Saint Gervais", site:"LGT", constraints:"", subproject:"Rénovation CH 011" }

  ],

  tasks: [

    { id:"c807465d19c05012673", projectId:"3e86100919c04fb8456", roomNumber:"Rénovation", status:"ELECTRICITE,PEINTURE,MOBILIER,AMENAGEMENTS", owner:"Équipe interne", start:"2026-02-02", end:"2026-02-27", notes:"" },

    { id:"f490f0e019c0571bee2", projectId:"0c644af019c05700845", roomNumber:"Rénovation CH 011", status:"PEINTURE,TDV,AMENAGEMENTS", owner:"Équipe interne", start:"2026-02-02", end:"2026-02-14", notes:"" },

    { id:"840b3cb519c05732884", projectId:"0c644af019c05700845", roomNumber:"Rénovation CH 010", status:"PEINTURE,AMENAGEMENTS,TDV", owner:"Équipe interne", start:"2026-02-16", end:"2026-02-28", notes:"" }

  ],

  ui: { activeTab:"3e86100919c04fb8456", filters:{} }

};



function defaultState(){

  return deepClone(EMBEDDED_BACKUP);

}



function loadVendorsRegistry(){

  try{

    const raw = localStorage.getItem(VENDOR_STORE_KEY);

    if(!raw) return [];

    const arr = JSON.parse(raw);

    if(Array.isArray(arr)) return dedupVendors(arr);

    return [];

  }catch(e){

    console.warn("Unable to load vendor registry", e);

    return [];

  }

}



function loadDeletedVendors(){

  try{

    const raw = localStorage.getItem(VENDOR_DELETE_KEY);

    if(!raw) return [];

    const arr = JSON.parse(raw);

    if(Array.isArray(arr)) return arr.filter(Boolean);

    return [];

  }catch(e){

    console.warn("Unable to load deleted vendors", e);

    return [];

  }

}



function saveDeletedVendors(list){

  try{

    localStorage.setItem(VENDOR_DELETE_KEY, JSON.stringify(list));

  }catch(e){

    console.warn("Unable to save deleted vendors", e);

  }

}



function saveVendorsRegistry(list){

  try{

    localStorage.setItem(VENDOR_STORE_KEY, JSON.stringify(dedupVendors(list)));

  }catch(e){

    console.warn("Unable to save vendor registry", e);

  }

}



function loadDescriptionsRegistry(){

  try{

    const raw = localStorage.getItem(DESC_STORE_KEY);

    if(!raw) return [];

    const arr = JSON.parse(raw);

    if(Array.isArray(arr)) return dedupDescriptions(arr);

    return [];

  }catch(e){

    console.warn("Unable to load descriptions registry", e);

    return [];

  }

}



function loadDeletedDescriptions(){

  try{

    const raw = localStorage.getItem(DESC_DELETE_KEY);

    if(!raw) return [];

    const arr = JSON.parse(raw);

    if(Array.isArray(arr)) return arr.filter(Boolean);

    return [];

  }catch(e){

    console.warn("Unable to load deleted descriptions", e);

    return [];

  }

}



function saveDeletedDescriptions(list){

  try{

    localStorage.setItem(DESC_DELETE_KEY, JSON.stringify(list));

  }catch(e){

    console.warn("Unable to save deleted descriptions", e);

  }

}



function saveDescriptionsRegistry(list){

  try{

    localStorage.setItem(DESC_STORE_KEY, JSON.stringify(dedupDescriptions(list)));

  }catch(e){

    console.warn("Unable to save descriptions registry", e);

  }

}



function load(){

  const skipFileFetch = (window.location && window.location.protocol === "file:");

  const backupPromise = skipFileFetch

    ? Promise.reject("skip-file-fetch")

    : fetch(`suivi_chantiers_backup.json?v=${Date.now()}`, {cache:"no-store"});

  // 1) tenter le fichier de backup du projet (persistant disque)

  backupPromise

    .then(resp=> resp.ok ? resp.json() : null)

    .then(data=>{

      if(data){

        state = normalizeState(data);

        renderAll();

        clearDirty();

        _scheduleSupabaseAutoLoad();

        return;

      }

      // 2) sinon tenter le localStorage

      try{

        const raw = localStorage.getItem(STORAGE_KEY);

        if(raw){

          state = normalizeState(JSON.parse(raw));

          renderAll();

          clearDirty();

          _scheduleSupabaseAutoLoad();

          return;

        }

      }catch(e){}

      // 3) fallback état embarqu

      state = normalizeState(defaultState());

      renderAll();

      clearDirty();

      _scheduleSupabaseAutoLoad();

    })

    .catch(()=>{

      // si fetch choue, on tente localStorage puis default

      try{

        const raw = localStorage.getItem(STORAGE_KEY);

        if(raw){

          state = normalizeState(JSON.parse(raw));

          renderAll();

          clearDirty();

          _scheduleSupabaseAutoLoad();

          return;

        }

      }catch(e){}

      state = normalizeState(defaultState());

      renderAll();

      clearDirty();

      _scheduleSupabaseAutoLoad();

    });

}



function saveState(){

  try{

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    clearDirty();

    // Supabase greffe : APRES sauvegarde locale

    try{ if(window.saveAppStateToSupabase) window.saveAppStateToSupabase(state); }catch(e){}

  }catch(e){

    console.warn("save failed", e);

  }

}



function updateSaveButton(){

  const btn = el("btnSave");

  if(!btn) return;

  btn.classList.remove("btn-danger","btn-success");

  if(unsavedChanges){

    btn.classList.add("btn-danger");

  }else{

    btn.classList.add("btn-success");

  }

}

function markDirty(){ unsavedChanges = true; updateSaveButton(); }

function clearDirty(){ unsavedChanges = false; updateSaveButton(); }



function downloadBackup(){

  try{

    const data = JSON.stringify(state, null, 2);

    const blob = new Blob([data], {type:"application/json"});

    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);

    a.download = "suivi_chantiers_backup.json";

    document.body.appendChild(a);

    a.click();

    a.remove();

  }catch(e){

    console.warn("download backup failed", e);

  }

}



function writeBackupToDisk(){

  try{

    const data = JSON.stringify(state, null, 2);

    if(window.showSaveFilePicker){

      (async ()=>{

        const handle = await window.showSaveFilePicker({

          suggestedName: "suivi_chantiers_backup.json",

          types:[{description:"JSON", accept:{"application/json":[".json"]}}]

        });

        const writable = await handle.createWritable();

        await writable.write(data);

        await writable.close();

      })();

    }

  }catch(e){

    console.warn("writeBackupToDisk failed", e);

  }

}



function flashSaved(){

  const btn = el("btnSave");

  if(!btn) return;

  const old = btn.textContent;

  btn.textContent = " Sauvegard";

  btn.classList.add("pulse");

  setTimeout(()=>{ btn.textContent = old; btn.classList.remove("pulse"); },1200);

}



function setLockState(flag){

  isLocked = !!flag;

  const lockClass = "is-disabled";

  const ids = [

    "btnSave","btnAddProject","btnAddTask",

    "btnSaveProject","btnDeleteProject",

    "btnSaveTask","btnNewTask","btnDeleteTask"

  ];

  ids.forEach(id=>{
    const n=el(id);
    if(!n) return;
    n.classList.toggle(lockClass, isLocked);
    if(isLocked) n.setAttribute("disabled","disabled");
    else n.removeAttribute("disabled");
  });
  const cfgBtn = el("btnConfig");
  if(cfgBtn){
    cfgBtn.style.display = (!isLocked && getCurrentRole()==="admin") ? "inline-flex" : "none";
  }
  updateRoleUI();
  if(isLocked){
    closeConfigModal();
  }
  // état du verrou + boutons autoriser/interdire
  const lockLabel = el("topbarLock");
  if(lockLabel){
    lockLabel.textContent = isLocked ? "Verrou : Interdit" : "Verrou : Autorisé";
    lockLabel.classList.toggle("is-allowed", !isLocked);
    lockLabel.classList.toggle("is-denied", isLocked);
  }
  const switchBtn = el("btnSwitchUser");
  if(switchBtn){
    switchBtn.style.display = isLocked ? "none" : "inline-flex";
  }
  const allowBtn = el("btn_allow_lock");
  const forbidBtn = el("btn_forbid_lock");
  if(allowBtn){
    allowBtn.disabled = !isLocked;
    allowBtn.classList.toggle("is-disabled", !isLocked);
  }
  if(forbidBtn){
    forbidBtn.disabled = isLocked;
    forbidBtn.classList.toggle("is-disabled", isLocked);
  }
  // gestion prestataires : dsactiver + masquer panels/dropdown

  const manageBtn = el("btnManageVendors");

  if(manageBtn){

    manageBtn.classList.toggle(lockClass, isLocked);

    if(isLocked) manageBtn.setAttribute("disabled","disabled");

    else manageBtn.removeAttribute("disabled");

  }

  const manageDescBtn = el("btnManageDescriptions");

  if(manageDescBtn){

    manageDescBtn.classList.toggle(lockClass, isLocked);

    if(isLocked) manageDescBtn.setAttribute("disabled","disabled");

    else manageDescBtn.removeAttribute("disabled");

  }

  if(isLocked){

    showVendorDropdown(false);

    const panel = el("vendorManagerPanel");

    if(panel) panel.style.display="none";

    showDescriptionDropdown(false);

    const descPanel = el("descManagerPanel");

    if(descPanel) descPanel.style.display="none";

    const overlay = el("descOverlay");

    if(overlay) overlay.classList.remove("show");

  }

  // tab close (supprimer projet)

  const tabCloses = document.querySelectorAll(".tab-close");

  tabCloses.forEach(n=>{

    n.classList.toggle(lockClass, isLocked);

    if(isLocked) n.setAttribute("aria-disabled","true");

    else n.removeAttribute("aria-disabled");

  });

  // boutons dangereux (supprimer) : forcer disable en mode verrou

  const dangerBtns = document.querySelectorAll("button.btn-danger");

  dangerBtns.forEach(btn=>{

    btn.classList.toggle(lockClass, isLocked);

    if(isLocked) btn.setAttribute("disabled","disabled");

    else btn.removeAttribute("disabled");

  });

  // visuel live

  const live = el("masterLive");

  if(live){

    live.classList.toggle("is-disabled", isLocked);

  }

  const plive = el("projectLive");

  if(plive){
    plive.classList.toggle("is-disabled", isLocked);
  }
}
window.setLockState = setLockState;
window.updateRoleUI = updateRoleUI;


function statusLabels(values){

  return parseStatuses(values).map(v=> (STATUSES.find(s=>s.v===v)?.label || v)).join(", ");

}

function toDateInput(d){

  if(!d) return "";

  const x = new Date(d.getTime());

  return x.toISOString().slice(0,10);

}

function parseInputDate(v){

  if(!v) return null;

  const d = new Date(v+"T00:00:00");

  return isNaN(d) ? null : d;

}

function getTasksDateBounds(tasks){

  let min=null, max=null;

  tasks.forEach(t=>{

    if(!t.start || !t.end) return;

    const s = parseInputDate(t.start);

    const e = parseInputDate(t.end);

    if(!s || !e) return;

    if(!min || s < min) min = s;

    if(!max || e > max) max = e;

  });

  return {min,max};

}

function getWorkloadRange(tasks, boundsTasks=tasks, stateRef=null){

  const {min, max} = getTasksDateBounds(boundsTasks);

  if(!min || !max) return {start:null,end:null};

  const type = (stateRef?.type ?? workloadRangeType) || "all";

  if(type==="all"){

    return {start:min, end:max};

  }

  if(type==="custom"){

    const s = parseInputDate(stateRef?.start ?? workloadRangeStart) || min;

    const e = parseInputDate(stateRef?.end ?? workloadRangeEnd) || max;

    return {start:s, end:e};

  }

  const year = parseInt((stateRef?.year ?? workloadRangeYear) || String(min.getFullYear()),10);

  if(type==="civil"){

    return {start:new Date(year,0,1), end:new Date(year,11,31)};

  }

  // school: 1er sept -> 31 aot

  return {start:new Date(year,8,1), end:new Date(year+1,7,31)};

}

function syncWorkloadFilterUI(tasks, boundsTasks=tasks, uiIds=null, stateRef=null){

  const typeSel = el("workloadRangeType");

  const yearSel = el("workloadRangeYear");

  const startInput = el("workloadRangeStart");

  const endInput = el("workloadRangeEnd");

  const typeNode = uiIds ? el(uiIds.type) : typeSel;

  const yearNode = uiIds ? el(uiIds.year) : yearSel;

  const startNode = uiIds ? el(uiIds.start) : startInput;

  const endNode = uiIds ? el(uiIds.end) : endInput;

  if(!typeNode || !yearNode || !startNode || !endNode) return;

  const {min, max} = getTasksDateBounds(boundsTasks);

  if(!min || !max) return;

  const minYear = min.getFullYear() - 1;

  const maxYear = max.getFullYear() + 1;

  const st = stateRef || {type:workloadRangeType, year:workloadRangeYear, start:workloadRangeStart, end:workloadRangeEnd};

  if(!st.year) st.year = String(min.getFullYear());

  if(!st.start) st.start = toDateInput(min);

  if(!st.end) st.end = toDateInput(max);

  // options anne

  let opts="";

  for(let y=minYear; y<=maxYear; y++){

    opts += `<option value="${y}">${y}</option>`;

  }

  yearNode.innerHTML = opts;

  yearNode.value = st.year;

  typeNode.value = st.type || "all";

  startNode.value = st.start;

  endNode.value = st.end;

  const showDates = (typeNode.value==="custom");

  const showYear = (typeNode.value==="civil" || typeNode.value==="school");

  startNode.style.display = showDates ? "inline-block" : "none";

  endNode.style.display = showDates ? "inline-block" : "none";

  yearNode.style.display = showYear ? "inline-block" : "none";

  if(stateRef){

    stateRef.type = typeNode.value;

    stateRef.year = yearNode.value;

    stateRef.start = startNode.value;

    stateRef.end = endNode.value;

  }

}

function isWeekday(d){

  const day = d.getDay();

  return day >= 1 && day <= 5; // lundi-vendredi

}

function countWeekdays(start, end){

  if(!start || !end || end < start) return 0;

  let count = 0;

  for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){

    if(isWeekday(d)) count += 1;

  }

  return count;

}

function durationDays(start,end){

  if(!start || !end) return "";

  const s=new Date(start+"T00:00:00");

  const e=new Date(end+"T00:00:00");

  if(isNaN(s) || isNaN(e) || e<s) return "";

  const days = countWeekdays(s, e);

  return days>0 ? days : "";

}

function taskTitle(t){

  const p = state?.projects?.find(x=>x.id===t.projectId);

  const projectName = (p?.name||"Projet").trim();

  const sub = (p?.subproject||"").trim();

  const desc = (t.roomNumber||"").trim();

  if(sub && desc) return `${projectName} - ${sub} - ${desc}`;

  if(sub) return `${projectName} - ${sub}`;

  if(desc) return `${projectName} - ${desc}`;

  return projectName;

}



function ganttLaneTitle(t){

  const p = state?.projects?.find(x=>x.id===t.projectId);

  const projectName = (p?.name || "Sans projet").trim() || "Sans projet";

  const desc = (t.roomNumber || "").trim();

  return desc ? `${projectName} - ${desc}` : projectName;

}



function computeTaskOrderMap(){

  const map={};

  state.projects.forEach(p=>{

    const tasks=state.tasks.filter(t=>t.projectId===p.id);

    tasks.sort((a,b)=>{

      const sa = Date.parse(a.start||"9999-12-31");

      const sb = Date.parse(b.start||"9999-12-31");

      if(sa!==sb) return sa-sb;

      const ea = Date.parse(a.end||"9999-12-31");

      const eb = Date.parse(b.end||"9999-12-31");

      if(ea!==eb) return ea-eb;

      return (a.roomNumber||"").localeCompare(b.roomNumber||"");

    });

    tasks.forEach((t,i)=>{ map[t.id]=i+1; });

  });

  taskOrderMap=map;

}



// Gantt helpers

function startOfWeek(d){

  const x=new Date(d.getTime());

  const day=(x.getDay()+6)%7; // lundi=0

  x.setDate(x.getDate()-day);

  x.setHours(0,0,0,0);

  return x;

}

function endOfWorkWeek(d){

  const x=new Date(d.getTime());

  // vendredi = lundi + 4 jours

  x.setDate(x.getDate()+4);

  x.setHours(23,59,59,999);

  return x;

}

function addDays(d,n){ const x=new Date(d.getTime()); x.setDate(x.getDate()+n); return x; }

// --- Vacances scolaires (Zone B) par NUMÉROS de semaines ---
// Format : { "2025-2026": [8,9,16,17,28,29,30,31,32,33,34,35,43,44,52] }
const VACANCES_ZONE_B_WEEKS = {
  "2025-2026": [8,9,16,17,28,29,30,31,32,33,34,35,43,44,52]
};
function getSchoolYearKey(d){
  const y = d.getFullYear();
  const m = d.getMonth(); // 0=janv
  // année scolaire : septembre -> août
  return (m >= 8) ? `${y}-${y+1}` : `${y-1}-${y}`;
}
function isVacationWeek(weekStart){
  const info = isoWeekInfo(weekStart);
  const schoolYear = getSchoolYearKey(weekStart);
  const list = VACANCES_ZONE_B_WEEKS[schoolYear] || [];
  return list.includes(info.week);
}

function overlapDays(aStart,aEnd,bStart,bEnd){

  const start = Math.max(aStart.getTime(), bStart.getTime());

  const end   = Math.min(aEnd.getTime(), bEnd.getTime());

  if(end < start) return 0;

  const diff = (end - start)/(1000*60*60*24);

  return Math.floor(diff)+1;

}

function barGeometry(taskStart, taskEnd, weekStart){

  const weekEnd = addDays(weekStart,4); // semaine ouvre

  const start = taskStart > weekStart ? taskStart : weekStart;

  const end = taskEnd < weekEnd ? taskEnd : weekEnd;

  const days = countWeekdays(start, end);

  if(days<=0) return {days:0,width:0,offset:0};

  let offsetDays = 0;

  if(taskStart > weekStart){

    const offsetEnd = addDays(taskStart, -1);

    const offsetLimit = offsetEnd < weekEnd ? offsetEnd : weekEnd;

    offsetDays = countWeekdays(weekStart, offsetLimit);

  }

  const offsetPct  = Math.min(100, (offsetDays/5)*100);

  let widthPct = (days/5)*100;

  // éviter dépassement au-delà de la cellule

  if(offsetPct + widthPct > 100) widthPct = 100 - offsetPct;

  widthPct = Math.max(12, Math.min(100, widthPct));

  return {days, width:widthPct, offset:offsetPct};

}

function isoWeekInfo(d){

  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

  const day = date.getUTCDay() || 7;

  date.setUTCDate(date.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));

  const weekNo = Math.ceil(((date - yearStart)/86400000 +1)/7);

  return {week:weekNo, year:date.getUTCFullYear()};

}



function weekKey(d){

  const info=isoWeekInfo(d);

  return `${info.year}-S${String(info.week).padStart(2,"0")}`;

}

function keyToLabel(key, mode){

  if(mode==="day"){

    const [y,m,da]=key.split("-");

    return `${da}/${m}`;

  }

  // week

  const parts=key.split("-S");

  if(parts.length===2) return `S${parts[1]}/${String(parts[0]).slice(2)}`;

  return key;

}



function computeWorkloadData(tasks, mode="week", rangeStart=null, rangeEnd=null){

  const map = new Map(); // key -> {internal, external, rsgri, total, anchor}

  tasks.filter(t=>t.start && t.end).forEach(t=>{

    const start=new Date(t.start+"T00:00:00");

    const end=new Date(t.end+"T00:00:00");

    if(isNaN(start)||isNaN(end)|| end<start) return;

    const typ = ownerType(t.owner);

    for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){

      if(!isWeekday(d)) continue;

      if(rangeStart && d < rangeStart) continue;

      if(rangeEnd && d > rangeEnd) continue;

      const key = mode==="day" ? d.toISOString().slice(0,10) : weekKey(d);

      const anchor = mode==="day" ? d.getTime() : startOfWeek(d).getTime();

      if(!map.has(key)) map.set(key,{internal:0,external:0,rsgri:0,total:0,anchor});

      const slot = map.get(key);

      if(typ==="rsgri") slot.rsgri+=1;
      else if(typ==="interne") slot.internal+=1;

      else slot.external+=1; // "externe" + inconnus

      slot.total = slot.internal + slot.external + slot.rsgri;

    }

  });

  const arr = Array.from(map.entries()).map(([key,val])=>({...val,key}));

  arr.sort((a,b)=> a.anchor - b.anchor);

  return arr;

}



function niceMax(v){

  if(v<=5) return 5;

  const pow = Math.pow(10, Math.floor(Math.log10(v)));

  const mul = Math.ceil(v / pow);

  if(mul<=2) return 2*pow;

  if(mul<=5) return 5*pow;

  return 10*pow;

}



function renderGantt(projectId){

  const wrap = el("gantt");

  const legend = el("legend");

  if(legend){

    legend.innerHTML = sortedStatuses().map(s=>{

      const c = STATUS_COLORS[s.v] || "#2563eb";

      return `<span class="legend-item"><span class="legend-dot" style="background:${c};border-color:${c}"></span><span style="color:#111827;font-weight:600;">${s.label}</span></span>`;

    }).join("");

  }

  if(!wrap) return;

  const tasks = state.tasks.filter(t=>t.projectId===projectId && t.start && t.end);

  if(tasks.length===0){

    wrap.innerHTML="<div class='gantt-empty'>Aucune tâche date.</div>";

    return;

  }

  const minStart = tasks.map(t=>new Date(t.start+"T00:00:00")).reduce((a,b)=>a<b?a:b);

  const maxEnd   = tasks.map(t=>new Date(t.end+"T00:00:00")).reduce((a,b)=>a>b?a:b);

  const weeks=[];
  for(let w=startOfWeek(minStart); w<=addDays(startOfWeek(maxEnd),0); w=addDays(w,7)) weeks.push(new Date(w));
  const vacWeeks = weeks.map(w=>isVacationWeek(w));



  // tri pour garder un ordre stable

  tasks.sort((a,b)=>{

    const oa=(taskOrderMap[a.id]||9999)-(taskOrderMap[b.id]||9999);

    if(oa!==0) return oa;

    const sa=Date.parse(a.start||"9999-12-31"), sb=Date.parse(b.start||"9999-12-31");

    if(sa!==sb) return sa-sb;

    return taskTitle(a).localeCompare(taskTitle(b));

  });



  let html="<div class='tablewrap gantt-table'><table class='table' style='--gcol1:200px;--gcol2:120px;--gcol3:70px'>";

  html+="<thead><tr><th class='gantt-task-col-project gantt-col-task'>Tâche</th><th class='gantt-col-vendor' style='width:120px'>Prestataire</th><th class='gantt-col-status' style='width:70px'>Statut</th>";

  weeks.forEach((w,i)=>{

    const info=isoWeekInfo(w);

    const wEnd=endOfWorkWeek(w);

    const range=`${w.toLocaleDateString("fr-FR",{day:"2-digit"})}-${wEnd.toLocaleDateString("fr-FR",{day:"2-digit"})}/${wEnd.toLocaleDateString("fr-FR",{month:"2-digit",year:"2-digit"})}`;

    const weekLabel = `S${String(info.week).padStart(2,"0")}`;

    const mondayLabel = formatShortDate(w);

    const todayClass = isTodayInWeek(w) ? " week-today" : "";
    const vacClass = vacWeeks[i] ? " vac-week" : "";
    html+=`<th class="week-cell${todayClass}${vacClass}" data-range="${range}" style='width:72px;color:#111827'>${weekLabel}<div class="gantt-week-date">${mondayLabel}</div></th>`;

  });

  html+="</tr></thead><tbody>";



  // 1 ligne par tâche (plus de regroupement)

  tasks.forEach(t=>{

    const statuses = parseStatuses(t.status).map(v=>v.toUpperCase());

    const mainStatus = statuses[0] || "";

    const color = ownerColor(t.owner);

    const ownerBadges = t.owner ? ownerBadge(t.owner) : "";

    const vendorBadges = (()=> {

      const set = new Set();

      if(t.vendor) set.add(t.vendor);

      const typ = ownerType(t.owner);
      if(typ === "interne") set.add("Équipe interne");
      if(typ === "rsgri") set.add("RSG/RI");
      if(typ === "externe" && !t.vendor) set.add("Prestataire externe");

      if(set.size===0) return "<span class='text-muted'></span>";

      return Array.from(set).sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}))

        .map(v=>vendorBadge(v)).join(" ");

    })();



    const todayKey = new Date().toISOString().slice(0,10);
    const isToday = !!(t.start && t.end && t.start<=todayKey && t.end>=todayKey);
    const isLate = !!(t.end && t.end < todayKey);
    const rowClass = t.id===selectedTaskId ? "gantt-row gantt-row-active" : "gantt-row";
    const rowClassWithToday = `${rowClass}${isToday ? " today-row" : ""}${isLate ? " late-row" : ""}`;
    html+=`<tr class="${rowClassWithToday}" data-task="${t.id}" onclick="openTaskFromGantt('${t.id}')">`;
    const p = state?.projects?.find(x=>x.id===t.projectId);

    const sub = (p?.subproject || "").trim();

    const taskDesc = (t.roomNumber || "").trim();

    const label = [sub, taskDesc].filter(Boolean).join("  ");

    html+=`<td class="gantt-task-col-project gantt-col-task"><b><span class="num-badge" style="--badge-color:${color};--badge-text:#fff;">${taskOrderMap[t.id]||""}</span></b> <span class="gantt-task-name">${attrEscape(label)}</span></td>`;

    html+=`<td class="gantt-vendor-cell gantt-col-vendor"><div class="vendor-stack">${vendorBadges}</div></td>`;

    html+=`<td class="gantt-status-cell gantt-col-status"><div class="gantt-status-stack"><div class="status-row"><span>${statusLabels(mainStatus)}</span></div></div></td>`;



    weeks.forEach((w,i)=>{

      const sDate=new Date(t.start+"T00:00:00");

      const eDate=new Date(t.end+"T00:00:00");

      const geo=barGeometry(sDate,eDate,w);

      if(geo.days>0){

        const title = t.vendor ? ` title="Prestataire : ${attrEscape(t.vendor)}"` : "";

        const vacClass = vacWeeks[i] ? " vac-week" : "";
        html+=`<td class="gantt-cell${vacClass}"><div class="gantt-cell-inner"><div class="bar-wrapper"><div class="gantt-bar bar-click" data-task="${t.id}" data-status="${mainStatus}"${title} style="width:${geo.width}%;margin-left:${geo.offset}%;background:${color};border-color:${color}"><span class="gantt-days">${geo.days} j</span></div></div></div></td>`;

      }else{

        const vacClass = vacWeeks[i] ? " vac-week" : "";
        html+=`<td class="gantt-cell${vacClass}"><div class="gantt-cell-inner"><div class="gantt-spacer"></div></div></td>`;

      }

    });



    html+="</tr>";

  });



  html+="</tbody></table></div>";

  wrap.innerHTML=html;

  applyGanttColumnVisibility();

  wrap.querySelectorAll(".bar-click")?.forEach(bar=>{

    bar.onclick=()=>{

      const taskId = bar.dataset.task;

      const task = state.tasks.find(x=>x.id===taskId);

      if(!task) return;

      selectedProjectId = task.projectId;

      selectedTaskId = taskId;

      renderProject();

    };

  });

  wrap.querySelectorAll("tbody tr[data-task] td")?.forEach(td=>{

    td.onclick=(e)=>{

      if(e.target && e.target.closest(".bar-click")) return;

      const row = e.currentTarget?.parentElement;

      if(!row || !row.dataset.task) return;

      const taskId = row.dataset.task;

      const task = state.tasks.find(x=>x.id===taskId);

      if(!task) return;

      selectedProjectId = task.projectId;

      selectedTaskId = taskId;

      renderProject();

    };

  });

}



function renderProjectTasks(projectId){

  const tbody = el("projectTasksTable")?.querySelector("tbody");

  if(!tbody) return;

  const tasks = state.tasks.filter(t=>t.projectId===projectId);

  const sorted = sortTasks(tasks, sortProject);

  if(sorted.length===0){

    tbody.innerHTML="<tr><td colspan='6' class='empty-row'>Aucune tâche</td></tr>";

    return;

  }

  let h="";

  sorted.forEach(t=>{

    const statuses = parseStatuses(t.status).map(v=>v.toUpperCase());

    const c = ownerColor(t.owner);

    const ownerBadgeHtml = t.owner ? ownerBadge(t.owner) : "";
    const typ = ownerType(t.owner);
    const durDays = durationDays(t.start,t.end);
    const durLabel = typ === "rsgri" ? `${durDays} j (${durDays*2} h)` : `${durDays} j`;
    const todayKey = new Date().toISOString().slice(0,10);
    const isToday = !!(t.start && t.end && t.start<=todayKey && t.end>=todayKey);
    const isLate = !!(t.end && t.end < todayKey);
    const rowClass = `${isToday ? "today-row " : ""}${isLate ? "late-row" : ""}`.trim();

    h+=`<tr class="${rowClass}" data-task="${t.id}">

      <td><span class="num-badge" style="--badge-color:${c};--badge-text:#fff;">${taskOrderMap[t.id]||""}</span></td>

      <td><span class="icon-picto"></span> ${taskTitle(t)}</td>

      <td class="status-cell"><span class="status-left">${statusDot(statuses[0])}${statusLabels(t.status||"")}</span>${ownerBadgeHtml||""}</td>

      <td>${formatDate(t.start)||""}${isToday ? `<span class="today-dot" title="En cours aujourd'hui"></span>` : ""}</td>

      <td>${formatDate(t.end)||""}</td>

      <td>${durLabel}</td>

    </tr>`;

  });

  tbody.innerHTML=h;

  tbody.querySelectorAll("tr").forEach(row=>{
    row.onclick=()=>{
      if(!row.dataset.task) return;
      selectTaskInProject(row.dataset.task);
    };
  });
  updateSortIndicators("projectTasksTable", sortProject);

  const pf = el("projectFiltersBadge");

  if(pf){

    const active = (sortProject.key!=="start" || sortProject.dir!=="asc");

    updateBadge(pf, active, "Tri/filtre actif", "Tri par défaut");

  }

}



// Nouvelle version : 1 tâche = 1 ligne dans le gantt maître

function renderMasterGantt(){

  const wrap = el("masterGantt");

  if(!wrap) return;

  const tasks = filteredTasks().filter(t=>t.start && t.end);

  if(tasks.length===0){

    wrap.innerHTML = "<div class='gantt-empty'>Aucune tâche date.</div>";

    return;

  }

  const minStart = tasks.map(t=>new Date(t.start+"T00:00:00")).reduce((a,b)=>a<b?a:b);

  const maxEnd   = tasks.map(t=>new Date(t.end+"T00:00:00")).reduce((a,b)=>a>b?a:b);

  const weeks=[];
  for(let w=startOfWeek(minStart); w<=addDays(startOfWeek(maxEnd),0); w=addDays(w,7)) weeks.push(new Date(w));
  const vacWeeks = weeks.map(w=>isVacationWeek(w));



  tasks.sort((a,b)=>{

    const oa=(taskOrderMap[a.id]||9999)-(taskOrderMap[b.id]||9999);

    if(oa!==0) return oa;

    const sa=Date.parse(a.start||"9999-12-31"), sb=Date.parse(b.start||"9999-12-31");

    if(sa!==sb) return sa-sb;

    return taskTitle(a).localeCompare(taskTitle(b));

  });



  let html="<div class='tablewrap gantt-table'><table class='table' style='--gcol1:150px;--gcol2:140px;--gcol3:90px'>";

  html+="<thead><tr><th class='gantt-col-task' style='width:150px'>Tâche</th><th class='gantt-col-vendor' style='width:140px'>Prestataire</th><th class='gantt-col-status' style='width:90px'>Statut</th>";

  weeks.forEach((w,i)=>{

    const info=isoWeekInfo(w);

    const wEnd=endOfWorkWeek(w);

    const range=`${w.toLocaleDateString("fr-FR",{day:"2-digit"})}-${wEnd.toLocaleDateString("fr-FR",{day:"2-digit"})}/${wEnd.toLocaleDateString("fr-FR",{month:"2-digit",year:"2-digit"})}`;

    const weekLabel = `S${String(info.week).padStart(2,"0")}`;

    const mondayLabel = formatShortDate(w);

    const todayClass = isTodayInWeek(w) ? " week-today" : "";
    const vacClass = vacWeeks[i] ? " vac-week" : "";
    html+=`<th class="week-cell${todayClass}${vacClass}" data-range="${range}" style='width:72px;color:#111827'>${weekLabel}<div class="gantt-week-date">${mondayLabel}</div></th>`;

  });

  html+="</tr></thead><tbody>";



  tasks.forEach(t=>{

    const statuses = parseStatuses(t.status).map(v=>v.toUpperCase());

    const mainStatus = statuses[0] || "";

    const color = ownerColor(t.owner);

    const p = state?.projects?.find(x=>x.id===t.projectId);

    const projectName = (p?.name || "Projet").trim() || "Projet";

    const vendorBadges = (()=> {

      const set = new Set();

      if(t.vendor) set.add(t.vendor);

      const typ = ownerType(t.owner);
      if(typ === "interne") set.add("Équipe interne");
      if(typ === "rsgri") set.add("RSG/RI");
      if(typ === "externe" && !t.vendor) set.add("Prestataire externe");

      if(set.size===0) return "<span class='text-muted'></span>";

      return Array.from(set).sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}))

        .map(v=>vendorBadge(v)).join(" ");

    })();



    const todayKey = new Date().toISOString().slice(0,10);
    const isToday = !!(t.start && t.end && t.start<=todayKey && t.end>=todayKey);
    const isLate = !!(t.end && t.end < todayKey);
    const rowClass = t.id===selectedTaskId ? "gantt-row gantt-row-active" : "gantt-row";
    const rowClassWithToday = `${rowClass}${isToday ? " today-row" : ""}${isLate ? " late-row" : ""}`;
    html+=`<tr class="${rowClassWithToday}" data-task="${t.id}" onclick="openTaskFromGantt('${t.id}')">`;
    html+=`<td class="gantt-col-task"><span class="num-badge" style="--badge-color:${color};--badge-text:#fff;">${taskOrderMap[t.id]||""}</span> <span class="gantt-task-name">${attrEscape(projectName)}</span></td>`;

    html+=`<td class="gantt-vendor-cell gantt-col-vendor"><div class="vendor-stack">${vendorBadges}</div></td>`;

    html+=`<td class="gantt-status-cell gantt-col-status"><div class="gantt-status-stack"><div class="status-row"><span>${statusLabels(mainStatus)}</span></div></div></td>`;



    weeks.forEach((w,i)=>{

      const sDate=new Date(t.start+"T00:00:00");

      const eDate=new Date(t.end+"T00:00:00");

      const geo=barGeometry(sDate,eDate,w);

      if(geo.days>0){

        const title = t.vendor ? ` title="Prestataire : ${attrEscape(t.vendor)}"` : "";

        const vacClass = vacWeeks[i] ? " vac-week" : "";
        html+=`<td class="gantt-cell${vacClass}"><div class="gantt-cell-inner"><div class="bar-wrapper"><div class="gantt-bar bar-click" data-task="${t.id}" data-status="${mainStatus}"${title} style="width:${geo.width}%;margin-left:${geo.offset}%;background:${color};border-color:${color}"><span class="gantt-days">${geo.days} j</span></div></div></div></td>`;

      }else{

        const vacClass = vacWeeks[i] ? " vac-week" : "";
        html+=`<td class="gantt-cell${vacClass}"><div class="gantt-cell-inner"><div class="gantt-spacer"></div></div></td>`;

      }

    });



    html+="</tr>";

  });



  html+="</tbody></table></div>";

  wrap.innerHTML=html;

  applyGanttColumnVisibility();

  wrap.querySelectorAll(".bar-click")?.forEach(bar=>{

    bar.onclick=(e)=>{

      if(e && e.stopPropagation) e.stopPropagation();

      const taskId = bar.dataset.task;

      const task = state.tasks.find(x=>x.id===taskId);

      if(!task) return;

      openTaskFromGantt(taskId);

    };

  });

}



function exportSvgToPdf(svgId, title="Export", pieId=null, tasksOverride=null){

  const svg = document.getElementById(svgId);

  if(!svg) return;



  // Cloner et injecter le style indispensable pour l'export (sinon le SVG perd ses classes).

  const clone = svg.cloneNode(true);

  const inlineStyle = `

    * { font-family: "Segoe UI", Arial, sans-serif; }

    .wl-axis text{font-size:11px;fill:#0f172a;}

    .wl-bg{fill:url(#brushed);}

    .wl-bar-internal{}

    .wl-bar-external{}

    .wl-grid{stroke:#e5e7eb;stroke-width:1;}

    .wl-grid-vert{stroke:#e5e7eb;stroke-width:1;stroke-dasharray:2 3;}

    .wl-value{font-size:10px;fill:#0f172a;}

  `;

  const styleEl = document.createElement("style");

  styleEl.textContent = inlineStyle;

  clone.insertBefore(styleEl, clone.firstChild);



  const serializer = new XMLSerializer();

  const str = serializer.serializeToString(clone);

  const blob = new Blob([str], {type:"image/svg+xml;charset=utf-8"});

  const url = URL.createObjectURL(blob);

  const img = new Image();

  const { width, height } = svg.getBoundingClientRect();

  const pieSvg = pieId ? document.getElementById(pieId) : null;

  const fallbackWidth = svg.viewBox?.baseVal?.width || svg.clientWidth || 900;

  const fallbackHeight = svg.viewBox?.baseVal?.height || svg.clientHeight || 260;

  img.onload = function(){

    const canvas = document.createElement("canvas");

    canvas.width = Math.max(1, Math.floor(width || fallbackWidth));

    canvas.height = Math.max(1, Math.floor(height || fallbackHeight));

    const ctx = canvas.getContext("2d");

    ctx.fillStyle="#fff";

    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.drawImage(img,0,0,canvas.width,canvas.height);

    const data = canvas.toDataURL("image/png");

    const pieData = pieSvg ? (()=> {

      const pieClone = pieSvg.cloneNode(true);

      const pieStyle = document.createElement("style");

      pieStyle.textContent = inlineStyle;

      pieClone.insertBefore(pieStyle, pieClone.firstChild);

      const pieStr = serializer.serializeToString(pieClone);

      const pieBlob = new Blob([pieStr], {type:"image/svg+xml;charset=utf-8"});

      return URL.createObjectURL(pieBlob);

    })() : "";

    const w = window.open("","_blank");

    if(!w) return;

    const nowLabel = new Date().toLocaleDateString("fr-FR");

    const sourceTasks = tasksOverride || filteredTasks();

    const range = getWorkloadRange(sourceTasks, state.tasks || sourceTasks);

    const totals = computeWorkloadData(sourceTasks || [], "week", range.start, range.end);

    const tInt = totals.reduce((s,d)=>s+d.internal,0);

    const tExt = totals.reduce((s,d)=>s+d.external,0);

    const tAll = Math.max(1, tInt + tExt);

    const pInt = Math.round((tInt/tAll)*100);

    const pExt = 100 - pInt;

    // Mise en page A4 paysage + centrage

    w.document.write(`

      <title>${title}</title>

      <style>

        @page { size: A4 landscape; margin: 10mm; }

        :root{--green:#16a34a;--gray:#4b5563;--ink:#0b1424;}

        body{margin:0;padding:0;display:flex;flex-direction:column;align-items:center;font-family:"Segoe UI",Arial,sans-serif;background:#fff;color:var(--ink);}

        .page{width:100%;box-sizing:border-box;padding:6mm 8mm 8mm;}

        .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #d1d5db;padding-bottom:6px;margin-bottom:6px;}

        h1{font-size:18px;margin:0;}

        .meta{font-size:10px;color:#475569;text-align:right;}

        .subtitle{font-size:11px;color:#475569;margin-top:2px;}

        .legend{display:flex;gap:10px;align-items:center;margin:6px 0 8px;}

        .legend .item{display:flex;align-items:center;gap:6px;font-size:11px;}

        .dot{width:10px;height:10px;border-radius:4px;display:inline-block;}

        .dot.int{background:var(--green);}

        .dot.ext{background:var(--gray);}

        .frame{border:1px solid #e5e7eb;border-radius:10px;padding:6mm;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);}

        .pie-frame{margin-top:6mm;border:1px solid #e5e7eb;border-radius:10px;padding:6mm;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);}

        .img-wrap{width:100%;display:flex;justify-content:center;}

        img{max-width:100%;height:auto;}

        .footer{margin-top:6px;font-size:10px;color:#64748b;display:flex;justify-content:space-between;}

      </style>

      <div class="page">

        <div class="header">

          <div>

            <h1>${title}</h1>

            <div class="subtitle">Charge de travail  Unité : jours ouvrés</div>

          </div>

          <div class="meta">Export du ${nowLabel}</div>

        </div>

        <div class="legend">

          <div class="item"><span class="dot int"></span>Équipe interne ${pInt}%</div>

          <div class="item"><span class="dot ext"></span>Prestataire externe ${pExt}%</div>

        </div>

        <div class="frame">

          <div class="img-wrap"><img id="__print_img" src="${data}" aria-label="${title}"></div>

        </div>

        ${pieData ? `<div class="pie-frame"><div class="img-wrap"><img id="__pie_img" src="${pieData}" aria-label="Répartition interne/externe"></div></div>` : ""}

        <div class="footer">

          <span>Source : Suivi de Chantiers</span>

          <span>PDF A4 paysage</span>

        </div>

      </div>

    `);

    w.document.close();

    const targetImg = w.document.getElementById("__print_img");

    const targetPie = w.document.getElementById("__pie_img");

    let printed=false;

    const launchPrint = ()=>{

      if(printed) return;

      const readyMain = targetImg && targetImg.complete;

      const readyPie = !targetPie || targetPie.complete;

      if(!(readyMain && readyPie)) return;

      printed=true;

      w.focus();

      w.print();

      // refermer la fentre d'export aprs l'impression (ou aprs un court dlai si pas de callback)

      setTimeout(()=>{ try{ w.close(); }catch(e){} }, 800);

    };

    if(targetImg){

      if(targetImg.complete){

        launchPrint();

      }else{

        targetImg.addEventListener("load", ()=>launchPrint(), { once:true });

        // filet de secours en cas d'absence d'vnement load

        setTimeout(()=>launchPrint(),500);

      }

    }else{

      launchPrint();

    }

    if(targetPie && !targetPie.complete){

      targetPie.addEventListener("load", ()=>launchPrint(), { once:true });

    }

  };

  img.src = url;

}



function renderWorkloadChartFor(tasks, chartId, pieId, uiIds=null, stateRef=null, boundsTasks=null, autoReset=false){

  const mode = "week";

  const bounds = boundsTasks || tasks;

  syncWorkloadFilterUI(tasks, bounds, uiIds, stateRef);

  const range = getWorkloadRange(tasks, bounds, stateRef);

  let data = computeWorkloadData(tasks, mode, range.start, range.end);

  if(autoReset && tasks.length>0 && data.length===0 && stateRef){

    // reset to "all" if filter excludes all data for this project

    stateRef.type = "all";

    stateRef.start = "";

    stateRef.end = "";

    stateRef.year = "";

    syncWorkloadFilterUI(tasks, bounds, uiIds, stateRef);

    const range2 = getWorkloadRange(tasks, bounds, stateRef);

    data = computeWorkloadData(tasks, mode, range2.start, range2.end);

  }

  const svg = el(chartId);

  if(!svg) return;

  const pieSvg = pieId ? el(pieId) : null;

  const idPrefix = (chartId || "workload").replace(/[^a-zA-Z0-9_-]/g,"");

  const gradIntId = `${idPrefix}-grad-int`;

  const gradExtId = `${idPrefix}-grad-ext`;
  const gradRsgId = `${idPrefix}-grad-rsg`;

  const brushedId = `${idPrefix}-brushed`;

  const brushedBaseId = `${idPrefix}-brushed-base`;

  const barShadowId = `${idPrefix}-barShadow`;

  const w=900, h=320, m={l:60,r:24,t:44,b:64};

  const fontFamily = `"Segoe UI", Arial, sans-serif`;

  svg.setAttribute("viewBox",`0 0 ${w} ${h}`);

  svg.style.fontFamily = fontFamily;

  svg.setAttribute("font-family", fontFamily);

  svg.innerHTML="";

  if(pieSvg) pieSvg.innerHTML="";

  if(data.length===0){

    svg.innerHTML = `<text x="${w/2}" y="${h/2}" text-anchor="middle" fill="#6b7280" font-size="12">Aucune tâche date</text>`;

    if(pieSvg){

      pieSvg.setAttribute("viewBox", "0 0 720 360");

      pieSvg.innerHTML = `<text x="360" y="180" text-anchor="middle" fill="#6b7280" font-size="12">Aucune donne</text>`;

    }

    return;

  }

  const maxVal = niceMax(Math.max(...data.map(d=>d.total),1));

  const chartW = w - m.l - m.r;

  const chartH = h - m.t - m.b;

  const isDay = mode === "day";

  const groupGap = 8;

  const innerGap = 4;

  const groupW = Math.max(26, Math.min(90, (chartW / data.length) - groupGap));

  const barW = Math.max(8, (groupW - innerGap*2) / 3);

  const labelEvery = 1;

  const xStart = m.l;

  let grid="";

  const ticks=4;

  for(let i=0;i<=ticks;i++){

    const y = m.t + chartH - (i/ticks)*chartH;

    const val = Math.round((i/ticks)*maxVal);

    grid+=`<line class="wl-grid" x1="${m.l}" y1="${y}" x2="${w-m.r}" y2="${y}"></line>`;

    grid+=`<text class="wl-axis" x="${m.l-10}" y="${y+4}" text-anchor="end">${val} j</text>`;

  }

  // vertical guides

  data.forEach((d,idx)=>{

    const gx = xStart + idx*(groupW+groupGap) + groupW/2;

    grid+=`<line class="wl-grid-vert" x1="${gx}" y1="${m.t}" x2="${gx}" y2="${m.t+chartH}"></line>`;

  });



  let bars="";

  data.forEach((d,idx)=>{

    const gx = xStart + idx*(groupW+groupGap);

    const xInt = gx;
    const xExt = gx + barW + innerGap;
    const xRsg = gx + (barW + innerGap) * 2;

    let hInt = (d.internal/maxVal)*chartH;
    let hExt = (d.external/maxVal)*chartH;
    let hRsg = (d.rsgri/maxVal)*chartH;

    if(d.internal > 0 && hInt < 6) hInt = 6;
    if(d.external > 0 && hExt < 6) hExt = 6;
    if(d.rsgri > 0 && hRsg < 6) hRsg = 6;

    const yBase = m.t + chartH;

    const yInt = yBase - hInt;
    const yExt = yBase - hExt;
    const yRsg = yBase - hRsg;

    bars+=`<rect class="wl-bar-internal" fill="url(#${gradIntId})" filter="url(#${barShadowId})" x="${xInt}" y="${yInt}" width="${barW}" height="${hInt}" rx="3" ry="3"></rect>`;
    bars+=`<rect class="wl-bar-external" fill="url(#${gradExtId})" filter="url(#${barShadowId})" x="${xExt}" y="${yExt}" width="${barW}" height="${hExt}" rx="3" ry="3"></rect>`;
    bars+=`<rect class="wl-bar-rsgri" fill="url(#${gradRsgId})" filter="url(#${barShadowId})" x="${xRsg}" y="${yRsg}" width="${barW}" height="${hRsg}" rx="3" ry="3"></rect>`;

    const lbl = keyToLabel(d.key, mode);

    const lx = gx + groupW/2;

    const ly = h - m.b + 14;

    bars+=`<text class="wl-axis" x="${lx}" y="${ly}" text-anchor="middle">${lbl}</text>`;

    const valueYInt = Math.max(m.t + 12, yBase - Math.max(hInt, 0) - 8);
    const valueYExt = Math.max(m.t + 12, yBase - Math.max(hExt, 0) - 8);
    const valueYRsg = Math.max(m.t + 12, yBase - Math.max(hRsg, 0) - 8);

    bars+=`<text class="wl-value" x="${xInt + barW/2}" y="${valueYInt}" text-anchor="middle">${d.internal} j</text>`;
    bars+=`<text class="wl-value" x="${xExt + barW/2}" y="${valueYExt}" text-anchor="middle">${d.external} j</text>`;
    bars+=`<text class="wl-value" x="${xRsg + barW/2}" y="${valueYRsg}" text-anchor="middle">${d.rsgri} j</text>`;

  });

  const totalInt = data.reduce((s,d)=>s+d.internal,0);
  const totalExt = data.reduce((s,d)=>s+d.external,0);
  const totalRsg = data.reduce((s,d)=>s+d.rsgri,0);

  const totalAll = Math.max(1, totalInt + totalExt + totalRsg);

  const pctInt = Math.round((totalInt/totalAll)*100);
  const pctExt = Math.round((totalExt/totalAll)*100);
  const pctRsg = Math.max(0, 100 - pctInt - pctExt);

  const legend=`<g transform="translate(${w-240},12)">

    <rect x="0" y="0" width="12" height="12" rx="3" fill="url(#${gradIntId})"></rect>

    <text class="wl-axis" x="18" y="11">Interne ${pctInt}%</text>

    <rect x="0" y="20" width="12" height="12" rx="3" fill="url(#${gradExtId})"></rect>

    <text class="wl-axis" x="18" y="31">Externe ${pctExt}%</text>

    <rect x="0" y="40" width="12" height="12" rx="3" fill="url(#${gradRsgId})"></rect>

    <text class="wl-axis" x="18" y="51">RSG/RI ${pctRsg}%</text>

  </g>`;

  const legendOverlay = `

    <g transform="translate(${w-390},12)">

      <rect x="-6" y="-6" width="350" height="26" rx="8" ry="8" fill="rgba(255,255,255,0.92)" stroke="#e5e7eb"/>

      <rect x="0" y="0" width="12" height="12" rx="3" fill="url(#${gradIntId})"></rect>

      <text class="wl-axis" x="18" y="11">Interne ${pctInt}%</text>

      <rect x="120" y="0" width="12" height="12" rx="3" fill="url(#${gradExtId})"></rect>

      <text class="wl-axis" x="138" y="11">Externe ${pctExt}%</text>

      <rect x="240" y="0" width="12" height="12" rx="3" fill="url(#${gradRsgId})"></rect>

      <text class="wl-axis" x="258" y="11">RSG/RI ${pctRsg}%</text>

    </g>`;

  const defs = `

    <defs>

      <linearGradient id="${brushedBaseId}" x1="0" x2="1" y1="0" y2="0">

        <stop offset="0%" stop-color="#f2f3f5"/>

        <stop offset="45%" stop-color="#e3e6ea"/>

        <stop offset="65%" stop-color="#f7f8fa"/>

        <stop offset="100%" stop-color="#d9dde2"/>

      </linearGradient>

      <pattern id="${brushedId}" width="6" height="6" patternUnits="userSpaceOnUse">

        <rect width="6" height="6" fill="url(#${brushedBaseId})"/>

        <path d="M0 1 H6 M0 3 H6 M0 5 H6" stroke="#cfd3d9" stroke-width="0.4" opacity="0.45"/>

      </pattern>

      <linearGradient id="${gradIntId}" x1="0" x2="0" y1="0" y2="1">

        <stop offset="0%" stop-color="#22c55e" stop-opacity="0.98"/>

        <stop offset="55%" stop-color="#16a34a" stop-opacity="0.92"/>

        <stop offset="100%" stop-color="#15803d" stop-opacity="0.9"/>

      </linearGradient>

      <linearGradient id="${gradExtId}" x1="0" x2="0" y1="0" y2="1">

        <stop offset="0%" stop-color="#94a3b8" stop-opacity="0.98"/>

        <stop offset="55%" stop-color="#64748b" stop-opacity="0.92"/>

        <stop offset="100%" stop-color="#475569" stop-opacity="0.9"/>

      </linearGradient>
      <linearGradient id="${gradRsgId}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.98"/>
        <stop offset="55%" stop-color="#3b82f6" stop-opacity="0.92"/>
        <stop offset="100%" stop-color="#2563eb" stop-opacity="0.9"/>
      </linearGradient>

      <filter id="${barShadowId}" x="-20%" y="-20%" width="140%" height="160%">

        <feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#0b1424" flood-opacity="0.18"/>

      </filter>

    </defs>

  `;

  svg.innerHTML = `${defs}<rect class="wl-bg" x="0" y="0" width="${w}" height="${h}" fill="url(#${brushedId})"></rect><g>${grid}</g><g>${bars}</g>${legendOverlay}`;



  if(pieSvg){

    const pw=720, ph=360;

    pieSvg.setAttribute("viewBox", `0 0 ${pw} ${ph}`);

    pieSvg.style.fontFamily = fontFamily;

    pieSvg.setAttribute("font-family", fontFamily);

    const pieTotal = Math.max(1, totalInt + totalExt + totalRsg);

    const cx = pw/2;

    const cy = ph/2 - 8;

    const r = 120;

    const polar = (cx, cy, r, a)=>{

      const rad = (a - 90) * Math.PI / 180;

      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };

    };

    const arcPath = (cx, cy, r, start, end)=>{

      const s = polar(cx, cy, r, end);

      const e = polar(cx, cy, r, start);

      const large = end - start <= 180 ? 0 : 1;

      return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} Z`;

    };

    let pieMarkup = `<rect class="wl-bg" x="0" y="0" width="${pw}" height="${ph}" fill="url(#${brushedId})"></rect>`;

    if(totalInt + totalExt + totalRsg > 0){

      const gap = 8;
      const segments = [
        { key:"interne", label:"Interne", value: totalInt, pct: pctInt, grad: gradIntId },
        { key:"externe", label:"Externe", value: totalExt, pct: pctExt, grad: gradExtId },
        { key:"rsgri", label:"RSG/RI", value: totalRsg, pct: pctRsg, grad: gradRsgId },
      ].filter(s=>s.value>0);

      if(segments.length === 1){
        const s = segments[0];
        const labelPos = polar(cx, cy, r * 1.12, 90);
        pieMarkup += `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${s.grad})"></circle>
          <line x1="${cx}" y1="${cy - r * 0.95}" x2="${cx}" y2="${cy - r * 1.06}" stroke="#94a3b8" stroke-width="1" />
          <text class="wl-axis" x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle">${s.pct}%</text>
          <text class="wl-value" x="${labelPos.x}" y="${labelPos.y + 14}" text-anchor="middle">${s.value} j</text>
        `;
      }else{
        let cursor = 0;
        segments.forEach(seg=>{
          const angle = (seg.value / pieTotal) * 360;
          const startA = cursor;
          const endA = cursor + angle;
          const midA = startA + angle / 2;
          const off = polar(0,0,gap,midA);
          const path = arcPath(cx+off.x, cy+off.y, r, startA, endA);
          const innerPos = polar(cx+off.x, cy+off.y, r*0.95, midA);
          const outerPos = polar(cx+off.x, cy+off.y, r*1.12, midA);
          const anchor = outerPos.x < cx ? "end" : "start";
          pieMarkup += `
            <path d="${path}" fill="url(#${seg.grad})"></path>
            <line x1="${innerPos.x}" y1="${innerPos.y}" x2="${outerPos.x}" y2="${outerPos.y}" stroke="#94a3b8" stroke-width="1" />
            <text class="wl-axis" x="${outerPos.x}" y="${outerPos.y}" text-anchor="${anchor}">${seg.pct}%</text>
            <text class="wl-value" x="${outerPos.x}" y="${outerPos.y + 14}" text-anchor="${anchor}">${seg.value} j</text>
          `;
          cursor = endA;
        });
      }

      pieMarkup += `
        <text class="wl-axis" x="${cx}" y="${cy + r + 26}" text-anchor="middle">Répartition Interne / Externe / RSG/RI</text>
        <g transform="translate(${cx-210},${cy + r + 42})">
          <rect x="0" y="0" width="12" height="12" rx="3" fill="url(#${gradIntId})"></rect>
          <text class="wl-axis" x="18" y="11">Interne ${pctInt}%  ${totalInt} j</text>
          <rect x="150" y="0" width="12" height="12" rx="3" fill="url(#${gradExtId})"></rect>
          <text class="wl-axis" x="168" y="11">Externe ${pctExt}%  ${totalExt} j</text>
          <rect x="300" y="0" width="12" height="12" rx="3" fill="url(#${gradRsgId})"></rect>
          <text class="wl-axis" x="318" y="11">RSG/RI ${pctRsg}%  ${totalRsg} j</text>
        </g>
      `;
    }

    pieSvg.innerHTML = `${defs}${pieMarkup}`;

  }

}



function renderWorkloadChart(tasks){

  renderWorkloadChartFor(tasks, "workloadChart", "workloadPie", null, null, state.tasks || tasks, false);

}



function renderFilters(){

  const sel = el("filterProject");

  if(sel){

    let h=`<option value="">Tous</option>`;

    state.projects.forEach(p=>{ h+=`<option value="${p.id}">${p.name||"Sans nom"}</option>`; });

    sel.innerHTML=h;

  }

  const ss = el("filterStatus");

  if(ss){

    let h=`<option value="">Tous</option>`;

    sortedStatuses().forEach(s=>{ h+=`<option value="${s.v}">${s.label}</option>`; });

    ss.innerHTML=h;

  }

}



function renderTabs(){

  const tabs = el("tabs");
  const tabsMaster = el("tabsMaster");

  if(!tabs) return;

  const projectIcon = (name="")=>{

    const n=name.toLowerCase();

    if(n.includes("pastorale")) return "";

    return "";

  };

  const masterBtn = `<button class="tab tab-master ${selectedProjectId?"":"active"}" data-tab="MASTER"><span class="tab-icon"></span> Tableau maître</button>`;

  const projectsSorted = [...state.projects].sort((a,b)=>{

    // date de début minimale des tâches de chaque projet

    const aDates = state.tasks.filter(t=>t.projectId===a.id && t.start).map(t=>Date.parse(t.start));

    const bDates = state.tasks.filter(t=>t.projectId===b.id && t.start).map(t=>Date.parse(t.start));

    const aMin = aDates.length ? Math.min(...aDates) : Infinity;

    const bMin = bDates.length ? Math.min(...bDates) : Infinity;

    if(aMin!==bMin) return aMin - bMin; // plus rcent (valeur numrique plus petite) en haut

    return (a.name||"").localeCompare(b.name||"");

  });

  let h="";
  const total = projectsSorted.length || 1;
  projectsSorted.forEach((p,idx)=>{
    const hue = 0 + (120 * (idx/(total-1 || 1))); // rouge -> vert
    h+=`<button class="tab ${selectedProjectId===p.id?"active":""}" data-tab="${p.id}" style="--tab-hue:${hue};"><span>${p.name||"Projet"}</span><span class="tab-close" data-close="${p.id}" aria-label="Supprimer le projet"></span></button>`;
  });

  if(tabsMaster){ tabsMaster.innerHTML = masterBtn; }
  tabs.innerHTML=h;

  const allTabs = [
    ...(tabsMaster ? Array.from(tabsMaster.querySelectorAll("button")) : []),
    ...Array.from(tabs.querySelectorAll("button"))
  ];
  allTabs.forEach(btn=>{
    btn.onclick=()=>{
      const tab=btn.dataset.tab;
      if(tab==="MASTER"){ navigateTo(null, null, true); }
      else { navigateTo(tab, null, true); }
    };
  });
  tabs.querySelectorAll(".tab-close").forEach(close=>{

    close.onclick=(e)=>{

      e.stopPropagation();

      if(isLocked) return;

      const pid = close.dataset.close;

      if(!pid) return;

      const name = state.projects.find(p=>p.id===pid)?.name || "ce projet";

      if(!confirm(`Supprimer définitivement ${name} et toutes ses tâches ?`)) return;

      state.projects = state.projects.filter(p=>p.id!==pid);

      state.tasks    = state.tasks.filter(t=>t.projectId!==pid);

      if(selectedProjectId===pid) { selectedProjectId=null; selectedTaskId=null; }

      saveState();

      renderAll();

      el("btnNewTask")?.classList.remove("btn-armed");

    };

  });

}



function renderKPIs(tasks){

  const box = el("kpis");

  if(!box) return;

  const total=tasks.length;

  const byStatus={};

  tasks.forEach(t=>{ byStatus[t.status]= (byStatus[t.status]||0)+1; });

  let h=`<div class="kpi">Total: <b>${total}</b></div>`;

  STATUSES.forEach(s=>{

    h+=`<div class="kpi">${s.label}: <b>${byStatus[s.v]||0}</b></div>`;

  });

  box.innerHTML=h;

}



// Tri gnrique pour tableaux (master & projet)

function sortTasks(list, cfg){

  if(!cfg) return [...list];

  const dir = cfg.dir==="desc" ? -1 : 1;

  const get = (t)=>{

    switch(cfg.key){

      case "site": {

        const p = state.projects.find(x=>x.id===t.projectId);

        return (p?.site||"").toLowerCase();

      }

      case "project": {

        const p = state.projects.find(x=>x.id===t.projectId);

        return (p?.name||"").toLowerCase();

      }

      case "task": return (taskTitle(t)||"").toLowerCase();

      case "status": return (parseStatuses(t.status)[0]||"").toLowerCase();

      case "start": return Date.parse(t.start||"9999-12-31");

      case "end": return Date.parse(t.end||"9999-12-31");

      case "owner": return (t.owner||"").toLowerCase();

      case "duration": return durationDays(t.start,t.end);

      case "num": return taskOrderMap[t.id]||9999;

      default: return 0;

    }

  };

  return [...list].sort((a,b)=>{

    const va=get(a), vb=get(b);

    if(va<vb) return -1*dir;

    if(va>vb) return 1*dir;

    return 0;

  });

}



function updateSortIndicators(tableId, cfg){

  const table = el(tableId);

  if(!table) return;

  table.querySelectorAll("th[data-sort]").forEach(th=>{

    th.classList.remove("sorted-asc","sorted-desc");

    if(th.dataset.sort === cfg.key){

      th.classList.add(cfg.dir==="desc" ? "sorted-desc" : "sorted-asc");

    }

  });

}



function renderMasterMetrics(tasks){

  const metrics = el("masterMetrics");

  if(!metrics) return;

  const dated = tasks.filter(t=>t.start && t.end);

  if(dated.length===0){

    metrics.innerHTML="";

    return;

  }

  const allDays = new Set();

  const internalDays = new Set();
  const externalDays = new Set();
  const rsgDays = new Set();

  dated.forEach(t=>{

    const s=new Date(t.start+"T00:00:00");

    const e=new Date(t.end+"T00:00:00");

    if(isNaN(s)||isNaN(e)||e<s) return;

    const typ = ownerType(t.owner);
    const ownsInternal = typ === "interne";
    const ownsExternal = typ === "externe" || typ === "inconnu";
    const ownsRsg = typ === "rsgri";

    for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)){

      const key=d.toISOString().slice(0,10);

      allDays.add(key);

      if(ownsInternal) internalDays.add(key);
      if(ownsExternal) externalDays.add(key);
      if(ownsRsg) rsgDays.add(key);

    }

  });

  const totalDays = allDays.size;

  const internalHours = internalDays.size * 4;
  const externalHours = externalDays.size * 4;
  const rsgHours = rsgDays.size * 2;
  const totalHours = internalHours + externalHours + rsgHours;

  metrics.innerHTML = `

    <span class="panel-chip">Durée totale : <span class="metric-val">${totalDays||0} j</span></span>

    <span class="panel-chip">Éq. heures (Int/Ext 4h/j • RSG/RI 2h/j) : <span class="metric-val">${totalHours||0} h</span></span>

    <span class="panel-chip" style="background:#0f172a;color:#fff;border-color:#0f172a;">Interne : <span class="metric-val">${internalDays.size||0} j</span> <span class="metric-val">${internalHours||0} h</span></span>

    <span class="panel-chip" style="background:#b45309;color:#fff;border-color:#b45309;">Externe : <span class="metric-val">${externalDays.size||0} j</span> <span class="metric-val">${externalHours||0} h</span></span>
    <span class="panel-chip" style="background:#2563eb;color:#fff;border-color:#2563eb;">RSG/RI : <span class="metric-val">${rsgDays.size||0} j</span> <span class="metric-val">${rsgHours||0} h</span></span>

  `;

}



function filteredTasks(){

  const fp = el("filterProject")?.value || "";

  const fs = el("filterStatus")?.value || "";

  const q  = (el("filterSearch")?.value || "").toLowerCase().trim();

  const startAfter = el("filterStartAfter")?.value || "";

  const endBefore  = el("filterEndBefore")?.value || "";

  const result = state.tasks.filter(t=>{

    if(fp && t.projectId!==fp) return false;

    if(fs && !parseStatuses(t.status).includes(fs)) return false;

    const p = state.projects.find(x=>x.id===t.projectId);

    if(q){

      const hay=(taskTitle(t)+" "+(p?.name||"")+" "+(p?.site||"")+" "+(t.owner||"")+" "+parseStatuses(t.status).join(" ")).toLowerCase();

      if(!hay.includes(q)) return false;

    }

    if(startAfter && (!t.start || t.start < startAfter)) return false;

    if(endBefore && (!t.end || t.end > endBefore)) return false;

    return true;

  });

  // Filet de secours : si les filtres vident tout alors qu'on a des donnes, on retourne toutes les tâches

  if(result.length===0 && state.tasks.length>0) return state.tasks;

  return result;

}



function updateBadge(node, active, textActive="Tri/filtre actif", textInactive="Tri par défaut"){

  if(!node) return;

  node.textContent = active ? textActive : textInactive;

  node.classList.toggle("inactive", !active);

}



function filtersActive(){

  const fp = el("filterProject")?.value || "";

  const fs = el("filterStatus")?.value || "";

  const q  = (el("filterSearch")?.value || "").trim();

  const startAfter = el("filterStartAfter")?.value || "";

  const endBefore  = el("filterEndBefore")?.value || "";

  return !!(fp || fs || q || startAfter || endBefore);

}



function renderMaster(){
  computeTaskOrderMap();
  renderTabs();
  closeAllOverlays();
  el("viewMaster")?.classList.remove("hidden");
  el("viewProject")?.classList.add("hidden");

  const tbody = el("masterTable")?.querySelector("tbody");

  if(!tbody) return;

  const tasks = filteredTasks();

  renderKPIs(tasks);

  renderMasterMetrics(tasks);

  // Charge de travail

  renderWorkloadChart(filteredTasks());

  // Bandeau live global (toutes tâches en cours aujourd'hui)

  const masterLive = el("masterLive");

  if(masterLive){

    const todayKey = new Date().toISOString().slice(0,10);

    const inProgress = tasks

      .filter(t=>t.start && t.end && t.start<=todayKey && t.end>=todayKey)

      .sort((a,b)=> (taskOrderMap[a.id]||999)-(taskOrderMap[b.id]||999));

    if(inProgress.length===0){

      masterLive.innerHTML = `<span class="live-title">Projet non démarré</span>`;

    }else{

      const badges = inProgress.map(t=>{

        const num = taskOrderMap[t.id]||"";

        const status = parseStatuses(t.status)[0] || "";

        const color = ownerColor(t.owner);

        const label = STATUSES.find(s=>s.v===status)?.label || status || "En cours";

        const proj = state.projects.find(x=>x.id===t.projectId);

        const projName = proj?.name || "Projet";

        return `<span class="live-item"><span class="num-badge" style="--badge-color:${color};--badge-text:#fff;">${num}</span> ${projName}  ${label}</span>`;

      }).join(" ");

      masterLive.innerHTML = `<span class="live-title">Projet démarré  Tâches en cours :</span> ${badges}`;

    }

  }

  const sorted = sortTasks(tasks, sortMaster);
  const todayKey = new Date().toISOString().slice(0,10);

  if(sorted.length===0){

    tbody.innerHTML="<tr><td colspan='8' class='empty-row'>Aucune tâche.</td></tr>";

    return;

  }

  let h="";

  sorted.forEach(t=>{

    const p = state.projects.find(x=>x.id===t.projectId);

    const statuses = parseStatuses(t.status).map(v=>v.toUpperCase());

    const c = ownerColor(t.owner);

    const rowBg = siteColor(p?.site);

    const isToday = !!(t.start && t.end && t.start<=todayKey && t.end>=todayKey);
    const isLate = !!(t.end && t.end < todayKey);
    const rowClass = `${isToday ? "today-row " : ""}${isLate ? "late-row" : ""}`.trim();
    h+=`<tr class="${rowClass}" data-project="${t.projectId}" data-task="${t.id}" style="--site-bg:${rowBg};background:var(--site-bg);">

      <td>${p?.site||""}</td>

      <td>${p?.name||"Sans projet"}</td>

      <td><span class="num-badge" style="--badge-color:${c};--badge-text:#fff;">${taskOrderMap[t.id]||""}</span> <span class="icon-picto"></span> ${taskTitle(t)}</td>

      <td class="status-cell"><span class="status-left">${statusDot(statuses[0])}${statusLabels(t.status||"")}</span>${t.owner?ownerBadge(t.owner):""}</td>

      <td>${formatDate(t.start)||""}${isToday ? `<span class="today-dot" title="En cours aujourd'hui"></span>` : ""}</td>

      <td>${formatDate(t.end)||""}</td>

      <td>${t.owner||""}</td>

      <td>${durationDays(t.start,t.end)}</td>

    </tr>`;

  });

  tbody.innerHTML=h;



  // Gantt global sous le tableau maître

  renderMasterGantt();

  updateSortIndicators("masterTable", sortMaster);

  const fb = el("filtersBadge");

  if(fb){

    const active = filtersActive() || sortMaster.key!=="start" || sortMaster.dir!=="asc";

    updateBadge(fb, active, "Tri/filtre actif", "Tri par défaut");

  }
  const siteBadge = el("siteBadge");
  if(siteBadge){
    const fp = el("filterProject")?.value || "";
    if(fp){
      const proj = state.projects.find(p=>p.id===fp);
      const site = (proj?.site || "").trim();
      if(site){
        siteBadge.textContent = `Site actif : ${site}`;
        siteBadge.style.display = "inline-flex";
      }else{
        siteBadge.style.display = "none";
      }
    }else{
      siteBadge.style.display = "none";
    }
  }

}



function renderProject(){
  computeTaskOrderMap();
  renderTabs();
  closeAllOverlays();
  const p=state.projects.find(x=>x.id===selectedProjectId);
  if(!p){ selectedProjectId=null; renderMaster(); return; }

  el("viewMaster")?.classList.add("hidden");

  el("viewProject")?.classList.remove("hidden");

  el("projectTitle").textContent = `Projet : ${p.name||"Sans nom"}`;

  el("projectSub").textContent = p.site || "Détails • Gantt";
  updateSitePhoto(p.site || "");

  const projectSummary = el("projectSummary");
  if(projectSummary){
    const tasksAll = state.tasks.filter(t=>t.projectId===p.id);
    const tasksDated = tasksAll.filter(t=>t.start && t.end);
    const todayKey = new Date().toISOString().slice(0,10);
    const inProgress = tasksDated.filter(t=>t.start<=todayKey && t.end>=todayKey).length;
    const minStart = tasksDated.length ? tasksDated.map(t=>t.start).sort()[0] : "";
    const maxEnd = tasksDated.length ? tasksDated.map(t=>t.end).sort().slice(-1)[0] : "";
    const endLabel = maxEnd ? formatDate(maxEnd) : "—";
    const isFinished = !!(maxEnd && maxEnd < todayKey);
    const finishedLabel = isFinished ? " • Projet terminé" : "";
    projectSummary.textContent = `Résumé : ${tasksAll.length} tâches • ${inProgress} en cours • Fin prévue : ${endLabel}${finishedLabel}`;
  }

  // métriques projet : durée totale + équivalent heures (6h/j)

  const projTasks = state.tasks.filter(t=>t.projectId===p.id && t.start && t.end);

  const allDays = new Set();

  const internalDays = new Set();
  const externalDays = new Set();
  const rsgDays = new Set();

  projTasks.forEach(t=>{

    const s=new Date(t.start+"T00:00:00");

    const e=new Date(t.end+"T00:00:00");

    if(isNaN(s)||isNaN(e) || e<s) return;

    const typ = ownerType(t.owner);
    const ownsInternal = typ === "interne";
    const ownsExternal = typ === "externe" || typ === "inconnu";
    const ownsRsg = typ === "rsgri";

    for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)){

      const key=d.toISOString().slice(0,10);

      allDays.add(key);

      if(ownsInternal) internalDays.add(key);
      if(ownsExternal) externalDays.add(key);
      if(ownsRsg) rsgDays.add(key);

    }

  });

  const totalDays = allDays.size;

  const internalHours = internalDays.size * 4;
  const externalHours = externalDays.size * 4;
  const rsgHours = rsgDays.size * 2;
  const totalHours = internalHours + externalHours + rsgHours;

  const metrics = el("projectMetrics");

  if(metrics){

    metrics.innerHTML = `

      <span class="panel-chip">Durée totale : <span class="metric-val">${totalDays || 0} j</span></span>

      <span class="panel-chip">Éq. heures (Int/Ext 4h/j • RSG/RI 2h/j) : <span class="metric-val">${totalHours || 0} h</span></span>

      <span class="panel-chip" style="background:#0f172a;color:#fff;border-color:#0f172a;">Interne : <span class="metric-val">${internalDays.size||0} j</span> <span class="metric-val">${internalHours||0} h</span></span>

      <span class="panel-chip" style="background:#b45309;color:#fff;border-color:#b45309;">Externe : <span class="metric-val">${externalDays.size||0} j</span> <span class="metric-val">${externalHours||0} h</span></span>
      <span class="panel-chip" style="background:#2563eb;color:#fff;border-color:#2563eb;">RSG/RI : <span class="metric-val">${rsgDays.size||0} j</span> <span class="metric-val">${rsgHours||0} h</span></span>

    `;

  }



  // Bandeau live : tâches en cours  la date du jour

  const live = el("projectLive");

  if(live){

    const todayKey = new Date().toISOString().slice(0,10);

    const inProgress = state.tasks

      .filter(t=>t.projectId===p.id && t.start && t.end && t.start<=todayKey && t.end>=todayKey)

      .sort((a,b)=> (taskOrderMap[a.id]||999)-(taskOrderMap[b.id]||999));

    if(inProgress.length===0){

      live.innerHTML = `<span class="live-title">Projet non démarré</span>`;

    }else{

      const badges = inProgress.map(t=>{

        const num = taskOrderMap[t.id]||"";

        const status = parseStatuses(t.status)[0] || "";

        const color = ownerColor(t.owner);

        const label = STATUSES.find(s=>s.v===status)?.label || status || "En cours";

        const projName = p.name || "Projet";

        return `<span class="live-item"><span class="num-badge" style="--badge-color:${color};--badge-text:#fff;">${num}</span> ${projName}  ${label}</span>`;

      }).join(" ");

      live.innerHTML = `<span class="live-title">Projet démarré  Tâches en cours :</span> ${badges}`;

    }

  }

  el("p_name").value=p.name||"";

  el("p_subproject").value=p.subproject||"";

  const siteSelect = el("p_site");
  if(siteSelect){
    const sites = ["CDM","Collège","École","LGT","NDC"].sort((a,b)=>a.localeCompare(b, "fr"));
    siteSelect.innerHTML = sites.map(s=>`<option value="${s}">${s}</option>`).join("");
    siteSelect.value = p.site || "";
    if(!siteSelect.value && p.site){ siteSelect.value = p.site; }
    const syncPhoto = () => updateSitePhoto(siteSelect.value);
    siteSelect.onchange = syncPhoto;
    siteSelect.oninput = syncPhoto;
    updateSitePhoto(siteSelect.value || p.site || "");
  }
  const constraintsInput = el("p_constraints");
  if(constraintsInput){
    constraintsInput.value = p.constraints||"";
  }



  let t=null;

  if(selectedTaskId){

    t = state.tasks.find(x=>x.id===selectedTaskId && x.projectId===p.id) || null;

  }

  if(!t){

    t = state.tasks.find(x=>x.projectId===p.id) || null;

  }

  selectedTaskId = t?.id || null;

  const badge = el("t_num_badge");

  if(badge){

    const num = selectedTaskId ? (taskOrderMap[selectedTaskId] || "") : "";

    badge.textContent = num;

    badge.style.display = num ? "inline-flex" : "none";

  }

  if(!selectedTaskId){

    el("btnNewTask")?.classList.add("btn-armed");

  }else{

    el("btnNewTask")?.classList.remove("btn-armed");

  }



  if(t){

    const desc = (t.roomNumber && t.roomNumber.trim()) || p.subproject || "";

    el("t_room").value=desc;

    el("t_owner").value=t.owner||"";

    el("t_vendor").value=t.vendor||"";

    const startVal = toInputDate(t.start);
    const endVal = toInputDate(t.end);
    el("t_start").value=startVal;

    el("t_end").value=endVal;
    if(window.__fpStart){ try{ window.__fpStart.setDate(startVal || null, true, "Y-m-d"); }catch(e){} }
    if(window.__fpEnd){ try{ window.__fpEnd.setDate(endVal || null, true, "Y-m-d"); }catch(e){} }

    setStatusSelection(t.status||"");

  }else{

    el("t_room").value=""; el("t_owner").value=""; el("t_vendor").value=""; el("t_start").value=""; el("t_end").value="";
    if(window.__fpStart){ try{ window.__fpStart.setDate(null); }catch(e){} }
    if(window.__fpEnd){ try{ window.__fpEnd.setDate(null); }catch(e){} }

    setStatusSelection("");

  }



  renderGantt(p.id);

  renderProjectTasks(p.id);

  const projectTasks = state.tasks.filter(t=>t.projectId===p.id);

  const projRange = {type:workloadRangeTypeProject, year:workloadRangeYearProject, start:workloadRangeStartProject, end:workloadRangeEndProject};

  renderWorkloadChartFor(

    projectTasks,

    "workloadChartProject",

    "workloadPieProject",

    {type:"workloadRangeTypeProject", year:"workloadRangeYearProject", start:"workloadRangeStartProject", end:"workloadRangeEndProject"},

    projRange,

    projectTasks,

    true

  );

  workloadRangeTypeProject = projRange.type;

  workloadRangeYearProject = projRange.year;

  workloadRangeStartProject = projRange.start;

  workloadRangeEndProject = projRange.end;

  refreshVendorsList();

  refreshDescriptionsList();

}



function renderAll(){
  // filet de sécurité : si localStorage est vide (ex : fichier ouvert en navigation privée), on recharge l'état par défaut
  if(!state || !Array.isArray(state.projects) || state.projects.length===0){
    state = defaultState();
  }
  closeAllOverlays();
  refreshVendorsList();
  refreshDescriptionsList();
  // rinitialiser les filtres visibles pour éviter un filtrage bloquant

  ["filterProject","filterStatus","filterSearch","filterStartAfter","filterEndBefore"].forEach(id=>{

    const n=el(id);

    if(n) n.value="";

  });

  renderFilters();

  renderTabs();

  if(selectedProjectId) renderProject();

  else renderMaster();

  updateSidebarTop();
  updateSidebarScrollState();

  applySidebarTopLock();

}



function bind(){

  buildStatusMenu();

  setStatusSelection("");

  el("t_status_display")?.addEventListener("click",(e)=>{ e.stopPropagation(); toggleStatusMenu(true); });

  document.addEventListener("click",(e)=>{

    const wrap = el("t_status_wrap");

    if(wrap && !wrap.contains(e.target)){ toggleStatusMenu(false); }

  });



  updateTopbarHeight();
  updateSidebarTop();
  applySidebarTopLock();
  setLockState(isLocked);
  initThemePicker();
  const switchBtn = el("btnSwitchUser");
  if(switchBtn){
    switchBtn.addEventListener("click", ()=>{
      try{
        sessionStorage.removeItem("unlocked");
        sessionStorage.removeItem("current_user");
        sessionStorage.removeItem("current_role");
      }catch(e){}
      const lock = document.getElementById("lockscreen");
      if(lock) lock.classList.remove("hidden");
      setLockState(true);
      try{ window.refreshLoginUsers?.(); }catch(e){}
    });
  }
  window.addEventListener("resize", ()=>{
    updateTopbarHeight();
    updateSidebarTop();
    applySidebarTopLock();
  });
  el("btnConfig")?.addEventListener("click", ()=>{
    if(isLocked) return;
    openConfigModal();
  });
  el("btnConfigSave")?.addEventListener("click", ()=>{
    const cfg = {
      name: el("cfg_name")?.value || "",
      http: el("cfg_http")?.value || "",
      front: el("cfg_front")?.value || "",
      back: el("cfg_back")?.value || ""
    };
    saveConfig(cfg);
    closeConfigModal();
  });
  el("btnUserAdd")?.addEventListener("click", async ()=>{
    const name = (el("cfg_user_name")?.value || "").trim();
    const email = (el("cfg_user_email")?.value || "").trim();
    const role = el("cfg_user_role")?.value || "user";
    const pass = el("cfg_user_pass")?.value || "";
    if(!name || !pass){ alert("Nom et mot de passe requis."); return; }
    const users = loadUsers();
    if(users.some(u=>u.name.toLowerCase()===name.toLowerCase())){
      alert("Utilisateur dj existant."); return;
    }
    if(email && users.some(u=>(u.email||"").toLowerCase()===email.toLowerCase())){
      alert("Email dj existant."); return;
    }
    const hash = await hashPassword(pass);
    users.push({name, email, role, hash, theme:"sable"});
    saveUsers(users);
    el("cfg_user_name").value = "";
    el("cfg_user_email").value = "";
    el("cfg_user_pass").value = "";
    renderUsersList();
  });
  el("btnConfigClose")?.addEventListener("click", ()=> closeConfigModal());
  el("configModal")?.addEventListener("click",(e)=>{
    if(e.target && e.target.id==="configModal") closeConfigModal();
  });
  el("btnSave")?.addEventListener("click", ()=>{
    if(isLocked) return;
    saveState();
    try{ saveUsersToSupabase(loadUsers()); }catch(e){}
    // Flux simple : tlchargement d'un JSON  craser manuellement dans le dossier projet.
    downloadBackup();
    flashSaved();

    renderAll();

    el("btnNewTask")?.classList.remove("btn-armed");

  });

  // bouton impression PDF (utilise print.css)

  el("btnBack")?.addEventListener("click", ()=>{

    selectedProjectId=null; selectedTaskId=null;

    renderAll();

  });

  el("btnProjectExport")?.addEventListener("click", (e)=>{

    e.preventDefault();

    if(typeof openExportProjectModal === "function") openExportProjectModal();

  });

  el("btnExportMaster")?.addEventListener("click", (e)=>{

    e.preventDefault();

    if(typeof openExportMasterModal === "function") openExportMasterModal();

  });

  el("workloadRangeType")?.addEventListener("change", ()=>{

    workloadRangeType = el("workloadRangeType")?.value || "all";

    renderWorkloadChart(filteredTasks());

  });

  el("workloadRangeYear")?.addEventListener("change", ()=>{

    workloadRangeYear = el("workloadRangeYear")?.value || "";

    renderWorkloadChart(filteredTasks());

  });

  el("workloadRangeStart")?.addEventListener("change", ()=>{

    workloadRangeStart = el("workloadRangeStart")?.value || "";

    renderWorkloadChart(filteredTasks());

  });

  el("workloadRangeEnd")?.addEventListener("change", ()=>{

    workloadRangeEnd = el("workloadRangeEnd")?.value || "";

    renderWorkloadChart(filteredTasks());

  });

  el("workloadRangeTypeProject")?.addEventListener("change", ()=>{

    workloadRangeTypeProject = el("workloadRangeTypeProject")?.value || "all";

    if(selectedProjectId) renderProject();

  });

  el("workloadRangeYearProject")?.addEventListener("change", ()=>{

    workloadRangeYearProject = el("workloadRangeYearProject")?.value || "";

    if(selectedProjectId) renderProject();

  });

  el("workloadRangeStartProject")?.addEventListener("change", ()=>{

    workloadRangeStartProject = el("workloadRangeStartProject")?.value || "";

    if(selectedProjectId) renderProject();

  });

  el("workloadRangeEndProject")?.addEventListener("change", ()=>{

    workloadRangeEndProject = el("workloadRangeEndProject")?.value || "";

    if(selectedProjectId) renderProject();

  });

  el("btnExportWorkload")?.addEventListener("click", ()=>{

    exportSvgToPdf("workloadChart","Charge de travail", "workloadPie", filteredTasks());

  });

  el("btnExportWorkloadProject")?.addEventListener("click", ()=>{

    if(!selectedProjectId) return;

    const projectTasks = state.tasks.filter(t=>t.projectId===selectedProjectId);

    exportSvgToPdf("workloadChartProject","Charge de travail (projet)", "workloadPieProject", projectTasks);

  });

  el("btnToggleMasterVendor")?.addEventListener("click", ()=>{

    ganttColVisibility.masterVendor = !ganttColVisibility.masterVendor;

    applyGanttColumnVisibility();

  });

  el("btnToggleMasterStatus")?.addEventListener("click", ()=>{

    ganttColVisibility.masterStatus = !ganttColVisibility.masterStatus;

    applyGanttColumnVisibility();

  });

  el("btnToggleProjectVendor")?.addEventListener("click", ()=>{

    ganttColVisibility.projectVendor = !ganttColVisibility.projectVendor;

    applyGanttColumnVisibility();

  });

  el("btnToggleProjectStatus")?.addEventListener("click", ()=>{

    ganttColVisibility.projectStatus = !ganttColVisibility.projectStatus;

    applyGanttColumnVisibility();

  });

  const modal = el("exportProjectModal");

  const btnNo = el("btnExportNoCharts");

  const btnYes = el("btnExportWithCharts");

  if(modal && btnNo && btnYes){

    const closeModal = ()=>{

      modal.classList.add("hidden");

      modal.style.display="none";

      modal.setAttribute("aria-hidden","true");

    };

    btnNo.onclick = ()=>{

      closeModal();

      preparePrint({includeGraphs:false});

      window.print();

    };

    btnYes.onclick = ()=>{

      closeModal();

      preparePrint({includeGraphs:true});

      window.print();

    };

    modal.addEventListener("click",(e)=>{

      if(e.target===modal) closeModal();

    });

  }

  const masterModal = el("exportMasterModal");

  const btnMNo = el("btnExportMasterNoCharts");

  const btnMYes = el("btnExportMasterWithCharts");

  if(masterModal && btnMNo && btnMYes){

    const closeMaster = ()=>{

      masterModal.classList.add("hidden");

      masterModal.style.display="none";

      masterModal.setAttribute("aria-hidden","true");

    };

    btnMNo.onclick = ()=>{

      closeMaster();

      selectedProjectId = null;

      preparePrint({includeGraphs:false});

      window.print();

    };

    btnMYes.onclick = ()=>{

      closeMaster();

      selectedProjectId = null;

      preparePrint({includeGraphs:true});

      window.print();

    };

    masterModal.addEventListener("click",(e)=>{

      if(e.target===masterModal) closeMaster();

    });

  }

  el("btnAddProject")?.addEventListener("click", ()=>{

    if(isLocked) return;

    const id = uid();

    const name = "Nouveau projet";

    state.projects.push({id,name,site:"",constraints:"",subproject:""});

    selectedProjectId = id;

    selectedTaskId = null;

    markDirty();

    renderAll();

  });

  el("btnSaveProject")?.addEventListener("click", ()=>{

    if(isLocked) return;

    if(!selectedProjectId) return;

    const p = state.projects.find(x=>x.id===selectedProjectId);

    if(!p) return;

    p.name        = el("p_name").value.trim();

    p.subproject  = el("p_subproject").value.trim();

    const siteSelect = el("p_site");
    p.site        = siteSelect ? siteSelect.value.trim() : "";
    const constraintsInput = el("p_constraints");
    p.constraints = constraintsInput ? constraintsInput.value.trim() : (p.constraints||"");

    renderTabs();

    markDirty();

    renderProject();

  });

  el("btnDeleteProject")?.addEventListener("click", ()=>{

    if(isLocked) return;

    if(!selectedProjectId) return;

    if(!confirm("Supprimer ce projet et toutes ses tâches ? Cette action est définitive.")) return;

    state.projects = state.projects.filter(p=>p.id!==selectedProjectId);

    state.tasks    = state.tasks.filter(t=>t.projectId!==selectedProjectId);

    selectedProjectId=null;

    selectedTaskId=null;

    markDirty();

    renderAll();

  });

  el("btnAddTask")?.addEventListener("click", ()=>{

    if(isLocked) return;

    if(!selectedProjectId) return;

    const id=uid();

    state.tasks.push({id,projectId:selectedProjectId,roomNumber:"",status:"",owner:"",vendor:"",start:"",end:"",notes:""});

    selectedTaskId=id;

    markDirty();

    renderProject();

  });

  el("btnNewTask")?.addEventListener("click", ()=>{

    if(isLocked) return;

    // Nouvelle tâche : vider tous les champs, pré-remplir uniquement la date de début (aujourd'hui)

    selectedTaskId=null;

    el("btnNewTask")?.classList.add("btn-armed");

    const todayVal = toInputDate(new Date());
    const tRoom = el("t_room"); if(tRoom) tRoom.value = "";
    const tOwner = el("t_owner"); if(tOwner) tOwner.value = "";
    const tVendor = el("t_vendor"); if(tVendor) tVendor.value = "";
    const tStart = el("t_start"); if(tStart) tStart.value = todayVal;
    const tEnd = el("t_end"); if(tEnd) tEnd.value = "";
    if(window.__fpStart){ try{ window.__fpStart.setDate(todayVal || null, true, "Y-m-d"); }catch(e){} }
    if(window.__fpEnd){ try{ window.__fpEnd.setDate(null, true, "Y-m-d"); }catch(e){} }

    setStatusSelection("");

  });

  el("btnDeleteTask")?.addEventListener("click", ()=>{

    if(isLocked) return;

    if(!selectedProjectId || !selectedTaskId) return;

    if(!confirm("Supprimer cette tâche ?")) return;

    state.tasks = state.tasks.filter(t=> !(t.id===selectedTaskId && t.projectId===selectedProjectId));

    selectedTaskId = null;

    markDirty();

    renderProject();

    el("btnNewTask")?.classList.remove("btn-armed");

  });

  el("btnSaveTask")?.addEventListener("click", ()=>{

    if(isLocked) return;

    if(!selectedProjectId) return;

    let t = state.tasks.find(x=>x.id===selectedTaskId && x.projectId===selectedProjectId);

    if(!t){

      const id=uid();

      t={id,projectId:selectedProjectId}; state.tasks.push(t); selectedTaskId=id;

    }

    t.roomNumber = el("t_room").value.trim();

    t.owner      = el("t_owner").value;

    t.vendor     = el("t_vendor").value.trim();

    t.start      = unformatDate(el("t_start").value);

    t.end        = unformatDate(el("t_end").value);

    if(t.end && t.start && t.end < t.start){

      t.end = t.start;

      el("t_end").value = formatDate(t.start);

      console.warn("Date de fin ajustée  la date de début pour éviter une fin antérieure.");

    }

    updateTaskDatesWarning();

    t.status     = Array.from(selectedStatusSet).join(",");

    markDirty();

    renderProject();

    refreshVendorsList();

    refreshDescriptionsList();

  });

  ["filterProject","filterStatus","filterSearch","filterStartAfter","filterEndBefore"].forEach(id=>{

    const n=el(id); 

    if(n) n.addEventListener("input", ()=>{ renderMaster(); saveUIState(); markDirty(); });

  });

  setupVendorPicker();

  setupDescriptionPicker();

  // Affichage date du jour + copyright

  const brandSub = el("brandSub");

  if(brandSub){

    const today = new Date();

    const fmt = today.toLocaleDateString("fr-FR",{weekday:"long", day:"2-digit", month:"long", year:"numeric"});

    brandSub.innerHTML = `Tableau maître  Projets  Gantt  Exports locaux  <span class="brand-date">${fmt}</span>`;

  }

  const brandTitle = el("brandTitle");

  if(brandTitle){

    brandTitle.innerHTML = `Suivi de Chantiers <span class="copyright"> Sébastien DUC</span>`;

  }

  // flatpickr sur les dates, week-ends interdits

  const fpOpts = {

    dateFormat:"Y-m-d",

    altInput:true,

    altFormat:"d/m/Y",

    allowInput:true,

    locale:"fr",

    disable:[ function(date){ const d=date.getDay(); return d===0 || d===6; } ]

  };

  let fpStart=null, fpEnd=null;

  if(window.flatpickr){

    const startNode = el("t_start");

    const endNode   = el("t_end");

    const todayIso = new Date().toISOString().slice(0,10);

    const startIso = startNode?.value ? toInputDate(startNode.value) : "";

    const endIso   = endNode?.value ? toInputDate(endNode.value) : "";

    if(startNode){

      fpStart = window.flatpickr(startNode, {...fpOpts,

        defaultDate: startIso || todayIso,

        onOpen: (_s,_d,inst)=>{ inst.jumpToDate(startIso || todayIso); },

        onChange:(selectedDates, dateStr)=>{
          if(fpEnd) fpEnd.set("minDate", dateStr || null);
          if(endNode && dateStr){
            const startVal = startNode.value;
            const endVal = endNode.value;
            if(startVal && (!endVal || unformatDate(endVal) < unformatDate(startVal))){
              endNode.value = startVal;
            }
          }
          updateTaskDatesWarning();
        }
      });
      window.__fpStart = fpStart;

    }

    if(endNode){

      fpEnd = window.flatpickr(endNode, {...fpOpts,
        defaultDate: endIso || startIso || todayIso,
        minDate: startIso || null,
        onOpen: (_s,_d,inst)=>{ const target = startIso || endIso || todayIso; inst.jumpToDate(target); },
        onChange:()=>{ updateTaskDatesWarning(); }
      });
      window.__fpEnd = fpEnd;
    }
    updateTaskDatesWarning();
    ["filterStartAfter","filterEndBefore"].forEach(id=>{
      const node=el(id);

      if(node) window.flatpickr(node, fpOpts);

    });

  }

  // repositionnement des dropdowns flottants

  window.addEventListener("resize", ()=>{

    floatingMap.forEach((anchor, el)=> positionFloating(el, anchor));

  });

  window.addEventListener("scroll", ()=>{

    floatingMap.forEach((anchor, el)=> positionFloating(el, anchor));

  }, true);



  // Repositionnement du menu multiselect en fixed (pour qu'il reste au-dessus)

  const statusMenu = el("t_status_menu");

  const statusDisplay = el("t_status_display");

  if(statusMenu && statusDisplay){

    let portal = null;

    const ensurePortal = ()=>{

      if(portal) return portal;

      portal = document.createElement("div");

      portal.style.position="fixed";

      portal.style.zIndex="1000000";

      portal.style.left="0";

      portal.style.top="0";

      document.body.appendChild(portal);

      return portal;

    };

    const placeMenu = ()=>{

      const rect = statusDisplay.getBoundingClientRect();

      const p = ensurePortal();

      p.style.width = `${rect.width}px`;

      p.style.left = `${rect.left}px`;

      p.style.top = `${rect.bottom + 4}px`;

      statusMenu.style.width = `${rect.width}px`;

    };

    const openMenu = ()=>{

      placeMenu();

      const p = ensurePortal();

      p.appendChild(statusMenu);

      statusMenu.classList.remove("hidden");

      statusDisplay.classList.add("focus");

    };

    const closeMenu = ()=>{

      statusMenu.classList.add("hidden");

      statusDisplay.appendChild(statusMenu);

      statusDisplay.classList.remove("focus");

    };

    statusDisplay.addEventListener("click",(e)=>{ e.stopPropagation(); openMenu(); });

    document.addEventListener("click",(e)=>{

      if(!statusDisplay.contains(e.target) && !statusMenu.contains(e.target)){

        closeMenu();

      }

    });

    window.addEventListener("resize", placeMenu);

    window.addEventListener("scroll", placeMenu, true);

  }

  el("masterTable")?.addEventListener("click",(e)=>{
    const row=e.target.closest("tr[data-project]");
    if(!row) return;
    navigateTo(row.dataset.project, row.dataset.task, true);
  });
  el("masterTable")?.querySelectorAll("thead th[data-sort]")?.forEach(th=>{

    th.addEventListener("click", ()=>{

      const key = th.dataset.sort;

      if(sortMaster.key===key) sortMaster.dir = sortMaster.dir==="asc"?"desc":"asc";

      else { sortMaster.key=key; sortMaster.dir="asc"; }

      renderMaster();

      updateSortIndicators("masterTable", sortMaster);

      markDirty();

    });

  });

  el("btnResetSortMaster")?.addEventListener("click", ()=>{

    sortMaster = {key:"start", dir:"asc"};

    renderMaster();

    updateSortIndicators("masterTable", sortMaster);

    const fb = el("filtersBadge");

    if(fb) updateBadge(fb, false, "Tri/filtre actif", "Tri par défaut");

    markDirty();

  });

  el("projectTasksTable")?.addEventListener("click",(e)=>{

    const row=e.target.closest("tr[data-task]");

    if(!row) return;

    selectedTaskId=row.dataset.task;

    renderProject();

  });

  el("projectTasksTable")?.querySelectorAll("thead th[data-sort]")?.forEach(th=>{

    th.addEventListener("click", ()=>{

      const key = th.dataset.sort;

      if(sortProject.key===key) sortProject.dir = sortProject.dir==="asc"?"desc":"asc";

      else { sortProject.key=key; sortProject.dir="asc"; }

      renderProjectTasks(selectedProjectId);

      updateSortIndicators("projectTasksTable", sortProject);

      markDirty();

    });

  });

  el("btnResetSortProject")?.addEventListener("click", ()=>{

    sortProject = {key:"start", dir:"asc"};

    renderProjectTasks(selectedProjectId);

    updateSortIndicators("projectTasksTable", sortProject);

    markDirty();

  });



  // Alerte fermeture si modifications non sauvegardes

  window.addEventListener("beforeunload",(e)=>{

    if(unsavedChanges){

      e.preventDefault();

      e.returnValue="";

    }

  });



  // état visuel du bouton Sauvegarder au démarrage

  updateSaveButton();

}



load();

bind();

try{
  history.replaceState({projectId:selectedProjectId, taskId:selectedTaskId}, "");
}catch(e){}
window.addEventListener("popstate",(e)=>{
  const st = e.state || {};
  selectedProjectId = st.projectId || null;
  selectedTaskId = st.taskId || null;
  closeAllOverlays();
  setTimeout(()=> closeAllOverlays(), 0);
  renderAll();
});
renderAll();


// Préparation impression : cartouche + lgende

function preparePrint(opts={}){

  const includeGraphs = opts.includeGraphs !== false;

  document.body.classList.add("print-mode");

  const tpl = document.getElementById("printTemplate");

  if(!tpl) return;

  let container = document.getElementById("printInjection");

  if(!container){

    container = document.createElement("div");

    container.id="printInjection";

    document.body.prepend(container);

  }

  container.innerHTML = tpl.innerHTML;

  const header = container.querySelector("#printHeader");

  const meta = container.querySelector("#printMeta");

  const legend = container.querySelector("#printLegend");



  const today = new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});

  const currentProject = selectedProjectId ? state.projects.find(p=>p.id===selectedProjectId) : null;



  header.querySelector("h1").textContent = currentProject ? `Projet : ${currentProject.name||"Sans nom"}` : "Tableau maître";

  const metaRows = [

    ["Sous-projet", currentProject?.subproject || "-"],

    ["Site / Zone", currentProject?.site || "-"],

    ["Date export", today],

    ["Nombre de tâches", currentProject ? state.tasks.filter(t=>t.projectId===currentProject.id).length : state.tasks.length]

  ];

  meta.innerHTML = metaRows.map(([k,v])=>`<div><strong>${k}</strong><br>${v}</div>`).join("");



  if(legend){

    legend.innerHTML = STATUSES.map(s=>{

      const c = STATUS_COLORS[s.v] || "#2563eb";

      return `<span class="legend-item"><span class="legend-dot" style="background:${c};border-color:${c}"></span><span>${s.label}</span></span>`;

    }).join("");

  }



  // Contenu imprim : selon qu'on est sur le maître ou un projet

  container.querySelectorAll(".print-dynamic").forEach(n=>n.remove());

  if(!selectedProjectId){

    const wrap = document.createElement("div"); wrap.className="print-dynamic";

    const tableWrap = document.querySelector("#masterTable")?.closest(".tablewrap");

    if(tableWrap) wrap.appendChild(tableWrap.cloneNode(true));

    const ganttCard = document.querySelector("#masterGantt")?.closest(".card");

    if(ganttCard) wrap.appendChild(ganttCard.cloneNode(true));

    if(includeGraphs){

      const masterWorkload = document.querySelector("#workloadChart")?.closest(".card");

      if(masterWorkload) wrap.appendChild(masterWorkload.cloneNode(true));

      const masterPie = document.querySelector("#workloadPie")?.closest(".card");

      if(masterPie) wrap.appendChild(masterPie.cloneNode(true));

    }

    container.querySelector(".print-order")?.appendChild(wrap);

  }else{

    // Projet : rutiliser l'affichage courant (table tâches + gantt projet)

    const wrap = document.createElement("div"); wrap.className="print-dynamic";

    const projTable = document.querySelector("#projectTasksTable")?.closest(".card");

    if(projTable) wrap.appendChild(projTable.cloneNode(true));

    const projGantt = document.querySelector("#gantt")?.closest(".card");

    if(projGantt){

      const clone = projGantt.cloneNode(true);

      // éviter la double lgende : on garde celle du cartouche principal

      clone.querySelectorAll("#legend").forEach(n=>n.remove());

      wrap.appendChild(clone);

    }

    if(includeGraphs){

      const projWorkload = document.querySelector("#workloadChartProject")?.closest(".card");

      if(projWorkload) wrap.appendChild(projWorkload.cloneNode(true));

      const projPie = document.querySelector("#workloadPieProject")?.closest(".card");

      if(projPie) wrap.appendChild(projPie.cloneNode(true));

    }

    container.querySelector(".print-order")?.appendChild(wrap);

  }

}



function cleanupPrint(){

  document.body.classList.remove("print-mode");

  const container = document.getElementById("printInjection");

  if(container) container.innerHTML = "";

}



if(typeof window !== "undefined"){

  window.onafterprint = cleanupPrint;

  function buildExportSummary(tasks){
    const total = tasks.length;
    const dated = tasks.filter(t=>t.start && t.end);
    let range = "Plage: -";
    if(dated.length){
      const minStart = dated.reduce((a,t)=> !a || new Date(t.start) < new Date(a) ? t.start : a, "");
      const maxEnd = dated.reduce((a,t)=> !a || new Date(t.end) > new Date(a) ? t.end : a, "");
      range = `Plage: ${formatDate(minStart)}  ${formatDate(maxEnd)}`;
    }
    const datedPart = dated.length !== total ? ` (dates: ${dated.length})` : "";
    return `Tâches: ${total}${datedPart}  ${range}`;
  }
  window.openExportProjectModal = ()=>{

    const summary = el("exportProjectSummary");
    if(summary){
      const tasks = state.tasks.filter(t=>t.projectId===selectedProjectId);
      summary.textContent = buildExportSummary(tasks);
    }
    const modal = el("exportProjectModal");

    if(modal){ modal.classList.remove("hidden"); modal.style.display="flex"; modal.setAttribute("aria-hidden","false"); }

  };

  window.openExportMasterModal = ()=>{

    const summary = el("exportMasterSummary");
    if(summary){
      summary.textContent = buildExportSummary(state.tasks || []);
    }
    const modal = el("exportMasterModal");

    if(modal){ modal.classList.remove("hidden"); modal.style.display="flex"; modal.setAttribute("aria-hidden","false"); }

  };

}







