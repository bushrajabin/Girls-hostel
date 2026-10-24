import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../Toast";
import { fmtDate, currentMonth, monthRange, downloadCSV } from "../../utils";
import { FLOORS, floorLabel } from "../../constants";

const LIMIT = 2000;

function fmtDuration(ms) {
  const h = ms / 36e5;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${h.toFixed(1)} hr`;
  return `${(h / 24).toFixed(1)} days`;
}

function monthLabel(m) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export default function ReportAdmin() {
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(
    async (m) => {
      let q = supabase
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      const r = monthRange(m);
      if (r) q = q.gte("created_at", r.start).lt("created_at", r.end);
      const { data, error } = await q;
      if (error) return toast("Load error: " + error.message, "err");
      setRows(data);
      setLoaded(true);
    },
    [toast]
  );

  useEffect(() => {
    load(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Floor-wise and caretaker-wise numbers ----
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

  function exportCsv() {
    const ok = downloadCSV(
      "caretaker_report.csv",
      report.people.map((p) => ({
        Caretaker: p.name,
        Floors: p.floors.map(floorLabel).join(" / "),
        Problems_Solved: p.count,
        Average_Time_Hours: p.avg != null ? (p.avg / 36e5).toFixed(1) : "",
      }))
    );
    if (!ok) toast("No data to export", "err");
  }

  return (
    <>
      <div className="card">
        <h2>Filter</h2>
        <form
          className="filters"
          onSubmit={(e) => { e.preventDefault(); load(month); }}
        >
          <div>
            <label>Month</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn small" type="submit">Apply</button>
            <button
              className="btn small ghost"
              type="button"
              onClick={() => { setMonth(""); load(""); }}
            >
              All time
            </button>
            <button className="btn small ghost" type="button" onClick={exportCsv}>CSV</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Floor-wise and caretaker-wise report</h2>
        <p className="note" style={{ marginTop: 0, marginBottom: 14 }}>
          Showing: {month ? monthLabel(month) : "all records"}. Pick a Month for a monthly report, or press All time to see everything.
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
              {loaded && report.people.length === 0 && (
                <tr><td colSpan={4} className="empty">No complaints solved in this period yet.</td></tr>
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
    </>
  );
}