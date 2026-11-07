import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { auth, authenticatedStore } from "./store";
import { Hero } from "./ui/Brand";
import { clearAccountDrafts } from "./ui/TrainingLog";
import { Workspace } from "./ui/Workspace";
import "./style.css";

const subscribe = (notify: () => void) => auth.subscribe(notify);
const authSnapshot = () => auth.getStatus();

function App() {
  const status = useSyncExternalStore(subscribe, authSnapshot);
  const principal = status.state === "signed-in" ? status.principal.toText() : null;
  const expiredPrincipal = status.state === "expired" ? status.principal.toText() : null;
  const previousPrincipal = useRef<string | null>(null);
  const store = useMemo(() => principal ? authenticatedStore(principal) : null, [principal]);
  const [authAction, setAuthAction] = useState<"sign-in" | "sign-out" | null>(null);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const departed = previousPrincipal.current ?? expiredPrincipal;
    if (departed && departed !== principal) clearAccountDrafts(departed);
    previousPrincipal.current = principal;
  }, [principal, expiredPrincipal]);

  async function signIn() {
    setAuthAction("sign-in");
    setAuthError("");
    try {
      await auth.signIn();
    } catch {
      setAuthError("Sign-in didn’t finish. Try again and keep the Internet Identity window open.");
    } finally {
      setAuthAction(null);
    }
  }

  async function signOut() {
    setAuthAction("sign-out");
    setAuthError("");
    try {
      await auth.signOut();
    } catch {
      setAuthError(auth.isAuthenticated()
        ? "Couldn’t sign out. Try again."
        : "You’re signed out on this device. Internet Identity couldn’t confirm session revocation.");
    } finally {
      setAuthAction(null);
    }
  }

  if (principal && store && authAction !== "sign-out") {
    return <Workspace key={principal} {...{ principal, store, authError }} onSignOut={signOut} />;
  }

  return (
    <main className="main-content sign-in-page">
      <Hero />
      <section className="panel sign-in-panel" aria-labelledby="sign-in-heading">
        <span className="empty-icon"><ShieldCheck size={25} /></span>
        <h2 id="sign-in-heading">Open your private training log</h2>
        <p>Sign in to view your workout history, organize exercises, and log your sets.</p>
        {authError && <p className="inline-error" role="alert">{authError}</p>}
        <button className="button sign-in" onClick={() => void signIn()} disabled={authAction !== null}>
          {authAction === null && <ShieldCheck size={16} />}
          {authAction === "sign-out" ? "Signing out…" : authAction === "sign-in" ? "Signing in…" : "Sign in with Internet Identity"}
          {authAction === null && <ArrowRight size={15} />}
        </button>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
