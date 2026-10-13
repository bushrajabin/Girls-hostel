import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const timer = useRef();

  const toast = useCallback((msg, type = "ok") => {
    setT({ msg, type });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), 3500);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div id="toast" className={t ? `show ${t.type}` : ""}>{t?.msg}</div>
    </ToastCtx.Provider>
  );
}
