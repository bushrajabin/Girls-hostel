import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../Toast";
import { StarInput, useForm } from "../Common";
import { MEALS } from "../../constants";
import { stars, today } from "../../utils";

export default function FoodFeedback({ profile }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [rows, setRows] = useState(null);
  const [f, setF, bind] = useForm({ date: today(), meal: MEALS[0], text: "" });

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("food_feedback")
      .select("*")
      .eq("student_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setRows(data || []);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    if (!rating) return toast("Pehle star rating chunein ⭐", "err");
    setBusy(true);
    const { error } = await supabase.from("food_feedback").insert({
      student_id: profile.id,
      student_name: profile.full_name,
      room_number: profile.room_number,
      meal_type: f.meal,
      rating,
      feedback: f.text.trim() || null,
      feedback_date: f.date,
    });
    setBusy(false);
    if (error) return toast("Error: " + error.message, "err");
    toast("Feedback ke liye shukriya 🍽");
    setRating(0);
    setF((p) => ({ ...p, text: "" }));
    load();
  }

  return (
    <>
      <div className="card">
        <h2>Food Rating & Feedback</h2>
        <form onSubmit={submit}>
          <div className="row">
            <div><label>Date</label><input type="date" required max={today()} {...bind("date")} /></div>
            <div>
              <label>Meal</label>
              <select required {...bind("meal")}>
                {MEALS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <label>Rating</label>
          <StarInput value={rating} onChange={setRating} />
          <label>Feedback (optional)</label>
          <textarea maxLength={1000} placeholder="Khana kaisa laga? Kya improve ho sakta hai?" {...bind("text")} />
          <button className="btn" type="submit" disabled={busy}>Submit Feedback</button>
        </form>
      </div>

      <div className="card">
        <h2>Meri pichli feedbacks</h2>
        {rows && rows.length === 0 && <div className="empty">Abhi tak koi feedback nahi.</div>}
        {rows?.map((r) => (
          <div className="item" key={r.id}>
            <div className="head">
              <strong>{r.meal_type} • {r.feedback_date}</strong>
              <span className="star-txt">{stars(r.rating)}</span>
            </div>
            {r.feedback && <div>{r.feedback}</div>}
          </div>
        ))}
      </div>
    </>
  );
}
