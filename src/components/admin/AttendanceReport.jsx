import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../Toast";
import { fetchAll, currentMonth, downloadCSV, byRoom } from "../../utils";
import { FLOORS, floorLabel } from "../../constants";
import { HostelPicker, SetupNotice, useHostels } from "./HostelPicker";

// "2026-10" -> ["2026-10-01", "2026-11-01"]
function monthDates(val) {
  const [y, m] = val.split("-").map(Number);
  const p = (n) => String(n).padStart(2, "0");
  const next = m === 12 ? [y + 1, 1] : [y, m + 1];
  return [`${y}-${p(m)}-01`, `${next[0]}-${p(next[1])}-01`];
}

export default function AttendanceReport() {
  const toast = useToast();
  const { hostels, hostelId, hostel, choose, ready, error } = useHostels();
  const [month, setMonth] = useState(currentMonth());
  const [floor, setFloor] = useState("");
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!hostelId || !month) return;
    setLoaded(false);
    const [from, to] = monthDates(month);
    const [st, at] = await Promise.all([
      fetchAll(() => supabase.from("students").select("*").eq("hostel_id", hostelId).order("id")),
      fetchAll(() =>
        supabase.from("attendance").select("student_id, att_date, status, marked_by_name")
          .eq("hostel_id", hostelId).gte("att_date", from).lt("att_date", to).order("id")
      ),
    ]);
    if (st.error || at.error) return toast("Load error: " + (st.error || at.error).message, "err");
    setStudents(st.data.sort(byRoom));
    setRecords(at.data);
    setLoaded(true);
  }, [hostelId, month, toast]);

  useEffect(() => { load(); }, [load]);

  const { rows, days, daily, avg } = useMemo(() => {
    const per = new Map();
    const dayMap = new Map();
    records.forEach((r) => {
      const p = per.get(r.student_id) || { Present: 0, Absent: 0, Leave: 0 };
      p[r.status]++;
      per.set(r.student_id, p);
      const d = dayMap.get(r.att_date) || { Present: 0, Absent: 0, Leave: 0, by: new Set() };
      d[r.status]++;
      if (r.marked_by_name) d.by.add(r.marked_by_name);
      dayMap.set(r.att_date, d);
    });
    const s = search.trim().toLowerCase();
    const list = students
      .filter((x) => (x.active || per.has(x.id)))
      .filter((x) => floor === "" || x.floor === Number(floor))
      .filter((x) => !s || `${x.name} ${x.room_number}`.toLowerCase().includes(s))
      .map((x) => {
        const c = per.get(x.id) || { Present: 0, Absent: 0, Leave: 0 };
        const total = c.Present + c.Absent + c.Leave;
        return { ...x, ...c, total, pct: total ? Math.round((c.Present / total) * 100) : null };
      });
    const withData = list.filter((x) => x.pct !== null);
    return {
      rows: list,
      days: dayMap.size,
      daily: [...dayMap.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)),
      avg: withData.length ? Math.round(withData.reduce((n, x) => n + x.pct, 0) / withData.length) : null,
    };
  }, [students, records, floor, search]);

  function exportCsv() {
    const ok = downloadCSV(
      `attendance-report-${hostel?.name || "hostel"}-${month}.csv`,
      rows.map((x) => ({
        Hostel: hostel?.name || "",
        Month: month,
        Floor: x.floor ?? "",
        Room: x.room_number,
        Student: x.name,
        Present: x.Present,
        Absent: x.Absent,
        Leave: x.Leave,
        Days_Marked: x.total,
        Present_Percent: x.pct ?? "",
      }))
    );
    if (!ok) toast("No data to export", "err");
  }

  if (ready && !hostels.length) return <SetupNotice error={error} />;

  return (
    <>
      <div className="stats">
        <div className="stat"><b>{rows.length}</b><span>Students</span></div>
        <div className="stat"><b>{days}</b><span>Days recorded</span></div>
        <div className="stat"><b>{avg === null ? "–" : `${avg}%`}</b><span>Average present</span></div>
        <div className="stat"><b>{rows.filter((x) => x.Absent > 0).length}</b><span>Students with absences</span></div>
      </div>

      <div className="card">
        <h2>Attendance Report</h2>
        <div className="filters">
          <HostelPicker hostels={hostels} value={hostelId} onChange={choose} />
          <div><label>Month</label><input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></div>
          <div>
            <label>Floor</label>
            <select value={floor} onChange={(e) => setFloor(e.target.value)}>
              <option value="">All floors</option>
              {FLOORS.map((x) => <option key={x} value={x}>{floorLabel(x)}</option>)}
            </select>
          </div>
          <div><label>Search</label><input type="text" placeholder="name / room" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div><button className="btn small ghost" type="button" onClick={exportCsv}>CSV</button></div>
        </div>
      </div>

      {daily.length > 0 && (
        <div className="card">
          <details className="solved-details">
            <summary>Day-wise totals ({daily.length} days)</summary>
            <div className="table-wrap table-scroll" style={{ marginTop: 10 }}>
              <table style={{ minWidth: 480 }}>
                <thead><tr><th>Date</th><th>Present</th><th>Absent</th><th>Leave</th><th>Marked by</th></tr></thead>
                <tbody>
                  {daily.map(([d, v]) => (
                    <tr key={d}><td>{d}</td><td>{v.Present}</td><td>{v.Absent}</td><td>{v.Leave}</td><td>{[...v.by].join(", ")}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      <div className="card">
        {rows.length > 8 && (
          <p className="note" style={{ marginTop: 0, marginBottom: 10 }}>
            {rows.length} students. Scroll inside the list to see more.
          </p>
        )}
        <div className="table-wrap table-scroll">
          <table style={{ minWidth: 620 }}>
            <thead>
              <tr><th>Room</th><th>Student</th><th>Floor</th><th>Present</th><th>Absent</th><th>Leave</th><th>Present %</th></tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id}>
                  <td><b>{x.room_number}</b></td>
                  <td>{x.name}{!x.active && <small className="meta"> (inactive)</small>}</td>
                  <td>{floorLabel(x.floor)}</td>
                  <td>{x.Present}</td>
                  <td style={x.Absent ? { color: "var(--err)", fontWeight: 700 } : undefined}>{x.Absent}</td>
                  <td>{x.Leave}</td>
                  <td>{x.pct === null ? "–" : `${x.pct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loaded && rows.length === 0 && <div className="empty">No students found.</div>}
      </div>
    </>
  );
}