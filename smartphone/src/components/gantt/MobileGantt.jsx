import React, { useMemo, useRef } from "react";
import { format, startOfWeek, addWeeks, differenceInWeeks, isWithinInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import StatusBadge from "../common/StatusBadge";
import { Link } from "react-router-dom";

const WEEK_WIDTH = 48;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 160;

const ownerColors = {
  INTERNE: "#22c55e",
  RSG: "#2563eb",
  RI: "#7c3aed",
  "Prestataire externe": "#d97706",
};

function parseDateSafe(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const iso = parseISO(raw);
  if (!Number.isNaN(iso.getTime())) return iso;
  const native = new Date(raw);
  if (!Number.isNaN(native.getTime())) return native;
  return null;
}

export default function MobileGantt({ tasks = [], showLabels = true }) {
  const scrollRef = useRef(null);

  const { weeks, rows, minDate } = useMemo(() => {
    if (!tasks.length) return { weeks: [], rows: [], minDate: null };

    const validTasks = tasks
      .map((t) => {
        const start = parseDateSafe(t.start_date);
        const end = parseDateSafe(t.end_date);
        if (!start || !end) return null;
        return { ...t, _startDate: start, _endDate: end };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const startCmp = String(a.start_date || "").localeCompare(String(b.start_date || ""));
        if (startCmp !== 0) return startCmp;
        const endCmp = String(a.end_date || "").localeCompare(String(b.end_date || ""));
        if (endCmp !== 0) return endCmp;
        return String(a.description || "").localeCompare(String(b.description || ""));
      });
    if (!validTasks.length) return { weeks: [], rows: [], minDate: null };

    let earliest = validTasks[0]._startDate;
    let latest = validTasks[0]._endDate;

    validTasks.forEach((t) => {
      const s = t._startDate;
      const e = t._endDate;
      if (s < earliest) earliest = s;
      if (e > latest) latest = e;
    });

    const startWeek = startOfWeek(earliest, { weekStartsOn: 1 });
    const totalWeeks = Math.max(1, differenceInWeeks(latest, startWeek) + 2);
    const wks = Array.from({ length: totalWeeks }, (_, i) => addWeeks(startWeek, i));

    const rws = validTasks.map((task) => {
      const taskStart = task._startDate;
      const taskEnd = task._endDate;
      const offsetWeeks = Math.max(0, differenceInWeeks(taskStart, startWeek));
      const durationWeeks = Math.max(1, differenceInWeeks(taskEnd, taskStart) + 1);
      return { task, offsetWeeks, durationWeeks };
    });

    return { weeks: wks, rows: rws, minDate: startWeek };
  }, [tasks]);

  if (!weeks.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Aucune tâche avec dates à afficher
      </div>
    );
  }

  const totalWidth = LABEL_WIDTH + weeks.length * WEEK_WIDTH;

  // Find current week
  const now = new Date();
  const currentWeekIdx = weeks.findIndex((w) => {
    const end = addWeeks(w, 1);
    return isWithinInterval(now, { start: w, end });
  });

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <div ref={scrollRef} className="overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          {/* Week headers */}
          <div className="flex border-b border-border sticky top-0 z-10 bg-muted">
            {showLabels && (
              <div
                className="flex-shrink-0 px-2 py-2 text-[10px] font-bold text-muted-foreground uppercase border-r border-border"
                style={{ width: LABEL_WIDTH }}
              >
                Tâche
              </div>
            )}
            {weeks.map((w, i) => {
              const weekNum = format(w, "'S'ww", { locale: fr });
              const isCurrent = i === currentWeekIdx;
              return (
                <div
                  key={i}
                  className={`flex-shrink-0 px-1 py-2 text-center text-[9px] font-semibold border-r border-border ${
                    isCurrent ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                  style={{ width: WEEK_WIDTH }}
                >
                  {weekNum}
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {rows.map(({ task, offsetWeeks, durationWeeks }, idx) => (
            <Link
              key={task.id}
              to={`/task/${task.id}`}
              className="flex items-center border-b border-border/50 hover:bg-muted/50 transition-colors"
              style={{ height: ROW_HEIGHT }}
            >
              {showLabels && (
                <div
                  className="flex-shrink-0 px-2 truncate"
                  style={{ width: LABEL_WIDTH }}
                >
                  <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                    {task.description}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <StatusBadge type="owner" label={task.owner_type} className="text-[8px] px-1 py-0" />
                  </div>
                </div>
              )}
              <div className="flex-1 relative" style={{ height: ROW_HEIGHT }}>
                {/* Current week marker */}
                {currentWeekIdx >= 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary/30"
                    style={{ left: currentWeekIdx * WEEK_WIDTH + WEEK_WIDTH / 2 }}
                  />
                )}
                {/* Bar */}
                <div
                  className="absolute top-2.5 rounded-md h-5"
                  style={{
                    left: offsetWeeks * WEEK_WIDTH + 2,
                    width: Math.max(durationWeeks * WEEK_WIDTH - 4, 12),
                    background: ownerColors[task.owner_type] || "#94a3b8",
                    opacity: task.progress >= 100 ? 0.5 : 0.85,
                  }}
                >
                  {/* Progress fill */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-md"
                    style={{
                      width: `${task.progress || 0}%`,
                      background: "rgba(255,255,255,0.3)",
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow-sm">
                    {task.progress || 0}%
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
