import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dataClient } from "@/api/dataClient";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import StatusBadge from "../components/common/StatusBadge";
import ProgressBar from "../components/common/ProgressBar";
import { toast } from "sonner";

export default function TaskEdit() {
  const taskId = window.location.pathname.split("/task/")[1];
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const list = await dataClient.entities.Task.filter({ id: taskId });
      return list[0] || null;
    },
    enabled: !!taskId,
  });

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (task && !form) {
      setForm({
        description: task.description || "",
        owner_type: task.owner_type || "",
        vendor: task.vendor || "",
        start_date: task.start_date || "",
        end_date: task.end_date || "",
        progress: task.progress || 0,
      });
    }
  }, [task, form]);

  const updateMutation = useMutation({
    mutationFn: (data) => dataClient.entities.Task.update(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
      toast.success("Tâche enregistrée");
    },
    onError: (error) => {
      toast.error(error?.message || "Enregistrement impossible");
    },
  });

  const handleSave = () => {
    if (!form) return;
    const duration =
      form.start_date && form.end_date
        ? Math.max(
            1,
            Math.ceil(
              (new Date(form.end_date) - new Date(form.start_date)) / (1000 * 60 * 60 * 24)
            ) + 1
          )
        : 0;
    updateMutation.mutate({ ...form, duration_days: duration });
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!task || !form) {
    return (
      <div className="p-4 text-center py-20">
        <p className="text-muted-foreground mb-4">Tâche non trouvée</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" />
        Retour
      </Button>

      {/* Header info */}
      <div className="bg-card rounded-xl border border-border p-4">
        <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-0.5">
          {task.site} · {task.project_name}
        </p>
        <h1 className="text-base font-bold text-foreground">{task.description}</h1>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {task.owner_type && <StatusBadge type="owner" label={task.owner_type} />}
          {task.statuses?.map((s, i) => (
            <StatusBadge key={i} type="status" label={s} />
          ))}
        </div>
      </div>

      {/* Edit form */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1.5 h-11"
          />
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Intervenant</Label>
          <Select
            value={form.owner_type || "none"}
            onValueChange={(v) => setForm({ ...form, owner_type: v === "none" ? "" : v })}
          >
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue placeholder="Choisir" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Choisir —</SelectItem>
              <SelectItem value="INTERNE">INTERNE</SelectItem>
              <SelectItem value="RSG">RSG</SelectItem>
              <SelectItem value="RI">RI</SelectItem>
              <SelectItem value="Prestataire externe">Prestataire externe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.owner_type === "Prestataire externe" && (
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Prestataire</Label>
            <Input
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              className="mt-1.5 h-11"
              placeholder="Nom du prestataire"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Début</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="mt-1.5 h-11"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Fin</Label>
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="mt-1.5 h-11"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground mb-2 block">
            Avancement: {form.progress}%
          </Label>
          <ProgressBar value={form.progress} className="mb-3" />
          <Slider
            value={[form.progress]}
            onValueChange={([v]) => setForm({ ...form, progress: v })}
            max={100}
            step={5}
            className="mt-2"
          />
        </div>

        <Button
          className="w-full h-12 gap-2 text-sm font-semibold"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          <Save className="w-4 h-4" />
          {updateMutation.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
      </div>
    </div>
  );
}

