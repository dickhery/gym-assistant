import { ArrowDownToLine, Check, ClipboardList, Clock3, Dumbbell, Pencil, Play, RotateCcw, Timer } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Unit, type Category, type Entry, type ExerciseSummary, type LiftSet, type Session } from "../bindings/backend";
import { errorMessage } from "../store";
import { categoryColor, sessionDate, SET_MARKS, SET_NAMES, setText } from "./format";

type SetFields = { weight: string; reps: string; rest: string };
type Draft = { id: string; unit: Unit; sets: SetFields[]; notes: string };

function newDraft(unit: Unit): Draft {
  return {
    id: crypto.randomUUID(), unit, notes: "",
    sets: SET_NAMES.map(() => ({ weight: "", reps: "", rest: "" })),
  };
}

function readDraft(key: string | null, unit: Unit): Draft {
  if (key) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null;
      if (saved && typeof saved.id === "string" && typeof saved.notes === "string"
        && (saved.unit === Unit.lb || saved.unit === Unit.kg) && Array.isArray(saved.sets)
        && saved.sets.length === SET_NAMES.length && saved.sets.every((row) =>
          row && typeof row.weight === "string" && typeof row.reps === "string" && typeof row.rest === "string")) {
        return saved;
      }
    } catch {
      // Storage may be disabled or contain an obsolete draft.
    }
  }
  return newDraft(unit);
}

function RestTimer() {
  const [duration, setDuration] = useState(90);
  const [end, setEnd] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(90);
  const running = end !== null && remaining > 0;

  useEffect(() => {
    if (end === null) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1_000)));
    tick();
    const interval = window.setInterval(() => {
      tick();
      if (Date.now() >= end) window.clearInterval(interval);
    }, 200);
    return () => window.clearInterval(interval);
  }, [end]);

  const display = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <div className={`rest-timer${running ? " running" : ""}`}>
      <span className="timer-label"><Timer size={16} /> Rest timer</span>
      {end === null ? (
        <select aria-label="Rest timer duration" value={duration} onChange={(event) => {
          const seconds = Number(event.target.value);
          setDuration(seconds);
          setRemaining(seconds);
        }}>
          <option value={30}>0:30</option>
          <option value={60}>1:00</option>
          <option value={90}>1:30</option>
          <option value={120}>2:00</option>
          <option value={180}>3:00</option>
        </select>
      ) : <span className="timer-value" role="timer">{display}</span>}
      <button type="button" className="icon-button timer-button"
        aria-label={end === null ? "Start rest timer" : "Reset rest timer"}
        onClick={() => {
          if (end === null) setEnd(Date.now() + duration * 1_000);
          else {
            setEnd(null);
            setRemaining(duration);
          }
        }}>
        {end === null ? <Play size={14} /> : <RotateCcw size={14} />}
      </button>
      {end !== null && !running && <span className="sr-only" role="status">Rest complete.</span>}
    </div>
  );
}

export function TrainingLog({
  summary, categories, principal, edit, log, onSaved,
}: {
  summary: ExerciseSummary;
  categories: Category[];
  principal: string | null;
  edit: () => void;
  log: (entry: Entry) => Promise<Session>;
  onSaved: () => void;
}) {
  const { exercise, latest } = summary;
  const storageKey = principal ? `gym-assistant:draft:${principal}:${exercise.id}` : null;
  const [draft, setDraft] = useState(() => readDraft(storageKey, latest?.entry.unit ?? Unit.lb));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasSets = draft.sets.some(({ weight, reps, rest }) => weight || reps || rest);
  const complete = draft.sets.filter(({ weight, reps }) => weight !== "" && reps !== "").length;
  const tags = categories.filter((category) => exercise.categoryIds.includes(category.id));

  function updateDraft(next: Draft) {
    setDraft(next);
    if (storageKey) {
      try {
        if (next.notes || next.sets.some((row) => row.weight || row.reps || row.rest)) {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        // The in-memory draft remains usable if storage is unavailable.
      }
    }
  }

  function setField(index: number, field: keyof SetFields, value: string) {
    updateDraft({ ...draft, sets: draft.sets.map((row, i) => i === index ? { ...row, [field]: value } : row) });
  }

  function copyLast() {
    if (!latest || hasSets) return;
    updateDraft({
      ...draft,
      unit: latest.entry.unit,
      sets: draft.sets.map((row, slot) => {
        const previous = latest.entry.sets.find((set) => set.slot === slot);
        return previous ? {
          weight: String(previous.weight / 100), reps: String(previous.reps), rest: previous.restSeconds?.toString() ?? "",
        } : row;
      }),
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const sets: LiftSet[] = [];
    for (const [slot, { weight, reps, rest }] of draft.sets.entries()) {
      if (!weight && !reps && !rest) continue;
      if (!weight || !reps) {
        setError(`Enter both weight and reps for ${SET_NAMES[slot].toLowerCase()}.`);
        return;
      }
      sets.push({ slot, weight: Math.round(Number(weight) * 100), reps: Number(reps), restSeconds: rest ? Number(rest) : undefined });
    }
    if (!sets.length) {
      setError("Enter the weight and reps for at least one set. Use 0 for bodyweight.");
      return;
    }
    setBusy(true);
    try {
      await log({ id: draft.id, exerciseId: exercise.id, unit: draft.unit, sets, notes: draft.notes.trim() });
      updateDraft(newDraft(draft.unit));
      onSaved();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel logger" aria-labelledby="logger-title">
      <div className="logger-heading">
        <div>
          <div className="section-kicker"><span className="live-dot" /> SESSION WORKSPACE</div>
          <h2 id="logger-title">{exercise.name}</h2>
          <div className="tag-list">
            {tags.length ? tags.map((category) => (
              <span className={`tag ${categoryColor(category.id)}`} key={category.id}>{category.name}</span>
            )) : <span className="tag neutral">Uncategorized</span>}
          </div>
        </div>
        <button className="icon-button outline" aria-label="Edit exercise" onClick={edit}><Pencil size={16} /></button>
      </div>
      <div className="session-toolbar">
        <span className="last-date"><Clock3 size={15} /> {latest ? `Last logged ${sessionDate(latest)}` : "No previous sessions"}</span>
        {latest && <button type="button" className="text-button" onClick={copyLast} disabled={hasSets || busy}
          title={hasSets ? "Clear this draft to copy the previous session" : undefined}>
          <ArrowDownToLine size={15} /> Use last sets
        </button>}
      </div>
      <form onSubmit={save}>
        <div className="session-controls">
          <div className="units" role="group" aria-label="Weight unit">
            {[Unit.lb, Unit.kg].map((unit) => (
              <button key={unit} type="button" aria-pressed={draft.unit === unit} disabled={busy}
                onClick={() => updateDraft({ ...draft, unit })}>{unit}</button>
            ))}
          </div>
          <RestTimer />
        </div>
        <div className="set-table-wrap">
          <table className="set-table">
            <thead><tr>
              <th scope="col">Set</th>
              <th scope="col">Last session</th>
              <th scope="col">Weight <span>({draft.unit})</span></th>
              <th scope="col">Reps</th>
              <th scope="col">Rest <span>(s)</span></th>
            </tr></thead>
            <tbody>
              {SET_NAMES.map((name, slot) => {
                const previous = latest?.entry.sets.find((set) => set.slot === slot);
                const row = draft.sets[slot];
                return (
                  <tr key={name}>
                    <th scope="row"><span className={`set-mark mark-${SET_MARKS[slot]}`}>{SET_MARKS[slot]}</span><span className="set-name">{name}</span></th>
                    <td className="previous-set">{previous && latest ? <>
                      <span>{setText(previous, latest.entry.unit)}</span>
                      {previous.restSeconds !== undefined && <small>{previous.restSeconds}s rest</small>}
                    </> : <span className="empty-dash">—</span>}</td>
                    <td><input type="number" inputMode="decimal" min={0} max={5000} step={0.01} aria-label={`${name} weight in ${draft.unit}`}
                      placeholder="—" value={row.weight} disabled={busy} onChange={(event) => setField(slot, "weight", event.target.value)} /></td>
                    <td><input type="number" inputMode="numeric" min={1} max={500} step={1} aria-label={`${name} reps`}
                      placeholder="—" value={row.reps} disabled={busy} onChange={(event) => setField(slot, "reps", event.target.value)} /></td>
                    <td><input type="number" inputMode="numeric" min={0} max={3600} step={1} aria-label={`${name} rest in seconds`}
                      placeholder="—" value={row.rest} disabled={busy} onChange={(event) => setField(slot, "rest", event.target.value)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <label className="note-field"><span><ClipboardList size={15} /> Session notes <small>Optional</small></span>
          <textarea placeholder="How did the sets feel?" rows={2} maxLength={500} value={draft.notes} disabled={busy}
            onChange={(event) => updateDraft({ ...draft, notes: event.target.value })} />
        </label>
        {error && <p role="alert" className="inline-error logger-error">{error}</p>}
        <div className="logger-footer">
          <span className="set-count"><span className={complete ? "live-dot" : "muted-dot"} /> {complete} / 5 sets entered</span>
          <div className="logger-actions">
            {(hasSets || draft.notes) && <button className="text-button clear-draft" type="button" disabled={busy} onClick={() => {
              updateDraft(newDraft(draft.unit));
              setError("");
            }}>Clear draft</button>}
            <button className="button primary" type="submit" disabled={busy}>
              <Check size={17} /> {busy ? "Saving…" : "Save session"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

export function EmptyLogger({ add, hasExercises }: { add: () => void; hasExercises: boolean }) {
  return <section className="panel empty-logger">
    <span className="empty-icon"><Dumbbell size={26} /></span>
    <h2>{hasExercises ? "Choose an exercise" : "Start your training log"}</h2>
    <p>{hasExercises ? "Select a movement to see your last session and log today’s sets." : "Add an exercise to start tracking the weight and reps you use for each set."}</p>
    {!hasExercises && <button className="button primary" onClick={add}>Add your first exercise</button>}
  </section>;
}
