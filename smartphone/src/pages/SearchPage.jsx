import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dataClient } from "@/api/dataClient";
import { Input } from "@/components/ui/input";
import { Search, Folder, ClipboardList } from "lucide-react";
import TaskCard from "../components/common/TaskCard";
import ProjectCard from "../components/common/ProjectCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SearchPage() {
  const [query, setQuery] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => dataClient.entities.Task.list("-updated_date", 500),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => dataClient.entities.Project.list("-updated_date", 200),
  });

  const taskCountByProject = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (t.project_id) map[t.project_id] = (map[t.project_id] || 0) + 1;
    });
    return map;
  }, [tasks]);

  const q = query.toLowerCase().trim();

  const filteredTasks = useMemo(() => {
    if (!q) return [];
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
    if (!q) return [];
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
            Tapez pour rechercher parmi les projets et tâches
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
              Projets ({filteredProjects.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-3 space-y-2.5">
            {filteredTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
            {filteredTasks.length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground">
                Aucune tâche trouvée
              </p>
            )}
          </TabsContent>

          <TabsContent value="projects" className="mt-3 space-y-2.5">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                taskCount={taskCountByProject[project.id] || 0}
              />
            ))}
            {filteredProjects.length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground">
                Aucun projet trouvé
              </p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
