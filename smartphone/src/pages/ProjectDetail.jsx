import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataClient } from "@/api/dataClient";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, AlertTriangle, ListChecks, CheckCircle2, Timer, TrendingUp, CalendarClock, Pencil, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TaskCard from "../components/common/TaskCard";
import MobileGantt from "../components/gantt/MobileGantt";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const TODAY = new Date().toISOString().slice(0, 10);

function isLate(task) {
  return !!task.end_date && (task.progress || 0) < 100 && task.end_date < TODAY;
}

export default function ProjectDetail() {
  const projectId = window.location.pathname.split("/project/")[1];
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [openEdit, setOpenEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    site: "",
    subproject: "",
    start_date: "",
    end_date: "",
    lifecycle_status: "a_planifier",
  });

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

  useEffect(() => {
    if (!project) return;
    setEditForm({
      name: project.name || "",
      site: project.site || "",
      subproject: project.subproject || "",
      start_date: project.start_date || "",
      end_date: project.end_date || "",
      lifecycle_status: project.lifecycle_status || "a_planifier",
    });
  }, [project]);

  const updateProjectMutation = useMutation({
    mutationFn: (payload) => dataClient.entities.Project.update(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Chantier mis a jour");
      setOpenEdit(false);
    },
    onError: (error) => {
      toast.error(error?.message || "Mise a jour impossible");
    },
  });

  const closeProjectMutation = useMutation({
    mutationFn: () =>
      dataClient.entities.Project.update(projectId, {
        lifecycle_status: "clos",
        progress: 100,
        end_date: TODAY,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      toast.success("Chantier clos");
    },
    onError: (error) => {
      toast.error(error?.message || "Cloture chantier impossible");
    },
  });

  const isLoading = loadingP || loadingT;

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
        <p className="text-muted-foreground mb-4">Projet non trouve</p>
        <button onClick={() => navigate("/projects")} className="text-primary text-sm font-semibold underline">
          Retour aux projets
        </button>
      </div>
    );
  }

  const completedCount = tasks.filter((t) => (t.progress || 0) >= 100).length;
  const inProgressCount = tasks.filter((t) => {
    const p = t.progress || 0;
    return p > 0 && p < 100;
  }).length;
  const lateTasks = tasks.filter(isLate);
  const avgProgress = tasks.length > 0
    ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length)
    : project.progress || 0;

  const endDates = tasks.map((t) => t.end_date).filter(Boolean).sort();
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
          <Dialog open={openEdit} onOpenChange={setOpenEdit}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-[10px]">
                <Pencil className="w-3 h-3" />
                Editer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifier chantier</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nom chantier</Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div>
                  <Label>Site</Label>
                  <Input value={editForm.site} onChange={(e) => setEditForm({ ...editForm, site: e.target.value })} />
                </div>
                <div>
                  <Label>Sous-projet</Label>
                  <Input value={editForm.subproject} onChange={(e) => setEditForm({ ...editForm, subproject: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Debut</Label>
                    <Input type="date" value={editForm.start_date || ""} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Fin</Label>
                    <Input type="date" value={editForm.end_date || ""} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Statut</Label>
                  <Select value={editForm.lifecycle_status} onValueChange={(v) => setEditForm({ ...editForm, lifecycle_status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_planifier">A planifier</SelectItem>
                      <SelectItem value="en_cours">En cours</SelectItem>
                      <SelectItem value="en_pause">En pause</SelectItem>
                      <SelectItem value="clos">Clos</SelectItem>
                      <SelectItem value="annule">Annule</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={updateProjectMutation.isPending || !editForm.name.trim()}
                  onClick={() => updateProjectMutation.mutate(editForm)}
                >
                  {updateProjectMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            size="sm"
            className="h-7 px-2 gap-1 text-[10px]"
            disabled={closeProjectMutation.isPending || project.lifecycle_status === "clos"}
            onClick={() => closeProjectMutation.mutate()}
          >
            <Lock className="w-3 h-3" />
            Clore
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-3 py-1.5" style={{ background: "rgba(217,226,231,0.4)" }}>
        <div className="flex flex-col items-center justify-center py-1.5 px-2 gap-0.5 rounded-xl" style={{ background: "rgba(217,226,231,0.85)", border: "1px solid rgba(63,97,112,0.2)" }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(63,97,112,0.15)" }}>
            <ListChecks className="w-3.5 h-3.5" style={{ color: "#3f6170" }} />
          </div>
          <p className="text-xl font-black leading-none" style={{ color: "#14242c" }}>{tasks.length}</p>
          <p className="text-[8px] font-bold tracking-widest uppercase text-center" style={{ color: "#556d79" }}>TACHES</p>
          <p className="text-[8px] font-semibold" style={{ color: "#556d79" }}>{tasks.length - completedCount - inProgressCount} a faire</p>
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
          <p className="text-[8px] font-semibold" style={{ color: "#556d79" }}>{tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}% du total</p>
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
            <CalendarClock className="w-3 h-3 shrink-0" style={{ color: "#556d79" }} />
            <p className="text-[8px] font-semibold tracking-widest uppercase" style={{ color: "#556d79" }}>
              FIN PREVUE · {new Date(finPrevue).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
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
              TACHES {tasks.length > 0 && <span className="ml-1 text-[9px] font-bold opacity-70">({tasks.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="gantt" className="flex-1 text-[10px] h-7">GANTT</TabsTrigger>
          </TabsList>
          <TabsContent value="tasks" className="space-y-2">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} showProject={false} isLate={isLate(task)} />
            ))}
            {tasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aucune tache dans ce projet
              </div>
            )}
          </TabsContent>
          <TabsContent value="gantt">
            <MobileGantt tasks={tasks} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

