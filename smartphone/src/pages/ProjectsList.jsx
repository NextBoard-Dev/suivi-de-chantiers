import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataClient } from "@/api/dataClient";
import ProjectCard from "../components/common/ProjectCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const DEFAULT_CHANTIER_FORM = {
  name: "",
  site: "",
  subproject: "",
  start_date: "",
  end_date: "",
  lifecycle_status: "a_planifier",
};

export default function ProjectsList() {
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState(DEFAULT_CHANTIER_FORM);
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading: loadingP } = useQuery({
    queryKey: ["projects"],
    queryFn: () => dataClient.entities.Project.list("-updated_date", 200),
  });

  const { data: tasks = [], isLoading: loadingT } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => dataClient.entities.Task.list("-updated_date", 500),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => dataClient.entities.Project.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Chantier cree");
      setOpenCreate(false);
      setCreateForm(DEFAULT_CHANTIER_FORM);
    },
    onError: (error) => {
      toast.error(error?.message || "Creation chantier impossible");
    },
  });

  const isLoading = loadingP || loadingT;

  const taskCountByProject = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (t.project_id) {
        map[t.project_id] = (map[t.project_id] || 0) + 1;
      }
    });
    return map;
  }, [tasks]);

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

  const submitCreate = () => {
    createMutation.mutate(createForm);
  };

  return (
    <div className="space-y-0">
      <div className="px-4 py-2 flex items-center justify-between" style={{ background: "rgba(235,230,220,0.6)" }}>
        <p className="text-[11px] font-bold text-foreground tracking-widest uppercase">PROJETS</p>
        <div className="flex items-center gap-2">
          <p className="text-[9px] text-muted-foreground font-semibold">{filtered.length} projet{filtered.length !== 1 ? "s" : ""}</p>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 px-2.5 gap-1 text-[10px]">
                <Plus className="w-3.5 h-3.5" />
                Chantier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau chantier</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nom chantier</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Nom du chantier"
                  />
                </div>
                <div>
                  <Label>Site</Label>
                  <Input
                    value={createForm.site}
                    onChange={(e) => setCreateForm({ ...createForm, site: e.target.value })}
                    placeholder="Nom du site"
                  />
                </div>
                <div>
                  <Label>Sous-projet</Label>
                  <Input
                    value={createForm.subproject}
                    onChange={(e) => setCreateForm({ ...createForm, subproject: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Debut</Label>
                    <Input
                      type="date"
                      value={createForm.start_date}
                      onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Fin</Label>
                    <Input
                      type="date"
                      value={createForm.end_date}
                      onChange={(e) => setCreateForm({ ...createForm, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Statut</Label>
                  <Select
                    value={createForm.lifecycle_status}
                    onValueChange={(v) => setCreateForm({ ...createForm, lifecycle_status: v })}
                  >
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
                  disabled={createMutation.isPending || !createForm.name.trim()}
                  onClick={submitCreate}
                >
                  {createMutation.isPending ? "Creation..." : "Creer le chantier"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Aucun projet trouve
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

