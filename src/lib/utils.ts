import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const DEAL_STAGES = [
  { id: "new", label: "New", color: "bg-slate-100 text-slate-700" },
  { id: "researching", label: "Researching", color: "bg-blue-100 text-blue-700" },
  { id: "offer_drafted", label: "Offer Drafted", color: "bg-indigo-100 text-indigo-700" },
  { id: "sent", label: "Sent", color: "bg-purple-100 text-purple-700" },
  { id: "negotiating", label: "Negotiating", color: "bg-amber-100 text-amber-700" },
  { id: "under_contract", label: "Under Contract", color: "bg-emerald-100 text-emerald-700" },
  { id: "closed", label: "Closed", color: "bg-green-100 text-green-800" },
  { id: "dead", label: "Dead", color: "bg-red-100 text-red-700" },
] as const;

export type DealStage = (typeof DEAL_STAGES)[number]["id"];

export function stageLabel(stage: string): string {
  return DEAL_STAGES.find((s) => s.id === stage)?.label ?? stage;
}

export function stageColor(stage: string): string {
  return DEAL_STAGES.find((s) => s.id === stage)?.color ?? "bg-gray-100 text-gray-700";
}

export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}
