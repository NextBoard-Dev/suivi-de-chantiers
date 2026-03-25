import React from "react";
import { cn } from "@/lib/utils";

export default function ProgressBar({ value = 0, size = "default", showLabel = true, className }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color =
    pct >= 100 ? "bg-emerald-500" :
    pct >= 60 ? "bg-blue-500" :
    pct >= 30 ? "bg-amber-500" :
    "bg-red-400";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex-1 rounded-full bg-muted overflow-hidden",
          size === "sm" ? "h-1.5" : "h-2.5"
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn("font-semibold tabular-nums", size === "sm" ? "text-[10px]" : "text-xs")}>
          {pct}%
        </span>
      )}
    </div>
  );
}