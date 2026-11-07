import { createRoot } from "react-dom/client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { auth, authenticatedStore, createDemoStore } from "./store";
import { Workspace } from "./ui/Workspace";
import "./style.css";

const subscribe = (notify: () => void) => auth.subscribe(notify);
const principalSnapshot = () => auth.getPrincipal()?.toText() ?? null;
const demo = createDemoStore();

function App() {
  const principal = useSyncExternalStore(subscribe, principalSnapshot);
  const store = useMemo(() => principal ? authenticatedStore(principal) : demo, [principal]);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  async function toggleAuth() {
    setAuthBusy(true);
    setAuthError("");
    try {
      if (principal) await auth.signOut();
      else await auth.signIn();
    } catch {
      setAuthError(principal ? "Couldn’t sign out. Try again." : "Sign-in didn’t finish. Try again and keep the Internet Identity window open.");
    } finally {
      setAuthBusy(false);
    }
  }

  return <Workspace key={principal ?? "demo"} {...{ principal, store, authBusy, authError, toggleAuth }} />;
}

createRoot(document.getElementById("root")!).render(<App />);
