import React from "react";
import { Link } from "react-router-dom";
import { Calendar, AlertTriangle, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StatusBadge from "./StatusBadge";

export default function TaskCard({ task, showProject = true, isLate = false }) {
  const startFmt = task.start_date ? format(new Date(task.start_date), "dd MMM", { locale: fr }) : null;
  const endFmt   = task.end_date   ? format(new Date(task.end_date),   "dd MMM", { locale: fr }) : null;
  const progress = task.progress || 0;

  const barColor =
    progress >= 100 ? "bg-emerald-500" :
    isLate          ? "bg-red-500" :
    progress > 0    ? "bg-primary" : "bg-slate-300";

  return (
    <Link to={`/task/${task.id}`} className="block rounded-lg px-3 py-2 card-hover" style={{ background: "rgba(217,226,231,0.75)", border: "1px solid rgba(63,97,112,0.2)" }}>
      {/* Ligne 1 : contexte + alerte */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[8px] font-bold tracking-widest uppercase text-muted-foreground truncate flex-1">
          {showProject
            ? [task.site, task.project_name].filter(Boolean).join(" · ")
            : (task.statuses?.slice(0,2).join(" · ") || task.owner_type || "")}
        </p>
        {isLate
          ? <span className="flex items-center gap-0.5 text-[8px] font-bold uppercase text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5 ml-2 shrink-0">
              <AlertTriangle className="w-2.5 h-2.5" />RETARD
            </span>
          : <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-1" />
        }
      </div>

      {/* Titre */}
      <p className="text-[12px] font-bold text-foreground uppercase tracking-wide leading-snug mb-1.5 line-clamp-2">
        {task.description || "SANS DESCRIPTION"}
      </p>

      {/* Badges */}
      <div className="flex flex-wrap gap-1 mb-1.5">
        {task.owner_type && <StatusBadge type="owner" label={task.owner_type} />}
        {task.internal_tech && task.owner_type === "INTERNE" && (
          <StatusBadge type="status" label={task.internal_tech} />
        )}
        {task.vendor && task.owner_type === "Prestataire externe" && (
          <StatusBadge type="status" label={task.vendor} />
        )}
        {task.statuses?.map((s, i) => <StatusBadge key={i} type="status" label={s} />)}
      </div>

      {/* Progress + dates sur la même ligne */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${progress}%` }} />
          </div>
        </div>
        <span className="text-[9px] font-bold text-muted-foreground shrink-0">{progress}%</span>
        {(startFmt || endFmt) && (
          <span className="flex items-center gap-0.5 text-[8px] text-muted-foreground shrink-0">
            <Calendar className="w-2.5 h-2.5" />{startFmt || "—"}→{endFmt || "—"}
          </span>
        )}
      </div>
    </Link>
  );
}
