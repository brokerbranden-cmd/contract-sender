"use client";

import { useEffect, useState } from "react";

export type FarBarStatus = { exists: boolean; path: string };

export function useFarBarStatus() {
  const [status, setStatus] = useState<FarBarStatus | null>(null);
  useEffect(() => {
    fetch("/api/farbar/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ exists: false, path: "forms/farbar-asis.pdf" }));
  }, []);
  return status;
}

export const CONTRACT_TYPE_OPTIONS = [
  { value: "auto", label: "Auto (FAR/BAR if form file present)" },
  { value: "farbar", label: "FAR/BAR AS IS (official form)" },
  { value: "custom", label: "Custom AS-IS (built-in)" },
];

export function FarBarMissingNotice({ status }: { status: FarBarStatus | null }) {
  if (!status || status.exists) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <strong>FAR/BAR AS IS form not found.</strong> Offers will use the built-in
      custom AS-IS contract. To send the official form, copy your licensed{" "}
      <code>FloridaRealtors/FloridaBar-ASIS-7x</code> PDF (13 pages, flattened) to{" "}
      <code className="break-all">{status.path}</code> (or set the path below /{" "}
      <code>FARBAR_ASIS_PATH</code>). It is gitignored and never committed.
    </div>
  );
}
