import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { PageLoader, Tabs, Topbar, useForm } from "../components/Common";
import ComplaintsAdmin from "../components/admin/ComplaintsAdmin";
import FoodAdmin from "../components/admin/FoodAdmin";
import SuggestionsAdmin from "../components/admin/SuggestionsAdmin";

export default function AdminApp() {
  const { loading, profile, signOut } = useAuth();
  if (loading) return <PageLoader />;
  if (!profile) return <AdminLogin />;
  if (profile.role !== "admin") {
    return (
      <>
        <Topbar title="🛡 Hostel Admin Panel" />
        <div className="container narrow">
          <div className="card center">
            <h2>Access denied</h2>
            <p>This account does not have admin access. Please contact the warden to get access.</p>
            <button className="btn" type="button" onClick={signOut}>Logout</button>
            <p className="note"><Link to="/">← Student portal</Link></p>
          </div>
        </div>
      </>
    );
  }
  return <Dashboard profile={profile} />;
}

function AdminLogin() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, , bind] = useForm({ email: "", password: "" });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: f.email.trim(),
      password: f.password,
    });
    setBusy(false);
    if (error) toast("Login failed: " + error.message, "err");
  }

  return (
    <>
      <Topbar title="🛡 Hostel Admin Panel" />
      <div className="container narrow">
        <div className="card">
          <h2>Warden / Caretaker Login</h2>
          <form onSubmit={submit}>
            <label>Email</label>
            <input type="email" required autoComplete="email" {...bind("email")} />
            <label>Password</label>
            <input type="password" required autoComplete="current-password" {...bind("password")} />
            <button className="btn" type="submit" disabled={busy}>Login</button>
          </form>
          <p className="note center"><Link to="/">← Student portal</Link></p>
        </div>
      </div>
    </>
  );
}

function Dashboard({ profile }) {
  const { signOut } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("complaints");
  const [tick, setTick] = useState(0);

  // Refresh the list as soon as a new complaint arrives
  useEffect(() => {
    const ch = supabase
      .channel("admin-complaints")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "complaints" }, () => {
        toast("New complaint received 🔔");
        setTick((t) => t + 1);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [toast]);

  return (
    <>
      <Topbar title="🛡 Hostel Admin Panel">
        <span>{profile.full_name || profile.email} (Admin)</span>
        <button className="btn" type="button" onClick={signOut}>Logout</button>
      </Topbar>
      <div className="container">
        <Tabs
          tabs={[
            ["complaints", "🛠 Complaints"],
            ["food", "🍽 Food Feedback"],
            ["sugg", "💡 Suggestions"],
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "complaints" && <ComplaintsAdmin tick={tick} />}
        {tab === "food" && <FoodAdmin />}
        {tab === "sugg" && <SuggestionsAdmin />}
      </div>
    </>
  );
}