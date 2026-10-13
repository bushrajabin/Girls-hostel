import { useState } from "react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../Toast";
import { useForm } from "../Common";
import { CATEGORIES } from "../../constants";

export default function ComplaintForm({ profile, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF, bind] = useForm({
    name: profile.full_name,
    room: profile.room_number,
    contact: profile.phone,
    category: "",
    description: "",
  });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("complaints").insert({
      student_id: profile.id,
      student_name: f.name.trim(),
      room_number: f.room.trim(),
      contact: f.contact.trim(),
      category: f.category,
      description: f.description.trim(),
    });
    setBusy(false);
    if (error) return toast("Error: " + error.message, "err");
    toast("Complaint submit ho gayi ✅");
    setF((p) => ({ ...p, category: "", description: "" }));
    onDone();
  }

  return (
    <div className="card">
      <h2>Room ki problem batayein</h2>
      <form onSubmit={submit}>
        <div className="row">
          <div><label>Student Name</label><input type="text" required {...bind("name")} /></div>
          <div><label>Room Number</label><input type="text" required {...bind("room")} /></div>
        </div>
        <div className="row">
          <div><label>Contact Info</label><input type="tel" required {...bind("contact")} /></div>
          <div>
            <label>Problem Category</label>
            <select required {...bind("category")}>
              <option value="">-- Select problem --</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <label>Complaint Description</label>
        <textarea
          required
          maxLength={1000}
          placeholder="Problem detail me likhein (e.g. Fan se awaaz aa rahi hai aur ghoom nahi raha)"
          {...bind("description")}
        />
        <button className="btn" type="submit" disabled={busy}>Submit Complaint</button>
      </form>
    </div>
  );
}
