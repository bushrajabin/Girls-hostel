import { Navigate, Route, Routes } from "react-router-dom";
import StudentApp from "./pages/StudentApp";
import AdminApp from "./pages/AdminApp";
import ResetPassword from "./pages/ResetPassword";
import { ConfigWarning } from "./components/Common";
import { configured } from "./supabaseClient";

export default function App() {
  if (!configured) return <ConfigWarning />;
  return (
    <Routes>
      <Route path="/" element={<StudentApp />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}