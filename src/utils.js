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

// Supabase returns max 1000 rows per request: this keeps fetching until all rows are in.
// makeQuery() must return a fresh query each time (with a stable .order()).
export async function fetchAll(makeQuery, size = 1000) {
  const all = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await makeQuery().range(from, from + size - 1);
    if (error) return { data: null, error };
    all.push(...data);
    if (data.length < size) break;
  }
  return { data: all, error: null };
}

// Small CSV parser (quotes, commas, newlines). Returns array of arrays.
export function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  const src = text.replace(/^﻿/, "");
  // Excel in some regions saves with ; or tab
  const first = src.split(/\r?\n/, 1)[0] || "";
  const sep = first.includes("\t") ? "\t" : first.split(";").length > first.split(",").length ? ";" : ",";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

// Sort students: floor, then room (numeric), then name
export const byRoom = (a, b) =>
  (a.floor ?? -1) - (b.floor ?? -1) ||
  String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true }) ||
  String(a.name).localeCompare(String(b.name));