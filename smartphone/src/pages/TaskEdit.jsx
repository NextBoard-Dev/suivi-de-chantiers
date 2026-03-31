import React, { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataClient } from "@/api/dataClient";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import StatusBadge from "../components/common/StatusBadge";
import ProgressBar from "../components/common/ProgressBar";
import { computeTaskProgressAuto } from "@/lib/businessRules";
import { toast } from "@/components/ui/use-toast";
import { supabase, supabaseConfig } from "@/api/supabaseClient";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function minutesToLabel(minutesValue) {
  const total = Number.isFinite(Number(minutesValue)) ? Math.max(0, Math.round(Number(minutesValue))) : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} h`;
  return `${h} h ${m} min`;
}

function minutesToHoursDecimalLabel(minutesValue) {
  const total = Number.isFinite(Number(minutesValue)) ? Math.max(0, Number(minutesValue)) : 0;
  const hours = Math.round((total / 60) * 100) / 100;
  return `${String(hours).replace(".", ",")} h`;
}

function isWeekdayDate(value) {
  const d = new Date(`${String(value || "").slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

function buildWeekdayDateKeys(startDate, endDate) {
  const start = new Date(`${String(startDate || "").slice(0, 10)}T00:00:00`);
  const endRaw = new Date(`${String(endDate || "").slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = Number.isNaN(endRaw.getTime()) ? today : new Date(Math.min(endRaw.getTime(), today.getTime()));
  if (end < start) return [];
  const out = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function defaultIntervenantByOwnerType(ownerType, internalTech, vendor) {
  const type = String(ownerType || "").trim();
  if (type === "INTERNE") return String(internalTech || "").trim();
  if (type === "Prestataire externe") return String(vendor || "").trim();
  if (type === "RSG" || type === "RI") return type;
  return "";
}

function resolveIntervenantLabel(log = {}) {
  const tech = String(log?.technician || log?.internal_tech || "").trim();
  const vendor = String(log?.vendor || "").trim();
  const rawRole = String(log?.role || "").trim().toUpperCase();
  const roleKey = String(log?.role_key || "").trim().toLowerCase();
  if (tech && tech.toUpperCase() !== "INTERNE") return tech;
  if (vendor && vendor.toUpperCase() !== "EXTERNE" && vendor.toUpperCase() !== "PRESTATAIRE EXTERNE") return vendor;
  if (rawRole === "RSG" || rawRole === "RI") return rawRole;
  if (roleKey === "rsg") return "RSG";
  if (roleKey === "ri") return "RI";
  return "Intervenant non precise";
}

function mapStrictTimeLogRow(row = {}) {
  const minutesRaw = Number(row?.minutes);
  const hoursRaw = Number(row?.hours);
  const minutes = Number.isFinite(minutesRaw)
    ? Math.max(0, Math.round(minutesRaw))
    : (Number.isFinite(hoursRaw) ? Math.max(0, Math.round(hoursRaw * 60)) : 0);
  return {
    id: String(row?.id || ""),
    task_id: String(row?.task_id || row?.tache_id || row?.taskId || ""),
    date: String(row?.date_key || row?.date || row?.log_date || row?.day || "").slice(0, 10),
    role_key: String(row?.role_key || "").trim().toLowerCase(),
    role: String(row?.owner_type || row?.role || "").trim(),
    intervenant_label: String(row?.intervenant_label || "").trim(),
    technician: String(row?.technician || row?.internal_tech || "").trim(),
    vendor: String(row?.vendor || "").trim(),
    minutes,
    note: String(row?.note || row?.comment || "").trim(),
  };
}

export default function TaskEdit() {
  const { id: taskId = "" } = useParams();
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
  const [hoursForm, setHoursForm] = useState({
    date: todayIso(),
    hours: "",
    note: "",
    intervenant: "",
  });
  const [localSavedLogs, setLocalSavedLogs] = useState([]);

  useEffect(() => {
    if (task && !form) {
      setForm({
        description: task.description || "",
        owner_type: task.owner_type || "",
        internal_tech: task.internal_tech || "",
        vendor: task.vendor || "",
        start_date: task.start_date || "",
        end_date: task.end_date || "",
      });
    }
  }, [task, form]);

  useEffect(() => {
    if (!form) return;
    const defaultIntervenant = defaultIntervenantByOwnerType(form.owner_type, form.internal_tech, form.vendor);

    setHoursForm((prev) => ({
      ...prev,
      date: prev.date || todayIso(),
      intervenant: prev.intervenant || defaultIntervenant,
    }));
  }, [form]);

  const { data: taskLogs = [], refetch: refetchTaskLogs } = useQuery({
    queryKey: ["time-logs", "task", taskId, task?.project_id || "", task?.description || ""],
    queryFn: async () => dataClient.entities.TimeLog.listForTask(task, "-date", 5000),
    enabled: !!taskId && !!task,
  });
  const { data: strictTaskLogs = [], refetch: refetchStrictTaskLogs } = useQuery({
    queryKey: ["time-logs", "task", "strict", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(supabaseConfig.timeLogsTable)
        .select("*")
        .eq("task_id", taskId)
        .limit(5000);
      if (error) throw error;
      return (Array.isArray(data) ? data : []).map(mapStrictTimeLogRow);
    },
    enabled: !!taskId,
  });
  const { data: taskLogsById = [], refetch: refetchTaskLogsById } = useQuery({
    queryKey: ["time-logs", "task-id", taskId],
    queryFn: async () => dataClient.entities.TimeLog.filter({ task_id: taskId }, "-date", 5000),
    enabled: !!taskId,
  });

  const displayTaskLogs = useMemo(() => {
    const buildLogKey = (log) =>
      String(
        log?.id ||
        `${log?.task_id || log?.taskId || ""}|${log?.date}|${log?.role_key}|${log?.intervenant_label || log?.technician || log?.vendor || ""}`
      );
    const byId = new Map();
    (taskLogs || []).forEach((log) => {
      const key = buildLogKey(log);
      byId.set(key, log);
    });
    (taskLogsById || []).forEach((log) => {
      const key = buildLogKey(log);
      byId.set(key, log);
    });
    (strictTaskLogs || []).forEach((log) => {
      const key = buildLogKey(log);
      byId.set(key, log);
    });
    (localSavedLogs || []).forEach((log) => {
      const key = buildLogKey(log);
      byId.set(key, log);
    });
    return Array.from(byId.values()).sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")));
  }, [taskLogs, taskLogsById, strictTaskLogs, localSavedLogs]);

  const totalTaskMinutes = useMemo(
    () => displayTaskLogs.reduce((sum, log) => sum + (Number.isFinite(Number(log.minutes)) ? Number(log.minutes) : 0), 0),
    [displayTaskLogs]
  );

  const missingWeekdayKeys = useMemo(() => {
    const expected = buildWeekdayDateKeys(form?.start_date || "", form?.end_date || "");
    if (!expected.length) return [];
    const filled = new Set(
      displayTaskLogs
        .map((log) => String(log?.date || "").slice(0, 10))
        .filter((dateKey) => dateKey && isWeekdayDate(dateKey))
    );
    return expected.filter((dateKey) => !filled.has(dateKey));
  }, [form?.start_date, form?.end_date, displayTaskLogs]);

  const saveHoursMutation = useMutation({
    mutationFn: async (payload) => dataClient.entities.TimeLog.saveForTask(payload),
    onSuccess: async (savedLog) => {
      if (savedLog) {
        setLocalSavedLogs((prev) => [savedLog, ...prev].slice(0, 200));
      }
      await queryClient.invalidateQueries({ queryKey: ["time-logs"] });
      try { await refetchTaskLogs(); } catch (_) {}
      try { await refetchTaskLogsById(); } catch (_) {}
      try { await refetchStrictTaskLogs(); } catch (_) {}
      setHoursForm((prev) => ({
        ...prev,
        hours: "",
        note: "",
      }));
      toast({
        title: "Heures enregistrees",
        description: "La saisie des heures reelles a bien ete envoyee.",
      });
    },
    onError: (error) => {
      toast({
        title: "Echec enregistrement",
        description: String(error?.message || "Impossible d'enregistrer la saisie d'heures."),
        variant: "destructive",
      });
    },
  });

  const handleSaveHours = async () => {
    const rawHours = String(hoursForm.hours || "").trim().replace(",", ".");
    const parsed = Number(rawHours);
    if (!hoursForm.date) {
      toast({
        title: "Date obligatoire",
        description: "Choisissez une date pour la saisie.",
        variant: "destructive",
      });
      return;
    }
    const selectedDay = new Date(`${hoursForm.date}T00:00:00`).getDay();
    if (selectedDay === 0 || selectedDay === 6) {
      toast({
        title: "Date invalide",
        description: "La saisie des heures est interdite le samedi et le dimanche.",
        variant: "destructive",
      });
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 24) {
      toast({
        title: "Heures invalides",
        description: "Entrez un nombre entre 0.25 et 24.",
        variant: "destructive",
      });
      return;
    }

    const ownerType = String(form?.owner_type || "").trim();
    const effectiveIntervenant = String(hoursForm.intervenant || "").trim();
    let technician = "";
    let vendor = "";
    if (ownerType === "INTERNE") {
      if (!effectiveIntervenant || effectiveIntervenant.toUpperCase() === "INTERNE") {
        toast({
          title: "Technicien requis",
          description: "Renseignez le nom du technicien interne.",
          variant: "destructive",
        });
        return;
      }
      technician = effectiveIntervenant;
    } else if (ownerType === "Prestataire externe") {
      if (!effectiveIntervenant || effectiveIntervenant.toUpperCase() === "EXTERNE" || effectiveIntervenant.toUpperCase() === "PRESTATAIRE EXTERNE") {
        toast({
          title: "Prestataire requis",
          description: "Renseignez le nom du prestataire externe.",
          variant: "destructive",
        });
        return;
      }
      vendor = effectiveIntervenant;
    }

    await saveHoursMutation.mutateAsync({
      task_id: task.id,
      project_id: task.project_id,
      date: hoursForm.date,
      role: ownerType,
      technician,
      vendor,
      hours: parsed,
      note: hoursForm.note,
    });
  };

  const computedProgress = computeTaskProgressAuto(form?.start_date || "", form?.end_date || "");

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
          {task.owner_type === "INTERNE" && task.internal_tech && (
            <StatusBadge type="status" label={task.internal_tech} />
          )}
          {task.owner_type === "Prestataire externe" && task.vendor && (
            <StatusBadge type="status" label={task.vendor} />
          )}
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
            readOnly
            disabled
            className="mt-1.5 h-11"
          />
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Intervenant</Label>
          <Select
            value={form.owner_type || "none"}
            disabled
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

        {form.owner_type === "INTERNE" && (
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Technicien interne</Label>
            <Input
              value={form.internal_tech || ""}
              readOnly
              disabled
              className="mt-1.5 h-11"
              placeholder="Nom technicien interne"
            />
          </div>
        )}

        {form.owner_type === "Prestataire externe" && (
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Prestataire</Label>
            <Input
              value={form.vendor}
              readOnly
              disabled
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
              readOnly
              disabled
              className="mt-1.5 h-11"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Fin</Label>
            <Input
              type="date"
              value={form.end_date}
              readOnly
              disabled
              className="mt-1.5 h-11"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label className="text-xs font-semibold text-muted-foreground">
              Avancement automatique: {computedProgress}%
            </Label>
            <p className="text-xs font-semibold text-foreground">
              Total heures tache: {minutesToHoursDecimalLabel(totalTaskMinutes)}
            </p>
          </div>
          <ProgressBar value={computedProgress} className="mb-1" />
          <p className="text-[10px] text-muted-foreground">Calcule automatiquement selon les dates de la tache (meme regle que PC).</p>
          <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-muted/30 px-2 py-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground">Heures manquantes</p>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                missingWeekdayKeys.length > 0
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {missingWeekdayKeys.length > 0 ? `${missingWeekdayKeys.length} j` : "0 j"}
            </span>
          </div>
          <p className={`text-[10px] ${missingWeekdayKeys.length > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {missingWeekdayKeys.length > 0
              ? `Heures manquantes: ${missingWeekdayKeys.length} jour(s) ouvre(s) sans saisie.`
              : "Heures manquantes: aucune."}
          </p>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Mode consultation : modification des taches desactivee sur smartphone.
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Saisie heures reelles</h2>
          <p className="text-[10px] text-muted-foreground">
            Seule action autorisee sur smartphone: ajouter les heures reelles.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Date</Label>
            <Input
              type="date"
              value={hoursForm.date}
              onChange={(e) => setHoursForm((prev) => ({ ...prev, date: e.target.value }))}
              className="mt-1.5 h-11"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Heures</Label>
            <Input
              type="number"
              min="0.25"
              max="24"
              step="0.25"
              placeholder="ex: 2.5"
              value={hoursForm.hours}
              onChange={(e) => setHoursForm((prev) => ({ ...prev, hours: e.target.value }))}
              className="mt-1.5 h-11"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Intervenant (saisie)</Label>
          <div className="relative mt-1.5">
            <Input
              value={hoursForm.intervenant}
              readOnly
              disabled
              className="h-11 pr-10 bg-muted/40 text-muted-foreground cursor-not-allowed"
              placeholder="Nom tech interne ou prestataire"
            />
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/80"
              title="Champ verrouille : recupere automatiquement depuis la tache."
              aria-label="Information champ verrouille"
            >
              <Info className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Note (optionnel)</Label>
          <Input
            value={hoursForm.note}
            onChange={(e) => setHoursForm((prev) => ({ ...prev, note: e.target.value }))}
            className="mt-1.5 h-11"
            placeholder="Commentaire court"
          />
        </div>

        <Button
          className="w-full h-11"
          onClick={handleSaveHours}
          disabled={saveHoursMutation.isPending}
        >
          {saveHoursMutation.isPending ? "Enregistrement..." : "Enregistrer les heures reelles"}
        </Button>

        <div className="pt-2 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Historique tache</p>
            <p className="text-[11px] text-muted-foreground">Total: {minutesToLabel(totalTaskMinutes)}</p>
          </div>

          {displayTaskLogs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Aucune heure reelle saisie pour cette tache.</p>
          ) : (
            <div className="space-y-2">
              {displayTaskLogs.slice(0, 8).map((log) => (
                <div key={log.id || `${log.date}-${log.minutes}`} className="rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{log.date || "-"}</p>
                    <p className="text-xs font-semibold text-foreground">{minutesToLabel(log.minutes)}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {resolveIntervenantLabel(log)}
                  </p>
                  {log.note ? <p className="text-[11px] text-muted-foreground">{log.note}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

