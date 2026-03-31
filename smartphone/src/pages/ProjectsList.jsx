import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dataClient } from "@/api/dataClient";
import ProjectCard from "../components/common/ProjectCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeProjectHoursById } from "@/lib/projectHours";
import { computeMissingEntriesByProject } from "@/lib/missingHours";

export default function ProjectsList() {
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("all");

  const { data: projects = [], isLoading: loadingP } = useQuery({
    queryKey: ["projects"],
    queryFn: () => dataClient.entities.Project.list("-updated_date", 200),
  });

  const { data: tasks = [], isLoading: loadingT } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => dataClient.entities.Task.list("-updated_date", 500),
  });
  const { data: timeLogs = [], isLoading: loadingL } = useQuery({
    queryKey: ["time-logs", "project-hours-list"],
    queryFn: () => dataClient.entities.TimeLog.list("-date", 0),
  });

  const isLoading = loadingP || loadingT || loadingL;

  const taskCountByProject = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (t.project_id) {
        map[t.project_id] = (map[t.project_id] || 0) + 1;
      }
    });
    return map;
  }, [tasks]);
  const projectHoursById = useMemo(
    () => computeProjectHoursById(projects, tasks, timeLogs),
    [projects, tasks, timeLogs]
  );
  const missingEntriesByProject = useMemo(
    () => computeMissingEntriesByProject(tasks, timeLogs),
    [tasks, timeLogs]
  );

  const sites = useMemo(
    () => [...new Set(projects.map((p) => p.site).filter(Boolean))].sort(),
    [projects]
  );

  const filtered = useMemo(() => {
    let result = projects;
    if (siteFilter && siteFilter !== "all") {
      result = result.filter((p) => p.site === siteFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.site || "").toLowerCase().includes(q) ||
          (p.subproject || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [projects, siteFilter, search]);

  return (
    <div className="space-y-0">
      <div className="px-4 py-2 flex items-center justify-between" style={{ background: "rgba(235,230,220,0.6)" }}>
        <p className="text-[11px] font-bold text-foreground tracking-widest uppercase">CHANTIERS</p>
        <div className="flex items-center gap-2">
          <p className="text-[9px] text-muted-foreground font-semibold">{filtered.length} chantier{filtered.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="px-3 pt-2 space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 bg-white text-sm"
          />
        </div>
        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger className="w-24 h-8 bg-white text-xs">
            <SelectValue placeholder="Site" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {sites.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-1.5">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              taskCount={taskCountByProject[project.id] || 0}
              totalHoursMinutes={projectHoursById[project.id] || 0}
              missingEntries={missingEntriesByProject[project.id] || 0}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Aucun chantier trouve
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

