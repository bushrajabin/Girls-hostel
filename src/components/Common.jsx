import { useState } from "react";

export function StatusBadge({ status }) {
  const cls = status === "Solved" ? "solved" : status === "In Progress" ? "progress" : "pending";
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function StarInput({ value, onChange }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`${i} star`}
          className={i <= value ? "on" : ""}
          onClick={() => onChange(i)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function Topbar({ title, children }) {
  return (
    <div className="topbar">
      <h1>{title}</h1>
      <div className="who">{children}</div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`tab ${value === key ? "active" : ""}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function PageLoader() {
  return <div className="empty" style={{ padding: 80 }}>Loading…</div>;
}

export function ConfigWarning() {
  return (
    <div className="container narrow">
      <div className="card">
        <h2>⚠️ Supabase setup baaki hai</h2>
        <p>
          Project folder me <code>.env</code> file banayein (<code>.env.example</code> copy karke) aur
          apna <b>VITE_SUPABASE_URL</b> aur <b>VITE_SUPABASE_ANON_KEY</b> daalein. Phir app dobara
          start / build karein.
        </p>
      </div>
    </div>
  );
}

// Chhota helper: simple controlled form state
export function useForm(initial) {
  const [f, setF] = useState(initial);
  const bind = (k) => ({ value: f[k], onChange: (e) => setF((p) => ({ ...p, [k]: e.target.value })) });
  return [f, setF, bind];
}
