import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../Toast";
import { fmtDate } from "../../utils";

export default function Suggestions({ profile }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("suggestions")
      .select("*")
      .eq("student_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setRows(data || []);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("suggestions").insert({
      student_id: profile.id,
      student_name: profile.full_name,
      room_number: profile.room_number,
      message: text.trim(),
    });
    setBusy(false);
    if (error) return toast("Error: " + error.message, "err");
    toast("Suggestion mil gaya 💡");
    setText("");
    load();
  }

  return (
    <>
      <div className="card">
        <h2> Any Suggestion?</h2>
        <form onSubmit={submit}>
          <label>Write your Suggestions!!</label>
          <textarea
            required
            maxLength={1500}
            placeholder=" Write your suggestions here for making hostel better."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn" type="submit" disabled={busy}>Submit Suggestion</button>
        </form>
      </div>
      <div className="card">
        <h2>My Previous Suggestions</h2>
        {rows && rows.length === 0 && <div className="empty">Didn't find any suggestions.</div>}
        {rows?.map((s) => (
          <div className="item" key={s.id}>
            <div>{s.message}</div>
            <div className="meta">{fmtDate(s.created_at)}</div>
          </div>
        ))}
      </div>
    </>
  );
}
