import { CalendarDays, ChevronDown, Dumbbell, History as HistoryIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { ExerciseSummary, Session } from "../bindings/backend";
import { errorMessage, type TrainingStore } from "../store";
import { sessionDate, SET_NAMES, setText } from "./format";

function HistoryEntry({ session, name }: { session: Session; name: string }) {
  const { entry } = session;
  const heaviest = entry.sets.reduce((top, set) => set.weight > top.weight ? set : top);
  return <details className="history-entry">
    <summary>
      <span className="movement-icon"><Dumbbell size={17} /></span>
      <span className="history-title"><strong>{name}</strong><small><CalendarDays size={13} /> {sessionDate(session)}</small></span>
      <span className="history-top"><strong>{setText(heaviest, entry.unit)}</strong><small>Heaviest set</small></span>
      <ChevronDown className="history-chevron" size={17} />
    </summary>
    <div className="history-details">
      <ul>{entry.sets.map((set) => <li key={set.slot}>
        <span>{SET_NAMES[set.slot]}</span><strong>{setText(set, entry.unit)}</strong>
        {set.restSeconds !== undefined && <small>{set.restSeconds}s rest</small>}
      </li>)}</ul>
      {entry.notes && <p className="history-notes">{entry.notes}</p>}
    </div>
  </details>;
}

export function History({
  store, exercises, exerciseId, setExerciseId,
}: {
  store: TrainingStore;
  exercises: ExerciseSummary[];
  exerciseId: string;
  setExerciseId: (id: string) => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [before, setBefore] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const names = new Map(exercises.map(({ exercise }) => [exercise.id, exercise.name]));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setSessions([]);
    setBefore(null);
    store.getHistory(exerciseId || null, null).then((page) => {
      if (!active) return;
      setSessions(page.sessions);
      setBefore(page.before ?? null);
    }).catch((error) => {
      if (active) setError(errorMessage(error));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [store, exerciseId, retry]);

  async function loadMore() {
    setLoading(true);
    setError("");
    try {
      const page = await store.getHistory(exerciseId || null, before);
      setSessions((current) => [...current, ...page.sessions]);
      setBefore(page.before ?? null);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return <section className="panel history-panel" aria-labelledby="history-title">
    <header className="history-header">
      <div><div className="section-kicker">YOUR PROGRESS</div><h1 id="history-title">Session history</h1>
        <p>Review your previous sets, weights, rest and notes.</p></div>
      <label className="history-filter">Exercise
        <select aria-label="Filter history by exercise" value={exerciseId} disabled={loading}
          onChange={(event) => setExerciseId(event.target.value)}>
          <option value="">All exercises</option>
          {exercises.map(({ exercise }) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
        </select>
      </label>
    </header>
    {sessions.map((session) => <HistoryEntry key={session.entry.id} session={session}
      name={names.get(session.entry.exerciseId) ?? "Exercise"} />)}
    {error && <div className="history-feedback" role="alert"><p>{error}</p>
      <button className="button secondary" onClick={() => before === null ? setRetry(retry + 1) : void loadMore()}>Try again</button></div>}
    {!error && loading && <p className="history-feedback" role="status">Loading sessions…</p>}
    {!error && !loading && !sessions.length && <div className="history-empty">
      <span className="empty-icon"><HistoryIcon size={23} /></span><h2>No sessions yet</h2>
      <p>Saved sessions will appear here.</p></div>}
    {!error && !loading && before !== null && <div className="history-more">
      <button className="button secondary" onClick={() => void loadMore()}>Load older sessions</button></div>}
  </section>;
}
