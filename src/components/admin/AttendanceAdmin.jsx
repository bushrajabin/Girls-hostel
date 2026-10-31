import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../Toast";
import { fetchAll, today, byRoom, downloadCSV } from "../../utils";
import { ATT_STATUSES, FLOORS, floorLabel } from "../../constants";
import { HostelPicker, SetupNotice, useHostels } from "./HostelPicker";

const NAME_KEY = "attendance-caretaker-name";
const CLS = { Present: "p", Absent: "a", Leave: "l" };

export default function AttendanceAdmin() {
  const toast = useToast();
  const { hostels, hostelId, hostel, choose, ready, error } = useHostels();
  const [date, setDate] = useState(today());
  const [floor, setFloor] = useState("");
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [saved, setSaved] = useState({});   // status already in the database (LOCKED)
  const [marks, setMarks] = useState({});   // status currently on screen
  const [names, setNames] = useState([]);
  const [who, setWho] = useState(() => {
    try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
  });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!hostelId) return;
    setLoaded(false);
    const [st, at] = await Promise.all([
      fetchAll(() =>
        supabase.from("students").select("*").eq("hostel_id", hostelId).eq("active", true).order("id")
      ),
      supabase.from("attendance").select("student_id, status, marked_by_name").eq("hostel_id", hostelId).eq("att_date", date),
    ]);
    if (st.error || at.error) return toast("Load error: " + (st.error || at.error).message, "err");
    const map = {};
    const by = new Set();
    at.data.forEach((a) => { map[a.student_id] = a.status; if (a.marked_by_name) by.add(a.marked_by_name); });
    setStudents(st.data.sort(byRoom));
    setSaved(map);
    setMarks(map);
    setNames([...by]);
    setLoaded(true);
  }, [hostelId, date, toast]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return students.filter(
      (x) =>
        (floor === "" || x.floor === Number(floor)) &&
        (!s || `${x.name} ${x.room_number}`.toLowerCase().includes(s))
    );
  }, [students, floor, search]);

  const stats = useMemo(() => {
    const c = { Present: 0, Absent: 0, Leave: 0, none: 0 };
    visible.forEach((x) => { const m = marks[x.id]; if (m) c[m]++; else c.none++; });
    return c;
  }, [visible, marks]);

  // Only brand-new marks (not already saved in the database)
  const dirty = visible.filter((x) => marks[x.id] && !saved[x.id]);

  // Already saved students cannot be changed
  const set = (id, st) => {
    if (saved[id]) return;
    setMarks((p) => ({ ...p, [id]: p[id] === st ? undefined : st }));
  };

  function fillPresent() {
    setMarks((p) => {
      const n = { ...p };
      visible.forEach((x) => { if (!n[x.id]) n[x.id] = "Present"; });
      return n;
    });
  }

  async function save() {
    const name = who.trim().replace(/\s+/g, " ");
    if (!name) return toast("Enter the caretaker's name before saving", "err");
    if (!dirty.length) return toast("Nothing new to save");
    setBusy(true);
    const rows = dirty.map((x) => ({
      student_id: x.id,
      hostel_id: Number(hostelId),
      att_date: date,
      status: marks[x.id],
      marked_by_name: name,
    }));
    // ignoreDuplicates: agar kisi aur ne beech mein mark kar diya ho to purani entry overwrite nahi hogi
    const { error: err } = await supabase
      .from("attendance")
      .upsert(rows, { onConflict: "student_id,att_date", ignoreDuplicates: true });
    setBusy(false);
    if (err) return toast("Save failed: " + err.message, "err");
    try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
    toast(`Attendance saved for ${rows.length} student${rows.length > 1 ? "s" : ""}. Ab edit nahi hoga.`, "ok");
    load();
  }

  function exportCsv() {
    const ok = downloadCSV(
      `attendance-${hostel?.name || "hostel"}-${date}.csv`,
      visible.map((x) => ({
        Date: date,
        Hostel: hostel?.name || "",
        Floor: x.floor ?? "",
        Room: x.room_number,
        Student: x.name,
        Status: saved[x.id] || "Not marked",
      }))
    );
    if (!ok) toast("No data to export", "err");
  }

  if (ready && !hostels.length) return <SetupNotice error={error} />;

  return (
    <>
      <div className="stats s5">
        <div className="stat"><b>{visible.length}</b><span>Students</span></div>
        <div className="stat"><b style={{ color: "var(--ok)" }}>{stats.Present}</b><span>Present</span></div>
        <div className="stat"><b style={{ color: "var(--err)" }}>{stats.Absent}</b><span>Absent</span></div>
        <div className="stat"><b style={{ color: "var(--warn)" }}>{stats.Leave}</b><span>On leave</span></div>
        <div className="stat"><b>{stats.none}</b><span>Not marked</span></div>
      </div>

      <div className="card">
        <h2>Daily Attendance</h2>
        <div className="filters">
          <HostelPicker hostels={hostels} value={hostelId} onChange={choose} />
          <div>
            <label>Date</label>
            <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
          <div>
            <label>Floor</label>
            <select value={floor} onChange={(e) => setFloor(e.target.value)}>
              <option value="">All floors</option>
              {FLOORS.map((x) => <option key={x} value={x}>{floorLabel(x)}</option>)}
            </select>
          </div>
          <div>
            <label>Search</label>
            <input type="text" placeholder="name / room" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <label>Caretaker name (required)</label>
            <input
              type="text"
              list="att-names"
              maxLength={60}
              placeholder="Your name"
              value={who}
              onChange={(e) => setWho(e.target.value)}
            />
            <datalist id="att-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button className="btn small ghost" type="button" onClick={fillPresent}>Mark unmarked as Present</button>
          <button className="btn small ghost" type="button" onClick={exportCsv}>CSV</button>
          <button className="btn small" type="button" disabled={busy || !dirty.length} onClick={save}>
            Save attendance{dirty.length ? ` (${dirty.length})` : ""}
          </button>
        </div>
        <p className="note">
          Tap Present / Absent / Leave for each student, then Save. Ek baar save hone ke baad attendance edit nahi ho sakti (🔒).
        </p>
      </div>

      <div className="card">
        {visible.length > 8 && (
          <p className="note" style={{ marginTop: 0, marginBottom: 10 }}>
            {visible.length} students. Scroll inside the list to see more.
          </p>
        )}
        <div className="table-wrap table-scroll">
          <table style={{ minWidth: 520 }}>
            <thead>
              <tr><th>Room</th><th>Student</th><th>Floor</th><th>Attendance</th></tr>
            </thead>
            <tbody>
              {visible.map((x) => {
                const locked = !!saved[x.id];
                return (
                  <tr key={x.id} className={marks[x.id] && !locked ? "is-new" : undefined}>
                    <td><b>{x.room_number}</b></td>
                    <td>{x.name}</td>
                    <td>{floorLabel(x.floor)}</td>
                    <td>
                      <div className="att-toggle" style={locked ? { opacity: 0.75 } : undefined}>
                        {ATT_STATUSES.map((st) => (
                          <button
                            key={st}
                            type="button"
                            disabled={locked}
                            style={locked ? { cursor: "not-allowed" } : undefined}
                            className={`${CLS[st]} ${marks[x.id] === st ? "on" : ""}`}
                            onClick={() => set(x.id, st)}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                      {locked && <small className="meta"> 🔒 saved</small>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loaded && visible.length === 0 && (
          <div className="empty">
            {students.length === 0
              ? "No students in this hostel yet. Add them on the Students tab."
              : "No students match the filter."}
          </div>
        )}
      </div>
    </>
  );
}