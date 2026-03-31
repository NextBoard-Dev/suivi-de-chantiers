import React from "react";
import { useQuery } from "@tanstack/react-query";
import { dataClient } from "@/api/dataClient";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, AlertTriangle, ListChecks, CheckCircle2, Timer, TrendingUp, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TaskCard from "../components/common/TaskCard";
import MobileGantt from "../components/gantt/MobileGantt";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { computeMissingEntriesByTask } from "@/lib/missingHours";

const TODAY = new Date().toISOString().slice(0, 10);

function formatLongDateSafe(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date
      .toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
      .toUpperCase();
  } catch (_) {
    return "";
  }
}

function isLate(task) {
  if (!task) return false;
  return !!task.end_date && (task.progress || 0) < 100 && task.end_date < TODAY;
}

export default function ProjectDetail() {
  const { id: projectId = "" } = useParams();
  const navigate = useNavigate();

  const { data: project, isLoading: loadingP } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const list = await dataClient.entities.Project.filter({ id: projectId }, "-updated_date", 1);
      return list[0] || null;
    },
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading: loadingT } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () => dataClient.entities.Task.filter({ project_id: projectId }, "-updated_date", 200),
    enabled: !!projectId,
  });
  const { data: timeLogs = [] } = useQuery({
    queryKey: ["time-logs", "tasks-missing-project", projectId],
    queryFn: () => dataClient.entities.TimeLog.list("-date", 0),
    enabled: !!projectId,
  });

  const isLoading = loadingP || loadingT;
  const taskList = React.useMemo(
    () => (Array.isArray(tasks) ? tasks.filter(Boolean) : []),
    [tasks]
  );
  const timeLogList = React.useMemo(
    () => (Array.isArray(timeLogs) ? timeLogs.filter(Boolean) : []),
    [timeLogs]
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 text-center py-20">
        <p className="text-muted-foreground mb-4">Chantier non trouve</p>
        <button onClick={() => navigate("/projects")} className="text-primary text-sm font-semibold underline">
          Retour aux chantiers
        </button>
      </div>
    );
  }

  const completedCount = taskList.filter((t) => (t.progress || 0) >= 100).length;
  const inProgressCount = taskList.filter((t) => {
    const p = t.progress || 0;
    return p > 0 && p < 100;
  }).length;
  const lateTasks = taskList.filter(isLate);
  const avgProgress = taskList.length > 0
    ? Math.round(taskList.reduce((sum, t) => sum + (t.progress || 0), 0) / taskList.length)
    : project.progress || 0;
  const missingEntriesByTask = React.useMemo(
    () => computeMissingEntriesByTask(taskList, timeLogList),
    [taskList, timeLogList]
  );

  const endDates = taskList.map((t) => t.end_date).filter(Boolean).sort();
  const finPrevue = endDates[endDates.length - 1] || project.end_date;

  return (
    <div className="space-y-0">
      <div className="px-4 py-2.5" style={{ background: "rgba(235,230,220,0.6)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} style={{ color: "#3f6170" }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <MapPin className="w-3 h-3 shrink-0" style={{ color: "#3f6170" }} />
              <span className="text-[8px] font-bold tracking-widest uppercase truncate" style={{ color: "#556d79" }}>{project.site}</span>
            </div>
            <h1 className="text-[13px] font-black uppercase tracking-wide leading-tight truncate" style={{ color: "#14242c" }}>{project.name}</h1>
            {project.subproject && (
              <p className="text-[9px] tracking-wide truncate mt-0.5" style={{ color: "#556d79" }}>{project.subproject}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-3 py-1.5" style={{ background: "rgba(217,226,231,0.4)" }}>
        <div className="flex flex-col items-center justify-center py-1.5 px-2 gap-0.5 rounded-xl" style={{ background: "rgba(217,226,231,0.85)", border: "1px solid rgba(63,97,112,0.2)" }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(63,97,112,0.15)" }}>
            <ListChecks className="w-3.5 h-3.5" style={{ color: "#3f6170" }} />
          </div>
          <p className="text-xl font-black leading-none" style={{ color: "#14242c" }}>{taskList.length}</p>
          <p className="text-[8px] font-bold tracking-widest uppercase text-center" style={{ color: "#556d79" }}>TACHES</p>
          <p className="text-[8px] font-semibold" style={{ color: "#556d79" }}>{taskList.length - completedCount - inProgressCount} a faire</p>
        </div>
        <div className="flex flex-col items-center justify-center py-1.5 px-2 gap-0.5 rounded-xl" style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(180,83,9,0.2)" }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(234,179,8,0.15)" }}>
            <Timer className="w-3.5 h-3.5" style={{ color: "#b45309" }} />
          </div>
          <p className="text-xl font-black leading-none" style={{ color: "#b45309" }}>{inProgressCount}</p>
          <p className="text-[8px] font-bold tracking-widest uppercase text-center" style={{ color: "#556d79" }}>EN COURS</p>
          <p className="text-[8px] font-semibold" style={{ color: "#556d79" }}>{lateTasks.length} en retard</p>
        </div>
        <div className="flex flex-col items-center justify-center py-1.5 px-2 gap-0.5 rounded-xl" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(5,150,105,0.2)" }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#059669" }} />
          </div>
          <p className="text-xl font-black leading-none" style={{ color: "#059669" }}>{completedCount}</p>
          <p className="text-[8px] font-bold tracking-widest uppercase text-center" style={{ color: "#556d79" }}>TERM.</p>
          <p className="text-[8px] font-semibold" style={{ color: "#556d79" }}>{taskList.length > 0 ? Math.round((completedCount / taskList.length) * 100) : 0}% du total</p>
        </div>
      </div>

      <div className="border-b px-4 py-3" style={{ background: "rgba(194,210,218,0.4)", borderColor: "rgba(63,97,112,0.2)" }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(63,97,112,0.15)" }}>
            <TrendingUp className="w-3.5 h-3.5" style={{ color: "#3f6170" }} />
          </div>
          <span className="text-[9px] font-bold tracking-widest uppercase flex-1" style={{ color: "#556d79" }}>AVANCEMENT GLOBAL</span>
          <span className="text-[13px] font-black" style={{ color: "#3f6170" }}>{avgProgress}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(63,97,112,0.15)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${avgProgress}%`, background: "linear-gradient(90deg, #3f6170, #5a8a9f)" }} />
        </div>
        {finPrevue && (
          <div className="flex items-center gap-1 mt-2">
            <Calendar className="w-3 h-3 shrink-0" style={{ color: "#556d79" }} />
            <p className="text-[8px] font-semibold tracking-widest uppercase" style={{ color: "#556d79" }}>
              FIN PREVUE · {formatLongDateSafe(finPrevue) || "-"}
            </p>
          </div>
        )}
      </div>

      {lateTasks.length > 0 && (
        <div className="px-3 pt-2">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] font-bold text-foreground tracking-widest uppercase">ALERTES RETARD</span>
            <span className="text-[9px] font-bold text-white bg-red-500 rounded-full w-4 h-4 flex items-center justify-center">{lateTasks.length}</span>
          </div>
          <div className="space-y-1">
            {lateTasks.map((task) => (
              <Link key={task.id} to={`/task/${task.id}`}
                className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              >
                <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                <span className="text-[11px] font-semibold text-red-800 truncate flex-1">{task.description}</span>
                <span className="text-[8px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded shrink-0 uppercase">RETARD</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 pt-2 pb-4">
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="w-full bg-muted mb-2 h-8">
            <TabsTrigger value="tasks" className="flex-1 text-[10px] h-7">
              TACHES {taskList.length > 0 && <span className="ml-1 text-[9px] font-bold opacity-70">({taskList.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="gantt" className="flex-1 text-[10px] h-7">GANTT</TabsTrigger>
          </TabsList>
          <TabsContent value="tasks" className="space-y-2">
            {taskList.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                showProject={false}
                isLate={isLate(task)}
                missingEntries={missingEntriesByTask[task.id] || 0}
              />
            ))}
            {taskList.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aucune tache dans ce chantier
              </div>
            )}
          </TabsContent>
          <TabsContent value="gantt">
            <MobileGantt tasks={taskList} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

