import React from "react";
import { Link } from "react-router-dom";
import { MapPin, ListChecks, ChevronRight, Clock3 } from "lucide-react";

function formatHoursMinutes(totalMinutes = 0) {
  const total = Number.isFinite(Number(totalMinutes)) ? Math.max(0, Math.round(Number(totalMinutes))) : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export default function ProjectCard({ project, taskCount = 0, totalHoursMinutes = 0, missingEntries = 0 }) {
  const progress = project.progress || 0;
  const barColor = progress >= 100 ? "bg-emerald-500" : progress > 0 ? "bg-primary" : "bg-slate-300";

  return (
    <Link to={`/project/${project.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 card-hover" style={{ background: "rgba(217,226,231,0.75)", border: "1px solid rgba(63,97,112,0.2)" }}>
      {/* Indicator bar */}
      <div className="w-1 self-stretch rounded-full shrink-0" style={{background: progress >= 100 ? "#10b981" : progress > 0 ? "hsl(var(--primary))" : "#cbd5e1"}} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <MapPin className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
          <span className="text-[8px] font-bold tracking-widest uppercase text-muted-foreground truncate">{project.site}</span>
        </div>
        <p className="text-[12px] font-bold text-foreground uppercase tracking-wide leading-snug truncate">{project.name}</p>
        {project.subproject && (
          <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5 truncate">{project.subproject}</p>
        )}
        {/* Progress inline */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="h-1 rounded-full bg-muted overflow-hidden flex-1">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[8px] font-bold text-muted-foreground">{progress}%</span>
        </div>
        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: "rgba(63,97,112,0.10)", border: "1px solid rgba(63,97,112,0.18)" }}>
          <Clock3 className="w-3 h-3 shrink-0" style={{ color: "#3f6170" }} />
          <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: "#213b48" }}>
            Total heures: {formatHoursMinutes(totalHoursMinutes)}
          </span>
        </div>
        <div
          className="mt-1 inline-flex items-center gap-1.5 px-2 py-1 rounded-md"
          style={{
            background: missingEntries > 0 ? "rgba(234,179,8,0.16)" : "rgba(22,163,74,0.12)",
            border: `1px solid ${missingEntries > 0 ? "rgba(180,83,9,0.24)" : "rgba(22,163,74,0.24)"}`,
          }}
        >
          <span
            className="text-[10px] font-extrabold uppercase tracking-wide"
            style={{ color: missingEntries > 0 ? "#92400e" : "#166534" }}
          >
            Heures manquantes: {missingEntries} saisie{missingEntries > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Task count + chevron */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <div className="flex items-center gap-0.5 bg-muted rounded px-1.5 py-0.5">
          <ListChecks className="w-2.5 h-2.5 text-muted-foreground" />
          <span className="text-[9px] font-bold text-muted-foreground">{taskCount}</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
      </div>
    </Link>
  );
}
