import {
  CalendarDays, ChevronRight, Dumbbell, Folder, History as HistoryIcon,
  LayoutGrid, LogOut, Menu, Pencil, Plus, Search, ShieldCheck, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Entry, ExerciseSummary, Session, Workspace as WorkspaceData } from "../bindings/backend";
import { errorMessage, type TrainingStore } from "../store";
import { Brand, Hero } from "./Brand";
import { EditorDialog, type Editor } from "./Dialogs";
import { categoryColor, dateOf, formatCount, sessionDate } from "./format";
import { History } from "./History";
import { EmptyLogger, TrainingLog } from "./TrainingLog";

type View = "log" | "history";
const sortByName = <T extends { name: string }>(first: T, second: T) => first.name.localeCompare(second.name);

export function Workspace({
  store, principal, authError, onSignOut,
}: {
  store: TrainingStore;
  principal: string;
  authError: string;
  onSignOut: () => Promise<void>;
}) {
  const [data, setData] = useState<WorkspaceData>();
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState<View>("log");
  const [categoryId, setCategoryId] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [historyId, setHistoryId] = useState("");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [knownSessions] = useState(() => new Set<string>());

  useEffect(() => {
    let active = true;
    setLoadError("");
    store.getWorkspace().then((workspace) => {
      if (!active) return;
      workspace.exercises.forEach(({ latest }) => { if (latest) knownSessions.add(latest.entry.id); });
      setData(workspace);
      setExerciseId(workspace.exercises[0]?.exercise.id ?? "");
    }).catch((error) => {
      if (active) setLoadError(errorMessage(error));
    });
    return () => { active = false; };
  }, [store, retry, knownSessions]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const categories = [...data?.categories ?? []].sort(sortByName);
  const exercises = [...data?.exercises ?? []].sort((a, b) => sortByName(a.exercise, b.exercise));
  const shown = exercises.filter(({ exercise }) =>
    (!categoryId || exercise.categoryIds.includes(categoryId)) &&
    exercise.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const selected = shown.find(({ exercise }) => exercise.id === exerciseId) ?? shown[0];
  const latest = exercises.reduce<Session | undefined>((last, { latest }) =>
    latest && (!last || latest.loggedAt > last.loggedAt) ? latest : last, undefined);
  const activeCategory = categories.find(({ id }) => categoryId === id);

  function navigate(next: View) {
    setView(next);
    setMenuOpen(false);
  }

  function selectCategory(id: string) {
    setCategoryId(id);
    setSearch("");
    navigate("log");
  }

  function newCategory() {
    setMenuOpen(false);
    setEditor({ kind: "category", newId: crypto.randomUUID() });
  }

  function newExercise() {
    setEditor({ kind: "exercise", defaultCategory: categoryId || undefined, newId: crypto.randomUUID() });
  }

  async function saveEditor(name: string, categoryIds: string[]) {
    if (!editor) return;
    try {
      if (editor.kind === "category") {
        const category = await store.saveCategory({ id: editor.category?.id ?? editor.newId, name });
        setData((current) => current && ({
          ...current, categories: [...current.categories.filter(({ id }) => id !== category.id), category],
        }));
      } else {
        const exercise = await store.saveExercise({ id: editor.exercise?.id ?? editor.newId, name, categoryIds });
        setData((current) => {
          if (!current) return current;
          const previous = current.exercises.find((item) => item.exercise.id === exercise.id);
          return {
            ...current,
            exercises: [
              ...current.exercises.filter((item) => item.exercise.id !== exercise.id),
              { ...previous, exercise, sessionCount: previous?.sessionCount ?? 0n },
            ],
          };
        });
        if (categoryId && !categoryIds.includes(categoryId)) setCategoryId("");
        setSearch("");
        setExerciseId(exercise.id);
      }
      setNotice(editor.kind === "category" ? "Category saved." : "Exercise saved.");
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  }

  async function removeCategory(id: string) {
    try {
      await store.removeCategory(id);
      setData((current) => current && ({
        ...current,
        categories: current.categories.filter((category) => category.id !== id),
        exercises: current.exercises.map((item) => ({
          ...item, exercise: { ...item.exercise, categoryIds: item.exercise.categoryIds.filter((tag) => tag !== id) },
        })),
      }));
      if (categoryId === id) setCategoryId("");
      setNotice("Category removed.");
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  }

  async function log(entry: Entry) {
    const session = await store.logSession(entry);
    if (!knownSessions.has(entry.id)) {
      knownSessions.add(entry.id);
      setData((current) => current && ({
        ...current,
        sessionCount: current.sessionCount + 1n,
        exercises: current.exercises.map((item) => item.exercise.id === entry.exerciseId ? {
          ...item,
          latest: !item.latest || item.latest.loggedAt <= session.loggedAt ? session : item.latest,
          sessionCount: item.sessionCount + 1n,
        } : item),
      }));
    }
    return session;
  }

  return (
    <div className="app-shell">
      {menuOpen && <button className="menu-scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
      <aside className={`sidebar${menuOpen ? " menu-open" : ""}`}>
        <Brand />
        <div className="sidebar-body">
          <nav className="sidebar-group" aria-label="Workspace">
            <div className="sidebar-heading">WORKSPACE</div>
            <button className={`nav-item${view === "log" ? " active" : ""}`} onClick={() => navigate("log")} aria-current={view === "log" ? "page" : undefined}>
              <LayoutGrid size={17} /> <span>Training log</span>
            </button>
            <button className={`nav-item${view === "history" ? " active" : ""}`} onClick={() => { setHistoryId(""); navigate("history"); }} aria-current={view === "history" ? "page" : undefined}>
              <HistoryIcon size={18} /> <span>Session history</span>
            </button>
          </nav>
          <nav className="sidebar-group categories" aria-label="Categories">
            <div className="sidebar-heading">CATEGORIES
              <button className="icon-button sidebar-add" aria-label="Add category" title="Add category" onClick={newCategory} disabled={!data}><Plus size={17} /></button>
            </div>
            <button className={`nav-item category-nav${view === "log" && !categoryId ? " selected" : ""}`} onClick={() => selectCategory("")}>
              <Folder size={16} /> <span>All exercises</span><small>{exercises.length}</small>
            </button>
            {categories.map((category) => (
              <div className={`category-line${view === "log" && categoryId === category.id ? " selected" : ""}`} key={category.id}>
                <button className="nav-item category-nav" onClick={() => selectCategory(category.id)} title={category.name}>
                  <span className={`category-dot ${categoryColor(category.id)}`} /><span>{category.name}</span>
                  <small>{exercises.filter(({ exercise }) => exercise.categoryIds.includes(category.id)).length}</small>
                </button>
                <button className="icon-button category-edit" aria-label={`Edit ${category.name} category`} onClick={() => {
                  setMenuOpen(false);
                  setEditor({ kind: "category", category, newId: category.id });
                }}><Pencil size={13} /></button>
              </div>
            ))}
          </nav>
        </div>
        <div className="sidebar-footer">
          <div className="account-card">
            <span className="account-icon"><ShieldCheck size={17} /></span>
            <span><strong>Signed in</strong><small>Internet Identity</small></span>
          </div>
          <button className="nav-item sign-out" onClick={() => void onSignOut()}><LogOut size={16} /> <span>Sign out</span></button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="icon-button menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
            <span>Workspace</span><ChevronRight size={14} /><strong>{view === "log" ? "Training log" : "Session history"}</strong>
          </div>
          <span className="account-status"><span className="live-dot" /> <span>Internet Identity</span></span>
        </header>
        <div className="main-content">
          {authError && <p className="inline-error top-error" role="alert">{authError}</p>}
          {view === "log" && <Hero />}
          {!data && <section className="panel load-state">
            {loadError ? <><p role="alert">{loadError}</p><button className="button secondary" onClick={() => setRetry(retry + 1)}>Retry</button></>
              : <p role="status">Loading your training log…</p>}
          </section>}
          {data && view === "history" && <History key={historyId} store={store} exercises={exercises} exerciseId={historyId} setExerciseId={setHistoryId} />}
          {data && view === "log" && <>
            <div className="metrics" aria-label="Training overview">
              <Metric icon={<Dumbbell size={19} />} name="Exercises" value={formatCount(exercises.length)} tone="sage" />
              <Metric icon={<HistoryIcon size={19} />} name="Sessions logged" value={formatCount(data.sessionCount)} tone="plum" />
              <Metric icon={<CalendarDays size={19} />} name="Last trained" value={latest ? dateOf(latest).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"} tone="amber" />
            </div>
            <div className="dashboard-grid">
              <section className="panel library" aria-labelledby="library-title">
                <div className="library-heading">
                  <div><div className="section-kicker">YOUR MOVEMENTS</div><h2 id="library-title">{activeCategory?.name ?? "Exercise library"}</h2></div>
                  <button className="icon-button library-add" onClick={newExercise} aria-label="Add exercise" title="Add exercise"><Plus size={20} /></button>
                </div>
                {exercises.length > 0 && <label className="search-field">
                  <Search size={16} /><input type="search" aria-label="Search exercises" placeholder="Find an exercise…" value={search}
                    onChange={(event) => setSearch(event.target.value)} />
                </label>}
                <div className="exercise-list">
                  {shown.map((item) => <ExerciseRow key={item.exercise.id} item={item} active={selected?.exercise.id === item.exercise.id}
                    choose={() => setExerciseId(item.exercise.id)} />)}
                  {shown.length === 0 && <div className="library-empty">
                    <p>{search ? "No matching exercises." : "No exercises here yet."}</p>
                    {!search && <button className="text-button" onClick={newExercise}><Plus size={15} /> Add an exercise</button>}
                  </div>}
                </div>
                {selected?.latest && <button className="library-history text-button" onClick={() => {
                  setHistoryId(selected.exercise.id);
                  navigate("history");
                }}><HistoryIcon size={15} /> View exercise history <ChevronRight size={15} /></button>}
              </section>
              {selected ? <TrainingLog key={selected.exercise.id} summary={selected} categories={categories} principal={principal}
                edit={() => setEditor({ kind: "exercise", exercise: selected.exercise, newId: selected.exercise.id })}
                log={log} onSaved={() => setNotice("Session saved.")} />
                : <EmptyLogger add={newExercise} hasExercises={exercises.length > 0} />}
            </div>
          </>}
          <footer className="page-footer"><span>GYM ASSISTANT</span><span>Built on the Internet Computer</span></footer>
        </div>
      </main>
      {notice && <div role="status" className="toast"><span className="live-dot" />{notice}</div>}
      {editor && <EditorDialog editor={editor} categories={categories} close={() => setEditor(undefined)} save={saveEditor} removeCategory={removeCategory} />}
    </div>
  );
}

function Metric({ icon, name, value, tone }: { icon: React.ReactNode; name: string; value: string; tone: string }) {
  return <div className="metric panel">
    <span className={`metric-icon ${tone}`}>{icon}</span><span><small>{name}</small><strong>{value}</strong></span>
  </div>;
}

function ExerciseRow({ item, active, choose }: { item: ExerciseSummary; active: boolean; choose: () => void }) {
  return <button className={`exercise-row${active ? " active" : ""}`} onClick={choose} aria-pressed={active}>
    <span className="movement-icon"><Dumbbell size={16} /></span>
    <span className="movement-label"><strong>{item.exercise.name}</strong>
      <small>{item.latest ? `Last logged ${sessionDate(item.latest)}` : "No sessions yet"}</small></span>
    <ChevronRight size={16} className="exercise-chevron" />
  </button>;
}
