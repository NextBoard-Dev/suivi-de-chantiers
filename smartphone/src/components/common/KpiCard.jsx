import React from "react";
import { cn } from "@/lib/utils";

const colorMap = {
  primary: {
    bg: "bg-gradient-to-br from-indigo-500 to-indigo-600",
    icon: "text-white",
    text: "text-white",
    sub: "text-white/70",
  },
  success: {
    bg: "bg-gradient-to-br from-emerald-400 to-emerald-600",
    icon: "text-white",
    text: "text-white",
    sub: "text-white/70",
  },
  warning: {
    bg: "bg-gradient-to-br from-amber-400 to-orange-500",
    icon: "text-white",
    text: "text-white",
    sub: "text-white/70",
  },
  danger: {
    bg: "bg-gradient-to-br from-red-400 to-rose-600",
    icon: "text-white",
    text: "text-white",
    sub: "text-white/70",
  },
  info: {
    bg: "bg-gradient-to-br from-sky-400 to-blue-500",
    icon: "text-white",
    text: "text-white",
    sub: "text-white/70",
  },
  violet: {
    bg: "bg-gradient-to-br from-violet-400 to-purple-600",
    icon: "text-white",
    text: "text-white",
    sub: "text-white/70",
  },
};

export default function KpiCard({ label, value, icon: Icon, color = "primary", subtitle }) {
  const theme = colorMap[color] || colorMap.primary;

  return (
    <div className={cn("rounded-2xl p-4 shadow-sm flex flex-col gap-2", theme.bg)}>
      <div className="flex items-center justify-between">
        <div className={cn("w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center", theme.icon)}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <div>
        <p className={cn("text-2xl font-bold leading-none", theme.text)}>{value}</p>
        <p className={cn("text-[11px] font-semibold mt-1", theme.sub)}>{label}</p>
        {subtitle && <p className={cn("text-[10px] mt-0.5", theme.sub)}>{subtitle}</p>}
      </div>
    </div>
  );
}