import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useToast } from "../components/Toast";
import { PageLoader, Topbar, useForm } from "../components/Common";

/* Opened from the link in the "reset password" email */
export default function ResetPassword() {
  const toast = useToast();
  const navigate = useNavigate();
  const [state, setState] = useState("checking"); // checking | ready | invalid
  const [busy, setBusy] = useState(false);
  const [f, , bind] = useForm({ password: "", confirm: "" });

  useEffect(() => {
    let alive = true;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && alive) setState("ready");
    });
    // The email link signs the person in; wait until that session is picked up
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      setState((s) => (session ? "ready" : s === "ready" ? s : "invalid"));
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (f.password.length < 6) return toast("Password must be at least 6 characters", "err");
    if (f.password !== f.confirm) return toast("Passwords do not match", "err");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: f.password });
    setBusy(false);
    if (error) return toast(error.message, "err");
    toast("Password updated");
    navigate("/", { replace: true });
  }

  if (state === "checking") return <PageLoader />;

  return (
    <>
      <Topbar title="🏠 Girls Hostel Portal" />
      <div className="container narrow">
        <div className="card">
          {state === "invalid" ? (
            <>
              <h2>Link expired</h2>
              <p>This reset link is invalid or has expired. Please request a new one from the login page.</p>
              <p className="note"><Link to="/">← Back to login</Link></p>
            </>
          ) : (
            <>
              <h2>Set a new password</h2>
              <form onSubmit={submit}>
                <label>New password (min 6 characters)</label>
                <input type="password" required minLength={6} autoComplete="new-password" {...bind("password")} />
                <label>Confirm new password</label>
                <input type="password" required minLength={6} autoComplete="new-password" {...bind("confirm")} />
                <button className="btn" type="submit" disabled={busy}>Update password</button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}