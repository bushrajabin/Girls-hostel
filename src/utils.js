const pad = (n) => String(n).padStart(2, "0");

export const fmtDate = (d) =>
  new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

// Local timezone ke hisaab se "2026-10"
export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// Local timezone ke hisaab se "2026-10-13"
export function today() {
  return `${currentMonth()}-${pad(new Date().getDate())}`;
}

// "2026-10" -> {start, end} ISO strings
export function monthRange(val) {
  if (!val) return null;
  const [y, m] = val.split("-").map(Number);
  return { start: new Date(y, m - 1, 1).toISOString(), end: new Date(y, m, 1).toISOString() };
}

// Returns false agar export ke liye data nahi hai
export function downloadCSV(filename, rows) {
  if (!rows.length) return false;
  const cols = Object.keys(rows[0]);
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}
