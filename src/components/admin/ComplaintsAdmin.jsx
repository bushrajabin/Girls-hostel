import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../Toast";
import { fmtDate, currentMonth, monthRange, downloadCSV } from "../../utils";
import { CATEGORIES, STATUSES } from "../../constants";

const LIMIT = 2000;
const EMPTY = { month: "", room: "", cat: "", status: "", search: "" };

export default function ComplaintsAdmin({ tick }) {
  const toast = useToast();
  const [f, setF] = useState({ ...EMPTY, month: currentMonth() });
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(
    async (flt) => {
      let q = supabase
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      const r = monthRange(flt.month);
      if (r) q = q.gte("created_at", r.start).lt("created_at", r.end);
      if (flt.room.trim()) q = q.eq("room_number", flt.room.trim());
      if (flt.cat) q = q.eq("category", flt.cat);
      if (flt.status) q = q.eq("status", flt.status);
      const { data, error } = await q;
      if (error) return toast("Load error: " + error.message, "err");
      const s = flt.search.trim().toLowerCase();
      setRows(
        s
          ? data.filter((c) =>
              `${c.student_name} ${c.description} ${c.category}`.toLowerCase().includes(s)
            )
          : data
      );
      setLoaded(true);
    },
    [toast]
  );

  // pehli baar aur nayi complaint aane par (tick) reload
  useEffect(() => {
    load(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((c) => c.status === "Pending").length,
      prog: rows.filter((c) => c.status === "In Progress").length,
      solved: rows.filter((c) => c.status === "Solved").length,
    }),
    [rows]
  );

  const catCounts = useMemo(() => {
    const m = {};
    rows.forEach((c) => (m[c.category] = (m[c.category] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  function reset() {
    setF(EMPTY);
    load(EMPTY);
  }

  function exportCsv() {
    const ok = downloadCSV(
      "complaints.csv",
      rows.map((c) => ({
        Ticket: c.ticket_no,
        Date: fmtDate(c.created_at),
        Student: c.student_name,
        Room: c.room_number,
        Contact: c.contact,
        Category: c.category,
        Description: c.description,
        Status: c.status,
        Remarks: c.admin_remarks || "",
        Solved_On: c.resolved_at ? fmtDate(c.resolved_at) : "",
      }))
    );
    if (!ok) toast("Export ke liye data nahi hai", "err");
  }

  return (
    <>
      <div className="stats">
        <div className="stat"><b>{stats.total}</b><span>Total (filtered)</span></div>
        <div className="stat"><b>{stats.pending}</b><span>Pending</span></div>
        <div className="stat"><b>{stats.prog}</b><span>In Progress</span></div>
        <div className="stat"><b>{stats.solved}</b><span>Solved</span></div>
      </div>

      <div className="card">
        <h2>Filter & Search</h2>
        <form
          className="filters"
          onSubmit={(e) => { e.preventDefault(); load(f); }}
        >
          <div><label>Month</label><input type="month" value={f.month} onChange={set("month")} /></div>
          <div><label>Room No.</label><input type="text" placeholder="e.g. 204" value={f.room} onChange={set("room")} /></div>
          <div>
            <label>Category</label>
            <select value={f.cat} onChange={set("cat")}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label>Status</label>
            <select value={f.status} onChange={set("status")}>
              <option value="">All status</option>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label>Search</label><input type="text" placeholder="naam / description" value={f.search} onChange={set("search")} /></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn small" type="submit">Apply</button>
            <button className="btn small ghost" type="button" onClick={reset}>Reset</button>
            <button className="btn small ghost" type="button" onClick={exportCsv}>CSV</button>
          </div>
        </form>
        <div className="chips">
          {catCounts.map(([k, v]) => (
            <span className="chip" key={k}>{k}: <b>{v}</b></span>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Date</th><th>Student / Room</th><th>Category</th>
                <th>Description</th><th>Status</th><th>Remarks</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <ComplaintRow key={c.id + c.updated_at} c={c} onSaved={() => load(f)} />
              ))}
            </tbody>
          </table>
        </div>
        {loaded && rows.length === 0 && <div className="empty">Koi complaint nahi mili.</div>}
      </div>
    </>
  );
}

function ComplaintRow({ c, onSaved }) {
  const toast = useToast();
  const [status, setStatus] = useState(c.status);
  const [remarks, setRemarks] = useState(c.admin_remarks || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("complaints")
      .update({ status, admin_remarks: remarks.trim() || null })
      .eq("id", c.id);
    setBusy(false);
    if (error) return toast("Update failed: " + error.message, "err");
    toast("Status update ho gaya ✅");
    onSaved();
  }

  return (
    <tr>
      <td>{c.ticket_no}</td>
      <td>
        {fmtDate(c.created_at)}
        {c.resolved_at && <><br /><small className="meta">Solved: {fmtDate(c.resolved_at)}</small></>}
      </td>
      <td>
        <b>{c.student_name}</b><br />Room {c.room_number}<br /><small>{c.contact}</small>
      </td>
      <td>{c.category}</td>
      <td className="desc">{c.description}</td>
      <td>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </td>
      <td>
        <input type="text" maxLength={300} placeholder="Note (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </td>
      <td><button className="btn small" type="button" disabled={busy} onClick={save}>Save</button></td>
    </tr>
  );
}
