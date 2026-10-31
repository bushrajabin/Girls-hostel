import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../Toast";
import { useForm } from "../Common";
import { fetchAll, parseCSV, byRoom, downloadCSV } from "../../utils";
import { FLOORS, floorLabel } from "../../constants";
import { HostelPicker, SetupNotice, useHostels } from "./HostelPicker";

// Find which column holds name / room / phone (header row optional)
function readStudents(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const find = (re) => head.findIndex((h) => re.test(h));
  let iName = find(/name|student/), iRoom = find(/room/), iPhone = find(/phone|mobile|contact/);
  let body = rows;
  if (iName >= 0 && iRoom >= 0) body = rows.slice(1);
  else { iName = 0; iRoom = 1; iPhone = 2; } // no header: Name, Room, Phone
  const seen = new Set();
  const out = [];
  body.forEach((r) => {
    const name = (r[iName] || "").trim().replace(/\s+/g, " ");
    const room = (r[iRoom] || "").trim();
    const phone = iPhone >= 0 ? (r[iPhone] || "").trim() : "";
    if (!name || !room) return;
    const key = `${room}|${name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name, room_number: room, phone: phone || null });
  });
  return out;
}

export default function StudentsAdmin() {
  const toast = useToast();
  const { hostels, hostelId, hostel, choose, ready, error } = useHostels();
  const [students, setStudents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [floor, setFloor] = useState("");
  const [search, setSearch] = useState("");
  const [showOff, setShowOff] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF, bind] = useForm({ name: "", room: "", phone: "" });

  const load = useCallback(async () => {
    if (!hostelId) return;
    const { data, error: err } = await fetchAll(() =>
      supabase.from("students").select("*").eq("hostel_id", hostelId).order("id")
    );
    if (err) return toast("Load error: " + err.message, "err");
    setStudents(data.sort(byRoom));
    setLoaded(true);
  }, [hostelId, toast]);

  useEffect(() => { load(); }, [load]);

  const parsed = useMemo(() => readStudents(text), [text]);
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return students.filter(
      (x) =>
        (showOff || x.active) &&
        (floor === "" || x.floor === Number(floor)) &&
        (!s || `${x.name} ${x.room_number}`.toLowerCase().includes(s))
    );
  }, [students, floor, search, showOff]);

  async function addOne(e) {
    e.preventDefault();
    setBusy(true);
    const { error: err } = await supabase.from("students").insert({
      hostel_id: Number(hostelId), name: f.name, room_number: f.room, phone: f.phone || null,
    });
    setBusy(false);
    if (err) {
      return toast(err.code === "23505" ? "This student is already in that room" : "Could not add: " + err.message, "err");
    }
    toast("Student added", "ok");
    setF({ name: "", room: "", phone: "" });
    load();
  }

  function pickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => setText(String(rd.result || ""));
    rd.readAsText(file);
    e.target.value = "";
  }

  async function importAll() {
    if (!parsed.length) return toast("No valid rows found", "err");
    setBusy(true);
    const rows = parsed.map((p) => ({ ...p, hostel_id: Number(hostelId) }));
    let added = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const { data, error: err } = await supabase
        .from("students")
        .upsert(rows.slice(i, i + 200), { onConflict: "hostel_id,room_number,name_key", ignoreDuplicates: true })
        .select("id");
      if (err) { setBusy(false); return toast("Import failed: " + err.message, "err"); }
      added += data.length;
    }
    setBusy(false);
    toast(`${added} added${rows.length - added ? `, ${rows.length - added} already existed` : ""}`, "ok");
    setText("");
    load();
  }

  function exportCsv() {
    const ok = downloadCSV(
      `students-${hostel?.name || "hostel"}.csv`,
      visible.map((x) => ({ Name: x.name, Room: x.room_number, Floor: x.floor ?? "", Phone: x.phone || "", Active: x.active ? "Yes" : "No" }))
    );
    if (!ok) toast("No data to export", "err");
  }

  if (ready && !hostels.length) return <SetupNotice error={error} />;

  return (
    <>
      <div className="card">
        <h2>Student List</h2>
        <div className="filters">
          <HostelPicker hostels={hostels} value={hostelId} onChange={choose} />
        </div>
        <p className="note">
          The list belongs to the selected hostel. Students do not need an account; attendance is marked from this list.
        </p>
      </div>

      <div className="card">
        <h2>Add one student</h2>
        <form onSubmit={addOne}>
          <div className="filters">
            <div><label>Name</label><input type="text" required maxLength={80} {...bind("name")} /></div>
            <div><label>Room No.</label><input type="text" required maxLength={10} placeholder="e.g. 204" {...bind("room")} /></div>
            <div><label>Phone (optional)</label><input type="tel" maxLength={15} {...bind("phone")} /></div>
            <div><button className="btn small" type="submit" disabled={busy}>Add</button></div>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Import many students (Excel / CSV)</h2>
        <p className="note" style={{ marginTop: 0 }}>
          Columns: <b>Name, Room, Phone</b> (phone is optional). In Excel use File → Save As → CSV, then choose the file below,
          or paste the rows. Students already in the list are skipped, so it is safe to import again.
        </p>
        <div className="filters" style={{ marginTop: 10 }}>
          <div><label>CSV file</label><input type="file" accept=".csv,.txt,text/csv" onChange={pickFile} /></div>
        </div>
        <label>or paste here</label>
        <textarea
          placeholder={"Name,Room,Phone\nAisha Khan,204,9876543210\nSana Fatima,101,"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
          <button className="btn small" type="button" disabled={busy || !parsed.length} onClick={importAll}>
            Import {parsed.length ? `${parsed.length} students` : ""} into {hostel?.name || "hostel"}
          </button>
          {text && <span className="note" style={{ margin: 0 }}>{parsed.length} valid rows found</span>}
        </div>
      </div>

      <div className="card">
        <div className="filters" style={{ marginBottom: 12 }}>
          <div>
            <label>Floor</label>
            <select value={floor} onChange={(e) => setFloor(e.target.value)}>
              <option value="">All floors</option>
              {FLOORS.map((x) => <option key={x} value={x}>{floorLabel(x)}</option>)}
            </select>
          </div>
          <div><label>Search</label><input type="text" placeholder="name / room" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div>
            <label>&nbsp;</label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", margin: 0, fontWeight: 500 }}>
              <input type="checkbox" style={{ width: "auto" }} checked={showOff} onChange={(e) => setShowOff(e.target.checked)} />
              Show inactive
            </label>
          </div>
          <div><button className="btn small ghost" type="button" onClick={exportCsv}>CSV</button></div>
        </div>
        <p className="note" style={{ marginTop: 0, marginBottom: 10 }}>
          {visible.length} students{visible.length > 8 ? ". Scroll inside the list to see more." : "."} Mark a student inactive when she leaves; her old attendance stays.
        </p>
        <div className="table-wrap table-scroll">
          <table style={{ minWidth: 640 }}>
            <thead><tr><th>Name</th><th>Room</th><th>Floor</th><th>Phone</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {visible.map((x) => <StudentRow key={x.id + x.room_number + x.active} s={x} onSaved={load} />)}
            </tbody>
          </table>
        </div>
        {loaded && visible.length === 0 && <div className="empty">No students yet. Add or import them above.</div>}
      </div>
    </>
  );
}

function StudentRow({ s, onSaved }) {
  const toast = useToast();
  const [room, setRoom] = useState(s.room_number);
  const [phone, setPhone] = useState(s.phone || "");
  const [busy, setBusy] = useState(false);

  async function save(patch) {
    setBusy(true);
    const { error: err } = await supabase.from("students").update(patch).eq("id", s.id);
    setBusy(false);
    if (err) {
      return toast(err.code === "23505" ? "Another student with this name is already in that room" : "Update failed: " + err.message, "err");
    }
    toast("Saved", "ok");
    onSaved();
  }

  const changed = room.trim() !== s.room_number || phone.trim() !== (s.phone || "");
  return (
    <tr style={s.active ? undefined : { opacity: 0.55 }}>
      <td><b>{s.name}</b></td>
      <td><input type="text" maxLength={10} value={room} onChange={(e) => setRoom(e.target.value)} style={{ width: 90 }} /></td>
      <td>{floorLabel(s.floor)}</td>
      <td><input type="tel" maxLength={15} value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: 130 }} /></td>
      <td>{s.active ? "Active" : "Inactive"}</td>
      <td style={{ whiteSpace: "nowrap" }}>
        <button className="btn small" type="button" disabled={busy || !changed || !room.trim()} onClick={() => save({ room_number: room, phone: phone || null })}>Save</button>{" "}
        <button className="btn small ghost" type="button" disabled={busy} onClick={() => save({ active: !s.active })}>
          {s.active ? "Make inactive" : "Make active"}
        </button>
      </td>
    </tr>
  );
}