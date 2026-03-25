import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, ClipboardList, FolderKanban, BarChart3, Search } from "lucide-react";

const sectionLabels = {
  "/":        { sub: "VUE D'ENSEMBLE",  main: "TABLEAU DE BORD" },
  "/master":  { sub: "LISTE DES TÂCHES", main: "TABLEAU" },
  "/projects":{ sub: "LISTE DES PROJETS", main: "PROJETS" },
  "/gantt":   { sub: "PLANNING",        main: "GANTT" },
  "/search":  { sub: "RECHERCHE",       main: "CHERCHER" },
};

function ActiveSectionLabel() {
  const location = useLocation();
  const entry = Object.entries(sectionLabels).find(([path]) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)
  );
  const label = entry ? entry[1] : { sub: "", main: "" };
  return (
    <div>
      <p style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.12em", color: "#556d79", textTransform: "uppercase" }}>{label.sub}</p>
      <p style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.06em", color: "#14242c", textTransform: "uppercase" }}>{label.main}</p>
    </div>
  );
}

const navItems = [
  { path: "/",         icon: LayoutDashboard, label: "Accueil",  color: "#3f6170", bg: "rgba(63,97,112,0.15)" },
  { path: "/master",   icon: ClipboardList,   label: "Tableau",  color: "#b45309", bg: "rgba(234,179,8,0.15)" },
  { path: "/projects", icon: FolderKanban,    label: "Projets",  color: "#0e7490", bg: "rgba(14,116,144,0.15)" },
  { path: "/gantt",    icon: BarChart3,        label: "Gantt",    color: "#7c3aed", bg: "rgba(124,58,237,0.15)" },
  { path: "/search",   icon: Search,           label: "Chercher", color: "#059669", bg: "rgba(5,150,105,0.15)" },
];

/* Couleurs exactes DotationTrack */
const HEADER_BG  = "linear-gradient(180deg, #c2d2da 0%, #d9e2e7 100%)";
const NAV_BG     = "linear-gradient(180deg, #c2d2da 0%, #b8cad2 100%)";
const BORDER_CLR = "rgba(63,97,112,0.25)";
const TEXT_DARK  = "#14242c";
const TEXT_DIM   = "#556d79";
const TEXT_MID   = "#213b48";
const PRIMARY    = "#3f6170";

export default function MobileLayout() {
  const location = useLocation();

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #ebe6dc 0%, #d9e2e7 100%)", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          minHeight: "100vh",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(180deg, #ebe6dc 0%, #d9e2e7 100%)",
          boxShadow: "0 0 0 1px rgba(63,97,112,0.15), 0 10px 30px rgba(20,36,44,0.18)",
        }}
      >

      {/* Header — style Next Bo@rd */}
      <header className="sticky top-0 z-50" style={{ background: HEADER_BG, borderBottom: `1px solid ${BORDER_CLR}` }}>
        <div className="flex items-center gap-3 px-4 py-2">

          {/* Logo bloc */}
          <div className="flex items-center gap-2 shrink-0">
            <div style={{ width: 32, height: 32, borderRadius: 8, background: PRIMARY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "white", fontWeight: 900, fontSize: 11, letterSpacing: "-0.5px" }}>SC</span>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 900, color: TEXT_DARK, letterSpacing: "-0.3px", lineHeight: 1.1 }}>
                Suivi <span style={{ color: PRIMARY }}>Ch@ntiers</span>
              </p>
              <p style={{ fontSize: 8, color: TEXT_DIM, letterSpacing: "0.06em" }}>Gestion de travaux</p>
            </div>
          </div>

          {/* Séparateur vertical */}
          <div style={{ width: 1, height: 32, background: BORDER_CLR, flexShrink: 0 }} />

          {/* Titre section — lié à la route active */}
          <div className="flex-1 min-w-0">
            <ActiveSectionLabel />
          </div>

        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>

      {/* Bottom nav — style DotationTrack */}
      <nav className="sticky bottom-0 z-50" style={{ background: NAV_BG, borderTop: `1px solid ${BORDER_CLR}` }}>
        <div className="flex items-center justify-around px-1" style={{ paddingBottom: "env(safe-area-inset-bottom, 4px)" }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "8px 12px 10px", position: "relative",
                  borderTop: isActive ? `2px solid ${item.color}` : "2px solid transparent",
                  background: isActive ? "rgba(63,97,112,0.18)" : "transparent",
                  textDecoration: "none",
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: isActive ? item.bg : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.15s"
                }}>
                  <item.icon
                    style={{ width: 18, height: 18, color: isActive ? item.color : item.color + "99" }}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                </div>
                <span style={{ fontSize: 8, marginTop: 2, letterSpacing: "0.06em", color: isActive ? TEXT_MID : TEXT_DIM, fontWeight: isActive ? 700 : 400, textTransform: "uppercase" }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
      </div>
    </div>
  );
}
