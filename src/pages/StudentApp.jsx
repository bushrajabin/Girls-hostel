import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { PageLoader, Tabs, Topbar, useForm } from "../components/Common";
import ComplaintForm from "../components/student/ComplaintForm";
import MyComplaints from "../components/student/MyComplaints";
import FoodFeedback from "../components/student/FoodFeedback";
import Suggestions from "../components/student/Suggestions";

export default function StudentApp() {
  const { loading, profile } = useAuth();
  if (loading) return <PageLoader />;
  return profile ? <Portal profile={profile} /> : <AuthScreen />;
}

/* ---------------- Login / Registration ---------------- */
function AuthScreen() {
  const toast = useToast();
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [f, , bind] = useForm({ email: "", password: "", name: "", room: "", phone: "" });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: f.email.trim(),
        password: f.password,
      });
      if (error) toast("Login failed: " + error.message, "err");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: f.email.trim(),
        password: f.password,
        options: {
          data: { full_name: f.name.trim(), room_number: f.room.trim(), phone: f.phone.trim() },
        },
      });
      if (error) toast(error.message, "err");
      else if (!data.session) {
        toast("Registration ho gayi! Email confirm karke login karein.");
        setMode("login");
      }
    }
    setBusy(false);
  }

  return (
    <>
      <Topbar title="🏠 Girls Hostel Portal" />
      <div className="container narrow">
        <div className="card">
          <Tabs
            tabs={[["login", "Login"], ["signup", "New Registration"]]}
            value={mode}
            onChange={setMode}
          />
          <form onSubmit={submit}>
            {mode === "signup" && (
              <>
                <label>Full Name</label>
                <input type="text" required {...bind("name")} />
                <div className="row">
                  <div>
                    <label>Room Number</label>
                    <input type="text" required placeholder="e.g. 204" {...bind("room")} />
                  </div>
                  <div>
                    <label>Contact Number</label>
                    <input type="tel" required pattern="[0-9+\- ]{10,15}" placeholder="10-digit number" {...bind("phone")} />
                  </div>
                </div>
              </>
            )}
            <label>Email</label>
            <input type="email" required autoComplete="email" {...bind("email")} />
            <label>Password{mode === "signup" ? " (min 6 characters)" : ""}</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              {...bind("password")}
            />
            <button className="btn" type="submit" disabled={busy}>
              {mode === "login" ? "Login" : "Register"}
            </button>
          </form>
          <p className="note center">
            Warden / Caretaker? <Link to="/admin">Login</Link>
          </p>
        </div>
      </div>
    </>
  );
}

/* ---------------- Student dashboard ---------------- */
function Portal({ profile }) {
  const { signOut } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("complaint");
  const [tick, setTick] = useState(0); // complaints refresh trigger

  // Live status: admin status badle to turant refresh
  useEffect(() => {
    const ch = supabase
      .channel(`my-complaints-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "complaints", filter: `student_id=eq.${profile.id}` },
        () => {
          setTick((t) => t + 1);
          toast("Aapki complaint ka status update hua 🔔");
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile.id, toast]);

  return (
    <>
      <Topbar title="🏠 Girls Hostel Portal">
        <span>
          {profile.full_name} • Room {profile.room_number}
          {profile.role === "admin" && <> • <Link to="/admin">Admin panel</Link></>}
        </span>
        <button className="btn" type="button" onClick={signOut}>Logout</button>
      </Topbar>

      <div className="container">
        <Tabs
          tabs={[
            ["complaint", "🛠 Raise Complaint"],
            ["track", "📋 My Complaints"],
            ["food", "🍽 Food Feedback"],
            ["sugg", "💡 Suggestion"],
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "complaint" && (
          <ComplaintForm profile={profile} onDone={() => { setTick((t) => t + 1); setTab("track"); }} />
        )}
        {tab === "track" && <MyComplaints profile={profile} tick={tick} />}
        {tab === "food" && <FoodFeedback profile={profile} />}
        {tab === "sugg" && <Suggestions profile={profile} />}
      </div>
    </>
  );

}
