import React from "react";
import { useQuery } from "@tanstack/react-query";
import { dataClient } from "@/api/dataClient";
import { FolderKanban, ListChecks, CheckCircle2, AlertTriangle, ChevronRight, Clock, Timer, TrendingUp } from "lucide-react";
import ProjectCard from "../components/common/ProjectCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { computeProjectHoursById } from "@/lib/projectHours";
import { computeTaskProgressAuto } from "@/lib/businessRules";
import { computeMissingEntriesByTask } from "@/lib/missingHours";

export default function Dashboard() {
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => dataClient.entities.Project.list("-updated_date", 200),
  });
  const { data: projects = [], isLoading: loadingProjects } = projectsQuery;

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => dataClient.entities.Task.list("-updated_date", 500),
    staleTime: 60000,
    refetchOnMount: false,
  });
  const { data: tasks = [], isLoading: loadingTasks } = tasksQuery;
  const baseTasks = tasks;
  const { data: timeLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["time-logs", "project-hours-dashboard"],
    queryFn: () => dataClient.entities.TimeLog.list("-date", 0),
  });

  const isLoading = loadingProjects || loadingTasks || loadingLogs;

  const tasksWithComputedProgress = React.useMemo(
    () =>
      (tasks || []).map((t) => ({
        ...t,
        progress_auto: computeTaskProgressAuto(t?.start_date || "", t?.end_date || ""),
      })),
    [tasks]
  );

  const totalTasks      = tasksWithComputedProgress.length;
  const completedTasks  = tasksWithComputedProgress.filter((t) => t.progress_auto >= 100).length;
  const inProgressTasks = tasksWithComputedProgress.filter((t) => t.progress_auto > 0 && t.progress_auto < 100).length;
  const overdueTasks    = tasksWithComputedProgress.filter((t) => {
    if (!t.end_date || t.progress_auto >= 100) return false;
    return new Date(t.end_date) < new Date();
  });

  const globalPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const recentProjects = projects.slice(0, 6);

  const taskCountByProject = React.useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const projectKey = String(t?.project_id || t?.projectId || "").trim();
      if (projectKey) {
        map[projectKey] = (map[projectKey] || 0) + 1;
      }
    });
    return map;
  }, [tasks]);
  const projectHoursById = React.useMemo(
    () => computeProjectHoursById(projects, tasks, timeLogs),
    [projects, tasks, timeLogs]
  );
  const missingEntriesByTask = React.useMemo(
    () => computeMissingEntriesByTask(tasks, timeLogs),
    [tasks, timeLogs]
  );
  const missingEntriesByProject = React.useMemo(() => {
    const out = {};
    (projects || []).forEach((project) => {
      const projectId = String(project?.id || "").trim();
      if (!projectId) return;
      const projectTaskIds = (tasks || [])
        .filter((task) => String(task?.project_id || "").trim() === projectId)
        .map((task) => String(task?.id || task?.task_id || "").trim())
        .filter(Boolean);
      const totalMissing = projectTaskIds.reduce(
        (sum, taskId) => sum + (Number(missingEntriesByTask[taskId]) || 0),
        0
      );
      out[projectId] = totalMissing;
    });
    return out;
  }, [projects, tasks, missingEntriesByTask]);
  const missingHoursKpi = React.useMemo(() => {
    const values = Object.values(missingEntriesByTask || {});
    const tasksWithMissing = values.reduce((acc, count) => acc + (Number(count) > 0 ? 1 : 0), 0);
    const missingEntries = values.reduce((acc, count) => acc + (Number(count) || 0), 0);
    return { tasksWithMissing, missingEntries };
  }, [missingEntriesByTask]);
  const distinctTaskProjectIds = React.useMemo(
    () => new Set((baseTasks || []).map((t) => String(t?.project_id || t?.projectId || "").trim()).filter(Boolean)).size,
    [baseTasks]
  );
  const sampleProjectIds = React.useMemo(
    () => Array.from(new Set((baseTasks || []).map((t) => String(t?.project_id || t?.projectId || "").trim()).filter(Boolean))).slice(0, 10),
    [baseTasks]
  );
  const firstTaskIds = React.useMemo(
    () => (baseTasks || []).map((t) => String(t?.id || t?.task_id || "").trim()).filter(Boolean).slice(0, 10),
    [baseTasks]
  );
  React.useEffect(() => {
    if (loadingTasks || loadingProjects) return;
    if (tasksQuery.isFetching || projectsQuery.isFetching) return;
    console.log({
      view: "Dashboard",
      timestamp: new Date().toISOString(),
      projectsCount: projects.length,
      tasksCount: tasks.length,
      distinctTaskProjectIds,
      sampleProjectIds,
      firstTaskIds,
      tasksQueryDataUpdatedAt: tasksQuery.dataUpdatedAt,
      tasksQueryFetchStatus: tasksQuery.fetchStatus,
      tasksQueryIsFetching: tasksQuery.isFetching,
      projectsQueryDataUpdatedAt: projectsQuery.dataUpdatedAt,
      projectsQueryFetchStatus: projectsQuery.fetchStatus,
      projectsQueryIsFetching: projectsQuery.isFetching,
    });
  }, [projects.length, tasks.length, distinctTaskProjectIds, sampleProjectIds, firstTaskIds, loadingTasks, loadingProjects, tasksQuery.isFetching, projectsQuery.isFetching, tasksQuery.dataUpdatedAt, tasksQuery.fetchStatus, projectsQuery.dataUpdatedAt, projectsQuery.fetchStatus]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <Skeleton className="h-16 rounded-2xl" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-0 pb-2">

      {/* Section header */}
      <div className="px-4 py-2 flex items-center justify-between" style={{ background: "rgba(235,230,220,0.6)" }}>
        <p className="text-[11px] font-bold text-foreground tracking-widest uppercase">VUE D'ENSEMBLE</p>
        <p className="text-[9px] text-muted-foreground tracking-widest uppercase font-semibold">{new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}).toUpperCase()}</p>
      </div>

      {/* KPI row — cartes arrondies */}
      <div className="grid grid-cols-3 gap-2 px-3 py-1.5" style={{ background: "rgba(217,226,231,0.4)" }}>
        <div className="flex flex-col items-center justify-center py-1.5 px-2 gap-0.5 rounded-xl" style={{ background: "rgba(217,226,231,0.85)", border: "1px solid rgba(63,97,112,0.2)" }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(63,97,112,0.15)" }}>
            <FolderKanban className="w-3.5 h-3.5" style={{ color: "#3f6170" }} />
          </div>
          <p className="text-xl font-black leading-none" style={{ color: "#14242c" }}>{projects.length}</p>
          <p className="text-[8px] font-bold tracking-widest uppercase" style={{ color: "#556d79" }}>CHANTIERS</p>
        </div>
        <div className="flex flex-col items-center justify-center py-1.5 px-2 gap-0.5 rounded-xl" style={{ background: "rgba(217,226,231,0.85)", border: "1px solid rgba(63,97,112,0.2)" }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(63,97,112,0.15)" }}>
            <ListChecks className="w-3.5 h-3.5" style={{ color: "#3f6170" }} />
          </div>
          <p className="text-xl font-black leading-none" style={{ color: "#14242c" }}>{totalTasks}</p>
          <p className="text-[8px] font-bold tracking-widest uppercase" style={{ color: "#556d79" }}>TÂCHES</p>
          <p className="text-[8px] font-semibold" style={{ color: "#556d79" }}>{completedTasks} term.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-1.5 px-2 gap-0.5 rounded-xl" style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(180,83,9,0.2)" }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(234,179,8,0.15)" }}>
            <Timer className="w-3.5 h-3.5" style={{ color: "#b45309" }} />
          </div>
          <p className="text-xl font-black leading-none" style={{ color: "#b45309" }}>{inProgressTasks}</p>
          <p className="text-[8px] font-bold tracking-widest uppercase" style={{ color: "#556d79" }}>EN COURS</p>
          <p className="text-[8px] font-semibold" style={{ color: "#556d79" }}>{overdueTasks.length} en retard</p>
        </div>
      </div>

      <div className="px-3 pb-1.5" style={{ background: "rgba(217,226,231,0.4)" }}>
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2"
          style={{
            background: missingHoursKpi.tasksWithMissing > 0 ? "rgba(234,179,8,0.12)" : "rgba(111,157,120,0.14)",
            border: `1px solid ${missingHoursKpi.tasksWithMissing > 0 ? "rgba(180,83,9,0.25)" : "rgba(22,163,74,0.25)"}`,
          }}
        >
          <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "#556d79" }}>
            HEURES MANQUANTES
          </p>
          <span
            className="text-[10px] font-bold rounded-full px-2 py-0.5"
            style={{
              color: missingHoursKpi.tasksWithMissing > 0 ? "#92400e" : "#166534",
              background: missingHoursKpi.tasksWithMissing > 0 ? "rgba(254,243,199,0.9)" : "rgba(220,252,231,0.9)",
            }}
          >
            {missingHoursKpi.tasksWithMissing} tache(s) · {missingHoursKpi.missingEntries} saisie(s)
          </span>
        </div>
      </div>

      {/* Barre avancement global */}
      <div className="border-b px-4 py-3" style={{ background: "rgba(194,210,218,0.4)", borderColor: "rgba(63,97,112,0.2)" }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(63,97,112,0.15)" }}>
            <TrendingUp className="w-3.5 h-3.5" style={{ color: "#3f6170" }} />
          </div>
          <span className="text-[9px] font-bold tracking-widest uppercase flex-1" style={{ color: "#556d79" }}>AVANCEMENT GLOBAL</span>
          <span className="text-[13px] font-black" style={{ color: "#3f6170" }}>{globalPct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(63,97,112,0.15)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${globalPct}%`, background: "linear-gradient(90deg, #3f6170, #5a8a9f)" }} />
        </div>
        <div className="flex justify-between mt-2 text-[8px] font-semibold tracking-widest uppercase" style={{ color: "#556d79" }}>
          <span className="flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" style={{ color: "#059669" }} />{completedTasks} TERM.</span>
          <span className="flex items-center gap-0.5"><Timer className="w-2.5 h-2.5" style={{ color: "#b45309" }} />{inProgressTasks} EN COURS</span>
          <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" style={{ color: "#556d79" }} />{totalTasks - completedTasks - inProgressTasks} À FAIRE</span>
        </div>
      </div>

      {/* Alertes retard */}
      {overdueTasks.length > 0 && (
        <div className="px-4 pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-bold text-foreground tracking-widest uppercase">ALERTES</span>
            <span className="text-[10px] font-bold text-white bg-red-500 rounded-full w-5 h-5 flex items-center justify-center">
              {overdueTasks.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {overdueTasks.slice(0, 4).map((task) => (
              <Link
                key={task.id}
                to={`/task/${task.id}`}
                className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2"
              >
                <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-red-800 truncate">{task.description}</p>
                  {task.project_name && (
                    <p className="text-[10px] text-red-500 truncate">{task.project_name}</p>
                  )}
                </div>
                <span className="text-[9px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded-md shrink-0 uppercase">
                  Retard
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Chantiers récents */}
      <div className="px-3 pt-2 pb-4">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-[9px] font-bold text-foreground tracking-widest uppercase">CHANTIERS RECENTS</h2>
          <Link to="/projects" className="flex items-center gap-0.5 text-xs text-primary font-semibold">
            Tout voir <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="space-y-2">
          {recentProjects.map((project) => {
            const projectId = String(project?.id || "").trim();
            return (
              <ProjectCard
                key={project.id}
                project={project}
                taskCount={taskCountByProject[projectId] || 0}
                totalHoursMinutes={projectHoursById[project.id] || 0}
                missingEntries={missingEntriesByProject[project.id] || 0}
              />
            );
          })}
          {recentProjects.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Aucun chantier pour le moment
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
