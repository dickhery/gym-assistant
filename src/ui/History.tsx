import { CalendarDays, ChevronDown, Clock3, Dumbbell, History as HistoryIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { ExerciseSummary, Session } from "../bindings/backend";
import { errorMessage, type TrainingStore } from "../store";
import { compareSetSlots, dateOf, formatDuration, setName, setText } from "./format";

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long", month: "long", day: "numeric", year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function HistoryEntry({ session, name }: { session: Session; name: string }) {
  const { entry } = session;
  const heaviest = entry.sets.reduce((top, set) => set.weight > top.weight ? set : top);
  const sets = [...entry.sets].sort((a, b) => compareSetSlots(a.slot, b.slot));
  const date = dateOf(session);
  return <details className="history-entry">
    <summary>
      <span className="movement-icon"><Dumbbell size={17} /></span>
      <span className="history-title">
        <strong>{name}</strong>
        <small><time dateTime={date.toISOString()}>{timeFormat.format(date)}</time> · {sets.length} {sets.length === 1 ? "set" : "sets"}</small>
      </span>
      <span className="history-top"><strong>{setText(heaviest, entry.unit)}</strong><small>Heaviest set</small></span>
      {session.durationSeconds !== undefined && <span className="history-duration">
        <Clock3 size={14} aria-hidden="true" /> {formatDuration(session.durationSeconds)}
      </span>}
      <ChevronDown className="history-chevron" size={17} />
    </summary>
    <div className="history-details">
      <ul>{sets.map((set) => <li key={set.slot}>
        <span>{setName(set.slot)}</span><strong>{setText(set, entry.unit)}</strong>
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
  const days = new Map<string, Session[]>();
  for (const session of sessions) {
    const day = dayFormat.format(dateOf(session));
    const entries = days.get(day);
    if (entries) entries.push(session);
    else days.set(day, [session]);
  }

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
        <p>Review the exercises, sets, and workout times you logged each day.</p></div>
      <label className="history-filter">Exercise
        <select aria-label="Filter history by exercise" value={exerciseId} disabled={loading}
          onChange={(event) => setExerciseId(event.target.value)}>
          <option value="">All exercises</option>
          {exercises.map(({ exercise }) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
        </select>
      </label>
    </header>
    {[...days].map(([day, entries]) => <section className="history-day" aria-label={day} key={day}>
      <header className="history-day-heading">
        <CalendarDays size={16} aria-hidden="true" />
        <h2>{day}</h2>
        <span>{entries.length} {entries.length === 1 ? "entry" : "entries"}</span>
      </header>
      {entries.map((session) => <HistoryEntry key={session.entry.id} session={session}
        name={names.get(session.entry.exerciseId) ?? "Exercise"} />)}
    </section>)}
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
