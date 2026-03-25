import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const defaultFilters = {
  site: "all",
  project: "all",
  owner: "all",
  corpsetat: "all",   // valeur réelle du statut (ex: "Etude", "Peinture")
  state: "all",       // all | late | in_progress | done | not_started
  startAfter: "",
  endBefore: "",
};

export default function FilterSheet({
  sites = [],
  projects = [],
  corpsEtats = [],    // valeurs dynamiques extraites des tâches
  filters,
  onFilterChange,
  onReset,
}) {
  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (["site", "project", "owner", "corpsetat", "state"].includes(k))
      return v && v !== "all";
    return !!v;
  }).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 relative">
          <Filter className="w-3.5 h-3.5" />
          Filtres
          {activeCount > 0 && (
            <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-primary text-primary-foreground">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base">Filtres</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-6">

          {/* Site */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Site / Zone
            </label>
            <Select value={filters.site || "all"} onValueChange={(v) => onFilterChange({ ...filters, site: v, project: "all" })}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Tous les sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les sites</SelectItem>
                {sites.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Projet */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Projet
            </label>
            <Select value={filters.project || "all"} onValueChange={(v) => onFilterChange({ ...filters, project: v })}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Tous les projets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les projets</SelectItem>
                {projects.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Intervenant */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Intervenant
            </label>
            <Select value={filters.owner || "all"} onValueChange={(v) => onFilterChange({ ...filters, owner: v })}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="INTERNE">INTERNE</SelectItem>
                <SelectItem value="RSG">RSG</SelectItem>
                <SelectItem value="RI">RI</SelectItem>
                <SelectItem value="Prestataire externe">Prestataire externe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Corps d'état — valeurs dynamiques */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Corps d'état / Statut
            </label>
            <Select value={filters.corpsetat || "all"} onValueChange={(v) => onFilterChange({ ...filters, corpsetat: v })}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Tous les corps d'état" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les corps d'état</SelectItem>
                {corpsEtats.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* État d'avancement */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              État d'avancement
            </label>
            <Select value={filters.state || "all"} onValueChange={(v) => onFilterChange({ ...filters, state: v })}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="not_started">Non commencé (0%)</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="done">Terminé (100%)</SelectItem>
                <SelectItem value="late">En retard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Plage de dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Début après le
              </label>
              <Input
                type="date"
                value={filters.startAfter || ""}
                onChange={(e) => onFilterChange({ ...filters, startAfter: e.target.value })}
                className="h-11"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Fin avant le
              </label>
              <Input
                type="date"
                value={filters.endBefore || ""}
                onChange={(e) => onFilterChange({ ...filters, endBefore: e.target.value })}
                className="h-11"
              />
            </div>
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={onReset}>
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser les filtres
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}