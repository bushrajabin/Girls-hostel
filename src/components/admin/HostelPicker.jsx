import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

const KEY = "admin-selected-hostel";

// Loads the hostels and remembers which one the admin picked last
export function useHostels() {
  const [hostels, setHostels] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [hostelId, setHostelId] = useState(() => {
    try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
  });

  useEffect(() => {
    supabase.from("hostels").select("id, name").order("id").then(({ data, error: err }) => {
      if (err) setError(err.message);
      else {
        setHostels(data);
        setHostelId((prev) =>
          data.some((h) => String(h.id) === String(prev)) ? String(prev) : String(data[0]?.id ?? "")
        );
      }
      setReady(true);
    });
  }, []);

  const choose = (v) => {
    setHostelId(v);
    try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
  };
  const hostel = hostels.find((h) => String(h.id) === String(hostelId));
  return { hostels, hostelId, hostel, choose, ready, error };
}

export function HostelPicker({ hostels, value, onChange }) {
  return (
    <div>
      <label>Hostel</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
      </select>
    </div>
  );
}

export function SetupNotice({ error }) {
  return (
    <div className="card">
      <h2>Attendance is not set up yet</h2>
      <p className="note">
        Run <code>attendance.sql</code> once in Supabase → SQL Editor, then refresh this page.
        {error && <> (Details: {error})</>}
      </p>
    </div>
  );
}