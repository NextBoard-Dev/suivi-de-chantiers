import React from "react";

const ownerStyles = {
  "INTERNE":             "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "RSG":                 "bg-violet-50 text-violet-700 border border-violet-200",
  "RI":                  "bg-sky-50 text-sky-700 border border-sky-200",
  "Prestataire externe": "bg-amber-50 text-amber-700 border border-amber-200",
};

export default function StatusBadge({ type, label }) {
  if (type === "owner") {
    const cls = ownerStyles[label] || "bg-slate-50 text-slate-600 border border-slate-200";
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${cls}`}>
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
      {label}
    </span>
  );
}