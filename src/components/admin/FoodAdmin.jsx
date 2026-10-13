import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../Toast";
import { currentMonth, monthRange, stars, downloadCSV } from "../../utils";
import { MEALS } from "../../constants";

const LIMIT = 2000;

export default function FoodAdmin() {
  const toast = useToast();
  const [f, setF] = useState({ month: currentMonth(), meal: "", room: "" });
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(
    async (flt) => {
      let q = supabase
        .from("food_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      const r = monthRange(flt.month);
      if (r) q = q.gte("created_at", r.start).lt("created_at", r.end);
      if (flt.meal) q = q.eq("meal_type", flt.meal);
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

  const stats = useMemo(() => {
    const n = rows.length;
    return {
      n,
      avg: n ? (rows.reduce((a, r) => a + r.rating, 0) / n).toFixed(2) + " ★" : "–",
      low: rows.filter((r) => r.rating <= 2).length,
      high: rows.filter((r) => r.rating >= 4).length,
    };
  }, [rows]);

  const byMeal = useMemo(() => {
    const m = {};
    rows.forEach((r) => (m[r.meal_type] ||= []).push(r.rating));
    return Object.entries(m).map(([k, v]) => [k, (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1), v.length]);
  }, [rows]);

  function exportCsv() {
    const ok = downloadCSV(
      "food_feedback.csv",
      rows.map((r) => ({
        Date: r.feedback_date,
        Meal: r.meal_type,
        Rating: r.rating,
        Feedback: r.feedback || "",
        Student: r.student_name,
        Room: r.room_number,
      }))
    );
    if (!ok) toast("Export ke liye data nahi hai", "err");
  }

  return (
    <>
      <div className="stats">
        <div className="stat"><b>{stats.n}</b><span>Total feedbacks</span></div>
        <div className="stat"><b>{stats.avg}</b><span>Average rating</span></div>
        <div className="stat"><b>{stats.low}</b><span>Low (1-2★)</span></div>
        <div className="stat"><b>{stats.high}</b><span>High (4-5★)</span></div>
      </div>

      <div className="card">
        <h2>Filter</h2>
        <form className="filters" onSubmit={(e) => { e.preventDefault(); load(f); }}>
          <div><label>Month</label><input type="month" value={f.month} onChange={set("month")} /></div>
          <div>
            <label>Meal</label>
            <select value={f.meal} onChange={set("meal")}>
              <option value="">All meals</option>
              {MEALS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div><label>Room No.</label><input type="text" value={f.room} onChange={set("room")} /></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn small" type="submit">Apply</button>
            <button className="btn small ghost" type="button" onClick={exportCsv}>CSV</button>
          </div>
        </form>
        <div className="chips">
          {byMeal.map(([m, avg, n]) => (
            <span className="chip" key={m}>{m}: <b>{avg}★</b> ({n})</span>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table style={{ minWidth: 700 }}>
            <thead>
              <tr><th>Date</th><th>Meal</th><th>Rating</th><th>Feedback</th><th>Student / Room</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.feedback_date}</td>
                  <td>{r.meal_type}</td>
                  <td><span className="star-txt">{stars(r.rating)}</span></td>
                  <td className="desc">{r.feedback || "—"}</td>
                  <td>{r.student_name}<br /><small>Room {r.room_number}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loaded && rows.length === 0 && <div className="empty">Koi feedback nahi mila.</div>}
      </div>
    </>
  );
}
