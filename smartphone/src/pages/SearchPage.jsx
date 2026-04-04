import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dataClient } from "@/api/dataClient";
import { Input } from "@/components/ui/input";
import { Search, Folder, ClipboardList } from "lucide-react";
import TaskCard from "../components/common/TaskCard";
import ProjectCard from "../components/common/ProjectCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { computeProjectHoursById } from "@/lib/projectHours";
import { computeMissingEntriesByTask } from "@/lib/missingHours";

export default function SearchPage() {
  const [query, setQuery] = useState("");

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => dataClient.entities.Task.list("-updated_date", 500),
    staleTime: 60000,
    refetchOnMount: false,
  });
  const { data: tasks = [], isLoading: loadingTasks } = tasksQuery;

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => dataClient.entities.Project.list("-updated_date", 200),
  });
  const { data: projects = [], isLoading: loadingProjects } = projectsQuery;
  const { data: timeLogs = [] } = useQuery({
    queryKey: ["time-logs", "project-hours-search"],
    queryFn: () => dataClient.entities.TimeLog.list("-date", 0),
  });

  const taskCountByProject = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const projectKey = String(t?.project_id || t?.projectId || "").trim();
      if (projectKey) map[projectKey] = (map[projectKey] || 0) + 1;
    });
    return map;
  }, [tasks]);
  const projectHoursById = useMemo(
    () => computeProjectHoursById(projects, tasks, timeLogs),
    [projects, tasks, timeLogs]
  );
  const missingEntriesByTask = useMemo(
    () => computeMissingEntriesByTask(tasks, timeLogs),
    [tasks, timeLogs]
  );
  const missingEntriesByProject = useMemo(() => {
    const out = {};
    (projects || []).forEach((project) => {
      const projectId = String(project?.id || "").trim();
      if (!projectId) return;
      const projectTaskIds = (tasks || [])
        .filter((task) => String(task?.project_id || task?.projectId || "").trim() === projectId)
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

  const q = query.toLowerCase().trim();

  const filteredTasks = useMemo(() => {
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        (t.description || "").toLowerCase().includes(q) ||
        (t.project_name || "").toLowerCase().includes(q) ||
        (t.site || "").toLowerCase().includes(q) ||
        (t.vendor || "").toLowerCase().includes(q) ||
        (t.statuses || []).some((s) => s.toLowerCase().includes(q))
    );
  }, [tasks, q]);

  const filteredProjects = useMemo(() => {
    if (!q) return projects;
    return projects.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.site || "").toLowerCase().includes(q) ||
        (p.subproject || "").toLowerCase().includes(q)
    );
  }, [projects, q]);
  return (
    <div className="p-4 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher un chantier, une tâche, un site..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-8 text-[12px] rounded-lg bg-white"
            autoFocus
          />
      </div>

      {!q ? (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Tapez pour rechercher parmi les chantiers et taches
          </p>
        </div>
      ) : (
        <Tabs defaultValue="tasks">
          <TabsList className="w-full bg-muted">
            <TabsTrigger value="tasks" className="flex-1 text-xs gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" />
              Tâches ({filteredTasks.length})
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex-1 text-xs gap-1.5">
              <Folder className="w-3.5 h-3.5" />
              Chantiers ({filteredProjects.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-3 space-y-2.5">
            {filteredTasks.map((task) => {
              const taskKey = String(task?.id || task?.task_id || "").trim();
              return (
                <TaskCard key={task.id} task={task} missingEntries={missingEntriesByTask[taskKey] || 0} />
              );
            })}
            {filteredTasks.length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground">
                Aucune tâche trouvée
              </p>
            )}
          </TabsContent>

          <TabsContent value="projects" className="mt-3 space-y-2.5">
            {filteredProjects.map((project) => {
              const projectId = String(project?.id || "").trim();
              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  taskCount={taskCountByProject[projectId] || 0}
                  totalHoursMinutes={projectHoursById[project.id] || 0}
                  missingEntries={missingEntriesByProject[projectId] || 0}
                />
              );
            })}
            {filteredProjects.length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground">
                Aucun chantier trouve
              </p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
