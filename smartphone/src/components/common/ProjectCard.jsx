import React from "react";
import { Link } from "react-router-dom";
import { MapPin, ListChecks, ChevronRight } from "lucide-react";

export default function ProjectCard({ project, taskCount = 0 }) {
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