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
  if (!profile) return <AuthScreen />;
  // Google se pehli baar aayi student: room aur phone abhi nahi pata
  if (profile.role !== "admin" && !(profile.room_number && profile.phone)) {
    return <CompleteProfile profile={profile} />;
  }
  return <Portal profile={profile} />;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.39-2.29v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75z" />
    </svg>
  );
}

/* ---------------- Google ke baad: room + phone ---------------- */
function CompleteProfile({ profile }) {
  const { refresh, signOut } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, , bind] = useForm({
    name: profile.full_name || "",
    room: profile.room_number || "",
    phone: profile.phone || "",
  });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("complete_profile", {
      p_name: f.name.trim(),
      p_room: f.room.trim(),
      p_phone: f.phone.trim(),
    });
    setBusy(false);
    if (error) return toast("Save nahi hua: " + error.message, "err");
    await refresh();
  }

  return (
    <>
      <Topbar title="🏠 Girls Hostel Portal" />
      <div className="container narrow">
        <div className="card">
          <h2>Bas ek step aur</h2>
          <p className="note">
            Complaint sahi room tak pahunchane ke liye room number aur contact number daalein.
            {profile.email && <> (Signed in as {profile.email})</>}
          </p>
          <form onSubmit={submit}>
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
            <button className="btn" type="submit" disabled={busy}>Save and continue</button>
          </form>
          <p className="note center">
            <button className="link" type="button" onClick={signOut}>Dusre account se login karein</button>
          </p>
        </div>
      </div>
    </>
  );
}

/* ---------------- Login / Registration ---------------- */
function AuthScreen() {
  const toast = useToast();
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [f, , bind] = useForm({ email: "", password: "", name: "", room: "", phone: "" });

  async function googleLogin() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/" },
    });
    if (error) {
      setBusy(false);
      toast("Google login failed: " + error.message, "err");
    }
  }

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

  if (forgot) return <ForgotPassword onBack={() => setForgot(false)} />;

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
            {mode === "login" && (
              <div className="forgot-row">
                <button className="link" type="button" onClick={() => setForgot(true)}>
                  Forgot password?
                </button>
              </div>
            )}
            <div className="or"><span>Or Continue with Google</span></div>

            <button className="gbtn" type="button" onClick={googleLogin} disabled={busy}>
              <GoogleIcon /> Continue with Google
            </button>
            {/* <p className="note center">Google se pehli baar aane par room number aur phone puchha jayega.</p> */}
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

/* ---------------- Forgot password ---------------- */
function ForgotPassword({ onBack }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/reset-password",
    });
    setBusy(false);
    if (error) return toast(error.message, "err");
    setSent(true);
  }

  return (
    <>
      <Topbar title="🏠 Girls Hostel Portal" />
      <div className="container narrow">
        <div className="card">
          <h2>Reset your password</h2>
          {sent ? (
            <>
              <p>
                If <b>{email.trim()}</b> has an account, we have sent a link to reset the password.
                Please check your inbox (and the spam folder). The link works for a limited time.
              </p>
              <button className="btn" type="button" onClick={onBack}>Back to login</button>
            </>
          ) : (
            <form onSubmit={submit}>
              <p className="note" style={{ marginTop: 0 }}>
                Enter the email you registered with. We will email you a link to set a new password.
              </p>
              <label>Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn" type="submit" disabled={busy}>Send reset link</button>
              <p className="note center">
                <button className="link" type="button" onClick={onBack}>← Back to login</button>
              </p>
            </form>
          )}
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