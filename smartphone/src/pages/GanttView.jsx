import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dataClient } from "@/api/dataClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MobileGantt from "../components/gantt/MobileGantt";

export default function GanttView() {
  const [siteFilter, setSiteFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => dataClient.entities.Task.list("-updated_date", 500),
  });

  const sites = useMemo(() => [...new Set(tasks.map((t) => t.site).filter(Boolean))].sort(), [tasks]);
  const projects = useMemo(() => {
    let list = tasks;
    if (siteFilter && siteFilter !== "all") {
      list = list.filter((t) => t.site === siteFilter);
    }
    return [...new Set(list.map((t) => t.project_name).filter(Boolean))].sort();
  }, [tasks, siteFilter]);

  const filtered = useMemo(() => {
    let result = tasks;
    if (siteFilter && siteFilter !== "all") {
      result = result.filter((t) => t.site === siteFilter);
    }
    if (projectFilter && projectFilter !== "all") {
      result = result.filter((t) => t.project_name === projectFilter);
    }
    return result;
  }, [tasks, siteFilter, projectFilter]);

  return (
    <div className="space-y-0">
      <div className="px-4 py-2" style={{ background: "rgba(235,230,220,0.6)" }}>
        <h2 className="text-[11px] font-bold text-foreground tracking-widest uppercase">Gantt Global</h2>
      </div>
      <div className="p-4 space-y-3">

      <div className="flex gap-2">
        <Select value={siteFilter} onValueChange={(v) => { setSiteFilter(v); setProjectFilter("all"); }}>
          <SelectTrigger className="flex-1 h-8 text-[12px] bg-white">
            <SelectValue placeholder="Site" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les sites</SelectItem>
            {sites.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="flex-1 h-8 text-[12px] bg-white">
            <SelectValue placeholder="Chantier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les chantiers</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-[11px] text-muted-foreground font-medium">
        {filtered.length} tâche{filtered.length !== 1 ? "s" : ""}
      </p>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <MobileGantt tasks={filtered} />
      )}

      {/* Legend */}
      <div className="bg-card rounded-xl border border-border p-3">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Légende</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "INTERNE", color: "#22c55e" },
            { label: "RSG", color: "#2563eb" },
            { label: "RI", color: "#7c3aed" },
            { label: "Prestataire", color: "#d97706" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="w-4 h-2.5 rounded-sm" style={{ background: item.color }} />
              <span className="text-[11px] text-foreground font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
