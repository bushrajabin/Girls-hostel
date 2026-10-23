import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../Toast";
import { fmtDate, currentMonth, monthRange, downloadCSV } from "../../utils";
import { CATEGORIES, STATUSES, FLOORS, floorLabel } from "../../constants";

const LIMIT = 2000;
const EMPTY = { month: "", room: "", cat: "", status: "", floor: "", search: "" };
const DAY = 24 * 60 * 60 * 1000;

function fmtDuration(ms) {
  const h = ms / 36e5;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${h.toFixed(1)} hr`;
  return `${(h / 24).toFixed(1)} days`;
}

export default function ComplaintsAdmin({ tick }) {
  const toast = useToast();
  const [f, setF] = useState({ ...EMPTY, month: currentMonth() });
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState([]); // caretaker names used before (for suggestions)
  const [loaded, setLoaded] = useState(false);
  const [fresh, setFresh] = useState(() => new Set()); // complaints that arrived while this page was open
  const lastIds = useRef(null);

  const load = useCallback(
    async (flt, detectNew = false) => {
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
      if (flt.floor !== "") q = q.eq("floor", Number(flt.floor));
      const { data, error } = await q;
      if (error) return toast("Load error: " + error.message, "err");
      const s = flt.search.trim().toLowerCase();
      const list = s
        ? data.filter((c) =>
            `${c.student_name} ${c.description} ${c.category}`.toLowerCase().includes(s)
          )
        : data;
      // Flag complaints that were not in the list before (only on live refresh)
      if (detectNew && lastIds.current) {
        const added = list.filter((c) => !lastIds.current.has(c.id)).map((c) => c.id);
        if (added.length) setFresh((prev) => new Set([...prev, ...added]));
      }
      lastIds.current = new Set(list.map((c) => c.id));
      setNames((prev) => {
        const m = new Map(prev.map((n) => [n.toLowerCase(), n]));
        data.forEach((c) => {
          const n = (c.resolved_by_name || "").trim();
          if (n && !m.has(n.toLowerCase())) m.set(n.toLowerCase(), n);
        });
        return [...m.values()].sort();
      });
      setRows(list);
      setLoaded(true);
    },
    [toast]
  );

  // first load, and reload whenever a new complaint arrives (tick)
  useEffect(() => {
    load(f, tick > 0);
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

  // ---- Floor-wise and caretaker-wise report (follows the filters above) ----
  const report = useMemo(() => {
    const clean = (n) => (n || "").trim();
    const floorNums = [
      ...new Set([...FLOORS, ...rows.map((c) => c.floor).filter((x) => x != null)]),
    ].sort((a, b) => a - b);

    const floors = floorNums.map((fl) => {
      const list = rows.filter((c) => c.floor === fl);
      const solved = list.filter((c) => c.status === "Solved");
      const who = new Map();
      solved.forEach((c) => {
        const n = clean(c.resolved_by_name);
        if (n && !who.has(n.toLowerCase())) who.set(n.toLowerCase(), n);
      });
      return {
        floor: fl,
        total: list.length,
        open: list.length - solved.length,
        solved: solved.length,
        who: [...who.values()],
      };
    });

    // Group by the typed name (Ayesha / ayesha count as the same person)
    const byKey = new Map();
    rows
      .filter((c) => c.status === "Solved")
      .forEach((c) => {
        const n = clean(c.resolved_by_name);
        const key = n ? n.toLowerCase() : "legacy";
        if (!byKey.has(key)) {
          byKey.set(key, {
            key,
            name: n || "No record (older complaints)",
            floors: new Set(),
            list: [],
          });
        }
        const person = byKey.get(key);
        person.list.push(c);
        if (c.floor != null) person.floors.add(c.floor);
      });

    const people = [...byKey.values()]
      .map((p) => {
        const times = p.list
          .filter((c) => c.resolved_at)
          .map((c) => new Date(c.resolved_at) - new Date(c.created_at));
        return {
          ...p,
          floors: [...p.floors].sort((a, b) => a - b),
          count: p.list.length,
          avg: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
        };
      })
      .sort((a, b) => b.count - a.count);

    return { floors, people };
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
        Floor: c.floor ?? "",
        Contact: c.contact,
        Category: c.category,
        Description: c.description,
        Status: c.status,
        Remarks: c.admin_remarks || "",
        Solved_On: c.resolved_at ? fmtDate(c.resolved_at) : "",
        Solved_By: c.resolved_by_name || "",
      }))
    );
    if (!ok) toast("No data to export", "err");
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
          <div>
            <label>Floor</label>
            <select value={f.floor} onChange={set("floor")}>
              <option value="">All floors</option>
              {FLOORS.map((x) => <option key={x} value={x}>{floorLabel(x)}</option>)}
            </select>
          </div>
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
          <div><label>Search</label><input type="text" placeholder="name / description" value={f.search} onChange={set("search")} /></div>
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

      {/* ===== Floor-wise + caretaker-wise report ===== */}
      <div className="card">
        <h2>Floor-wise and caretaker-wise report</h2>
        <p className="note" style={{ marginTop: 0, marginBottom: 14 }}>
          Based on the filters above. Pick a Month for a monthly report, or press Reset to see all records.
        </p>

        <div className="floors">
          {report.floors.map((fl) => (
            <div className="floor-card" key={fl.floor}>
              <h3>{floorLabel(fl.floor)}</h3>
              <p className="floor-staff">
                Solved by: {fl.who.length ? fl.who.join(", ") : "no one yet"}
              </p>
              <div className="floor-nums">
                <span><b>{fl.total}</b>total</span>
                <span><b>{fl.open}</b>open</span>
                <span><b className="ok">{fl.solved}</b>solved</span>
              </div>
            </div>
          ))}
        </div>

        <div className="table-wrap">
          <table style={{ minWidth: 560 }}>
            <thead>
              <tr><th>Caretaker</th><th>Floors</th><th>Problems solved</th><th>Average time</th></tr>
            </thead>
            <tbody>
              {report.people.length === 0 && (
                <tr><td colSpan={4} className="empty">No complaints solved in this view yet.</td></tr>
              )}
              {report.people.map((p) => (
                <tr key={p.key}>
                  <td>
                    <b>{p.name}</b>
                    {p.count > 0 && (
                      <details className="solved-details">
                        <summary>Problems solved</summary>
                        <ul>
                          {p.list.map((c) => (
                            <li key={c.id}>
                              #{c.ticket_no}, Room {c.room_number}, {c.category} ({fmtDate(c.resolved_at)})
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td>{p.floors.length ? p.floors.map(floorLabel).join(", ") : "-"}</td>
                  <td><b>{p.count}</b></td>
                  <td>{p.avg != null ? fmtDuration(p.avg) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <datalist id="caretaker-names">
        {names.map((n) => <option key={n} value={n} />)}
      </datalist>

      <div className="card">
        {fresh.size > 0 && (
          <div className="new-banner">
            <span>
              {fresh.size} new complaint{fresh.size > 1 ? "s" : ""} just arrived (highlighted below).
            </span>
            <button className="btn small ghost" type="button" onClick={() => setFresh(new Set())}>
              Dismiss
            </button>
          </div>
        )}
        {rows.length > 5 && (
          <p className="note" style={{ marginTop: 0, marginBottom: 10 }}>
            {rows.length} complaints. Scroll inside the list to see more.
          </p>
        )}
        <div className="table-wrap table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Date</th><th>Student / Room</th><th>Category</th>
                <th>Description</th><th>Status</th><th>Remarks</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <ComplaintRow
                  key={c.id + c.updated_at}
                  c={c}
                  isNew={fresh.has(c.id) || (c.status === "Pending" && Date.now() - new Date(c.created_at) < DAY)}
                  onSaved={() => load(f)}
                />
              ))}
            </tbody>
          </table>
        </div>
        {loaded && rows.length === 0 && <div className="empty">No complaints found.</div>}
      </div>
    </>
  );
}

function ComplaintRow({ c, isNew, onSaved }) {
  const toast = useToast();
  const [status, setStatus] = useState(c.status);
  const [remarks, setRemarks] = useState(c.admin_remarks || "");
  const [solver, setSolver] = useState("");
  const [busy, setBusy] = useState(false);
  // Marking a complaint Solved for the first time needs the caretaker's name
  const solving = status === "Solved" && c.status !== "Solved";

  async function save() {
    if (solving && !solver.trim()) {
      return toast("Enter the caretaker's name to mark this as Solved", "err");
    }
    setBusy(true);
    const patch = { status, admin_remarks: remarks.trim() || null };
    if (solving) patch.resolved_by_name = solver.trim().replace(/\s+/g, " ");
    const { error } = await supabase.from("complaints").update(patch).eq("id", c.id);
    setBusy(false);
    if (error) return toast("Update failed: " + error.message, "err");
    toast("Status updated");
    onSaved();
  }

  return (
    <tr className={isNew ? "is-new" : undefined}>
      <td>
        {c.ticket_no}
        {isNew && <><br /><span className="new-tag">New</span></>}
      </td>
      <td>
        {fmtDate(c.created_at)}
        {c.resolved_at && <><br /><small className="meta">Solved: {fmtDate(c.resolved_at)}</small></>}
      </td>
      <td>
        <b>{c.student_name}</b><br />
        Room {c.room_number}{c.floor != null && <> ({floorLabel(c.floor)})</>}
        <br /><small>{c.contact}</small>
      </td>
      <td>{c.category}</td>
      <td className="desc">{c.description}</td>
      <td>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        {solving && (
          <input
            type="text"
            list="caretaker-names"
            maxLength={60}
            placeholder="Your name (required)"
            value={solver}
            onChange={(e) => setSolver(e.target.value)}
            style={{ marginTop: 6 }}
          />
        )}
        {c.status === "Solved" && c.resolved_by_name && (
          <small className="meta" style={{ display: "block", marginTop: 4 }}>
            Solved by {c.resolved_by_name}
          </small>
        )}
      </td>
      <td>
        <input type="text" maxLength={300} placeholder="Note (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </td>
      <td><button className="btn small" type="button" disabled={busy} onClick={save}>Save</button></td>
    </tr>
  );
}