import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dataClient } from "@/api/dataClient";
import TaskCard from "../components/common/TaskCard";
import FilterSheet, { defaultFilters } from "../components/common/FilterSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeMissingEntriesByTask } from "@/lib/missingHours";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SORT_OPTIONS = [
  { key: "site_project", label: "Par défaut (Site + Chantier)" },
  { key: "start_asc",    label: "Début ↑ (plus ancien)" },
  { key: "start_desc",   label: "Début ↓ (plus récent)" },
  { key: "end_asc",      label: "Fin ↑ (plus tôt)" },
  { key: "end_desc",     label: "Fin ↓ (plus tard)" },
  { key: "progress_asc", label: "Avancement 0% → 100%" },
  { key: "progress_desc",label: "Avancement 100% → 0%" },
  { key: "late_first",   label: "En retard en premier" },
];

const TODAY = new Date().toISOString().slice(0, 10);

function isTaskLate(task) {
  if (!task.end_date || (task.progress || 0) >= 100) return false;
  return task.end_date < TODAY;
}

function isTaskInProgressByDate(task) {
  const start = String(task?.start_date || "").slice(0, 10);
  const end = String(task?.end_date || "").slice(0, 10);
  if (!start || !end) return false;
  return start <= TODAY && TODAY <= end;
}

function applyStateFilter(task, state) {
  if (!state || state === "all") return true;
  const p = task.progress || 0;
  if (state === "done")        return p >= 100;
  if (state === "not_started") return p === 0;
  if (state === "late")        return isTaskLate(task);
  if (state === "in_progress") return isTaskInProgressByDate(task);
  return true;
}

function applyCorpsEtatFilter(task, corpsetat) {
  if (!corpsetat || corpsetat === "all") return true;
  return (task.statuses || []).some(
    (s) => s.trim().toLowerCase() === corpsetat.trim().toLowerCase()
  );
}

function buildTableData(tasks, logs) {
  const missingEntriesByTask = computeMissingEntriesByTask(tasks, logs);
  return (tasks || []).map((task) => {
    const taskKey = String(task?.id || task?.task_id || "").trim();
    return {
      task,
      taskKey,
      isLate: isTaskLate(task),
      missingEntries: missingEntriesByTask[taskKey] || 0,
    };
  });
}

export default function MasterTable() {
  const [search, setSearch]   = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [sortBy, setSortBy]   = useState("site_project");

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => dataClient.entities.Task.list("-updated_date", 500),
    staleTime: 60000,
    refetchOnMount: false,
  });
  const { data: tasks = [], isLoading } = tasksQuery;
  const projectsQuery = useQuery({
    queryKey: ["projects-master-filter-sites"],
    queryFn: () => dataClient.entities.Project.list("-updated_date", 200),
  });
  const { data: projectsList = [], isLoading: loadingProjects } = projectsQuery;
  const { data: timeLogs = [] } = useQuery({
    queryKey: ["time-logs", "tasks-missing-master"],
    queryFn: () => dataClient.entities.TimeLog.list("-date", 0),
  });
  const { data: sitesRef = [] } = useQuery({
    queryKey: ["sites-master-filter-ref"],
    queryFn: () => dataClient.entities.Referential.listSites({}, "name", 500),
  });

  // Listes dynamiques pour les filtres
  const sites = useMemo(
    () => {
      const fromRef = sitesRef.map((s) => s.name).filter(Boolean);
      const fromProjects = projectsList.map((p) => p.site).filter(Boolean);
      const fromTasks = tasks.map((t) => t.site).filter(Boolean);
      return [...new Set([...fromRef, ...fromProjects, ...fromTasks])].sort();
    },
    [sitesRef, projectsList, tasks]
  );

  const projects = useMemo(() => {
    const base = filters.site && filters.site !== "all"
      ? tasks.filter((t) => t.site === filters.site)
      : tasks;
    return [...new Set(base.map((t) => t.project_name).filter(Boolean))].sort();
  }, [tasks, filters.site]);

  // Corps d'état : valeurs réelles stockées dans task.statuses
  const corpsEtats = useMemo(() => {
    const all = tasks.flatMap((t) => t.statuses || []);
    return [...new Set(all.map((s) => s.trim()).filter(Boolean))].sort();
  }, [tasks]);

  // Tâches filtrées + triées
  const filtered = useMemo(() => {
    let result = tasks;

    if (filters.site       !== "all") result = result.filter((t) => t.site === filters.site);
    if (filters.project    !== "all") result = result.filter((t) => t.project_name === filters.project);
    if (filters.owner      !== "all") result = result.filter((t) => t.owner_type === filters.owner);
    if (filters.corpsetat  !== "all") result = result.filter((t) => applyCorpsEtatFilter(t, filters.corpsetat));
    if (filters.state      !== "all") result = result.filter((t) => applyStateFilter(t, filters.state));
    if (filters.startAfter)           result = result.filter((t) => (t.start_date || "") >= filters.startAfter);
    if (filters.endBefore)            result = result.filter((t) => (t.end_date || "") <= filters.endBefore);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          (t.description  || "").toLowerCase().includes(q) ||
          (t.project_name || "").toLowerCase().includes(q) ||
          (t.site         || "").toLowerCase().includes(q) ||
          (t.vendor       || "").toLowerCase().includes(q) ||
          (t.statuses || []).some((s) => s.toLowerCase().includes(q))
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "site_project":
          return (
            (a.site || "").localeCompare(b.site || "", "fr") ||
            (a.project_name || "").localeCompare(b.project_name || "", "fr") ||
            (a.start_date || "").localeCompare(b.start_date || "")
          );
        case "start_asc":    return (a.start_date || "").localeCompare(b.start_date || "");
        case "start_desc":   return (b.start_date || "").localeCompare(a.start_date || "");
        case "end_asc":      return (a.end_date || "").localeCompare(b.end_date || "");
        case "end_desc":     return (b.end_date || "").localeCompare(a.end_date || "");
        case "progress_asc": return (a.progress || 0) - (b.progress || 0);
        case "progress_desc":return (b.progress || 0) - (a.progress || 0);
        case "late_first": {
          const la = isTaskLate(a) ? 0 : 1;
          const lb = isTaskLate(b) ? 0 : 1;
          return la - lb || (a.end_date || "").localeCompare(b.end_date || "");
        }
        default: return 0;
      }
    });

    return result;
  }, [tasks, filters, search, sortBy]);

  // Compteurs rapides (sur toutes les tâches, pas les filtrées)
  const lateCount       = useMemo(() => tasks.filter(isTaskLate).length, [tasks]);
  const inProgressCount = useMemo(() => tasks.filter(isTaskInProgressByDate).length, [tasks]);
  const tableData = useMemo(
    () => buildTableData(filtered, timeLogs),
    [filtered, timeLogs]
  );

  const isDefaultSort = sortBy === "site_project";
  const activeFiltersCount = Object.entries(filters).filter(([k, v]) =>
    ["site","project","owner","corpsetat","state"].includes(k) ? v && v !== "all" : !!v
  ).length;

  const handleReset = () => { setFilters(defaultFilters); setSearch(""); setSortBy("site_project"); };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between" style={{ background: "rgba(235,230,220,0.6)" }}>
        <p className="text-[11px] font-bold text-foreground tracking-widest uppercase">TABLEAU DES TACHES</p>
      </div>
    <div className="px-3 pt-2 space-y-2">

      {/* Raccourcis rapides */}
      {!isLoading && (lateCount > 0 || inProgressCount > 0) && (
        <div className="flex gap-2 flex-wrap">
          {lateCount > 0 && (
            <button
              onClick={() => setFilters({ ...defaultFilters, state: filters.state === "late" ? "all" : "late" })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold active:scale-95 transition-all
                ${filters.state === "late"
                  ? "bg-red-600 border-red-600 text-white"
                  : "bg-red-50 border-red-200 text-red-700"}`}
            >
              <span className="w-2 h-2 rounded-full bg-current inline-block" />
              {lateCount} en retard
            </button>
          )}
          {inProgressCount > 0 && (
            <button
              onClick={() => setFilters({ ...defaultFilters, state: filters.state === "in_progress" ? "all" : "in_progress" })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold active:scale-95 transition-all
                ${filters.state === "in_progress"
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-blue-50 border-blue-200 text-blue-700"}`}
            >
              <span className="w-2 h-2 rounded-full bg-current inline-block" />
              {inProgressCount} en cours
            </button>
          )}
          {(activeFiltersCount > 0 || search || !isDefaultSort) && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-muted-foreground/30 text-[11px] font-semibold text-muted-foreground active:scale-95 transition-all"
            >
              <RotateCcw className="w-3 h-3" />
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Barre recherche + filtres + tri */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Tâche, chantier, site, prestataire..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-[12px] bg-white"
          />
        </div>

        <FilterSheet
          sites={sites}
          projects={projects}
          corpsEtats={corpsEtats}
          filters={filters}
          onFilterChange={setFilters}
          onReset={() => setFilters(defaultFilters)}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={isDefaultSort ? "outline" : "default"}
              size="sm"
              className="gap-1 shrink-0 h-8 px-2"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {SORT_OPTIONS.map((opt, i) => (
              <React.Fragment key={opt.key}>
                {i === 5 && <DropdownMenuSeparator />}
                {i === 7 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={() => setSortBy(opt.key)}
                  className={sortBy === opt.key ? "font-semibold text-primary bg-primary/5" : ""}
                >
                  <span className="w-4 inline-block">{sortBy === opt.key ? "✓" : ""}</span>
                  {opt.label}
                </DropdownMenuItem>
              </React.Fragment>
            ))}
            {!isDefaultSort && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSortBy("site_project")} className="text-muted-foreground">
                  <RotateCcw className="w-3.5 h-3.5 mr-2" />
                  Tri par défaut
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Compteur résultats */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground font-medium">
          {filtered.length} tâche{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== tasks.length && (
            <span className="text-muted-foreground/60"> (sur {tasks.length})</span>
          )}
        </p>
        {!isDefaultSort && (
          <p className="text-[10px] text-primary font-medium">
            {SORT_OPTIONS.find((s) => s.key === sortBy)?.label}
          </p>
        )}
      </div>

      {/* Liste des tâches */}
      {isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-1.5">
          {tableData.map(({ task, taskKey, isLate, missingEntries }) => {
            return (
              <TaskCard key={task.id} task={task} isLate={isLate} missingEntries={missingEntries} />
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">Aucune tâche trouvée</p>
              <button onClick={handleReset} className="text-primary text-xs underline mt-1">Réinitialiser</button>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
