import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import "./styles.css";

function DevCredit() {
  return (
    <footer className="dev-credit">
      Developed by:{" "}
      <a
        href="https://www.linkedin.com/in/bushra-jabin-72746424a/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Bushra Jabin
      </a>
    </footer>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
          <DevCredit />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);