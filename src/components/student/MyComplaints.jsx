import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { StatusBadge } from "../Common";
import { fmtDate } from "../../utils";

export default function MyComplaints({ profile, tick }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    supabase
      .from("complaints")
      .select("*")
      .eq("student_id", profile.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setErr(error.message);
        else { setErr(""); setRows(data); }
      });
    return () => { alive = false; };
  }, [profile.id, tick]);

  return (
    <div className="card">
      <h2>Meri Complaints (Live Status)</h2>
      {err && <div className="empty">Load nahi hua: {err}</div>}
      {!err && rows === null && <div className="empty">Loading…</div>}
      {rows && rows.length === 0 && <div className="empty">Abhi tak koi complaint nahi.</div>}
      {rows?.map((c) => (
        <div className="item" key={c.id}>
          <div className="head">
            <strong>#{c.ticket_no} • {c.category}</strong>
            <StatusBadge status={c.status} />
          </div>
          <div>{c.description}</div>
          <div className="meta">
            Room {c.room_number} • Raised: {fmtDate(c.created_at)}
            {c.resolved_at && <> • Solved: {fmtDate(c.resolved_at)}</>}
          </div>
          {c.admin_remarks && (
            <div className="remark"><b>Caretaker note:</b> {c.admin_remarks}</div>
          )}
        </div>
      ))}
    </div>
  );
}
