import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../Toast";
import { currentMonth, monthRange, fmtDate, downloadCSV } from "../../utils";

const LIMIT = 2000;

export default function SuggestionsAdmin() {
  const toast = useToast();
  const [f, setF] = useState({ month: currentMonth(), room: "" });
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(
    async (flt) => {
      let q = supabase
        .from("suggestions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      const r = monthRange(flt.month);
      if (r) q = q.gte("created_at", r.start).lt("created_at", r.end);
      if (flt.room.trim()) q = q.eq("room_number", flt.room.trim());
      const { data, error } = await q;
      if (error) return toast("Load error: " + error.message, "err");
      setRows(data);
      setLoaded(true);
    },
    [toast]
  );

  useEffect(() => {
    load(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  function exportCsv() {
    const ok = downloadCSV(
      "suggestions.csv",
      rows.map((s) => ({
        Date: fmtDate(s.created_at),
        Student: s.student_name,
        Room: s.room_number,
        Suggestion: s.message,
      }))
    );
    if (!ok) toast("Export ke liye data nahi hai", "err");
  }

  return (
    <>
      <div className="card">
        <h2>Filter</h2>
        <form className="filters" onSubmit={(e) => { e.preventDefault(); load(f); }}>
          <div><label>Month</label><input type="month" value={f.month} onChange={set("month")} /></div>
          <div><label>Room No.</label><input type="text" value={f.room} onChange={set("room")} /></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn small" type="submit">Apply</button>
            <button className="btn small ghost" type="button" onClick={exportCsv}>CSV</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table style={{ minWidth: 600 }}>
            <thead><tr><th>Date</th><th>Student / Room</th><th>Suggestion</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDate(s.created_at)}</td>
                  <td>{s.student_name}<br /><small>Room {s.room_number}</small></td>
                  <td className="desc">{s.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loaded && rows.length === 0 && <div className="empty">Koi suggestion nahi mila.</div>}
      </div>
    </>
  );
}
