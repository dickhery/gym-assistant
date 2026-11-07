import { ArrowDownToLine, Check, ClipboardList, Clock3, Dumbbell, Pencil, Play, Plus, RotateCcw, Timer, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Unit, type Category, type ExerciseSummary, type LiftSet, type Session, type SessionInput } from "../bindings/backend";
import { errorMessage } from "../store";
import {
  BURNOUT_SLOT, DEFAULT_SET_SLOTS, MAX_SET_SLOT, WARM_UP_SLOT, WORKING_SET_SLOTS,
  categoryColor, compareSetSlots, formatDuration, sessionDate, setMark, setName, setText,
} from "./format";

type SetFields = { weight: string; reps: string; rest: string };
type DraftSet = SetFields & { slot: number };
type Draft = { id: string; unit: Unit; sets: DraftSet[]; notes: string; startedAt?: number };
const draftPrefix = (principal: string) => `gym-assistant:draft:${principal}:`;
const blankSet = (slot: number): DraftSet => ({ slot, weight: "", reps: "", rest: "" });
const hasValues = ({ weight, reps, rest }: SetFields) => Boolean(weight || reps || rest);
const isComplete = ({ weight, reps }: SetFields) =>
  weight !== "" && Number(weight) >= 0 && Number(weight) <= 5000 &&
  Number.isInteger(Number(reps)) && Number(reps) >= 1 && Number(reps) <= 500;
const workoutSeconds = (startedAt: number, now: number) =>
  Math.min(0xffff_ffff, Math.max(0, Math.floor((now - startedAt) / 1000)) + 30);

function templateSlots(last?: Session) {
  return [...new Set([...DEFAULT_SET_SLOTS, ...(last?.entry.sets.map(({ slot }) => slot) ?? [])])]
    .sort(compareSetSlots);
}

export function clearAccountDrafts(principal: string) {
  const prefix = draftPrefix(principal);
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch {
    // The browser may block local storage.
  }
}

function newDraft(unit: Unit, last?: Session): Draft {
  return {
    id: crypto.randomUUID(), unit, notes: "",
    sets: templateSlots(last).map(blankSet),
  };
}

function readDraft(key: string, unit: Unit, last?: Session): Draft {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null;
    if (saved && typeof saved.id === "string" && typeof saved.notes === "string"
      && (saved.unit === Unit.lb || saved.unit === Unit.kg) && Array.isArray(saved.sets)
      && saved.sets.length <= MAX_SET_SLOT + 1 && saved.sets.every((row) =>
        row && typeof row.weight === "string" && typeof row.reps === "string" && typeof row.rest === "string")) {
      const sets = saved.sets.map((row, index) => ({ ...row, slot: row.slot ?? index }));
      const slots = new Set(sets.map(({ slot }) => slot));
      if (slots.size === sets.length && sets.every(({ slot }) => Number.isInteger(slot) && slot >= 0 && slot <= MAX_SET_SLOT)) {
        return {
          ...saved,
          sets: sets.sort((a, b) => compareSetSlots(a.slot, b.slot)),
          startedAt: Number.isFinite(saved.startedAt) ? saved.startedAt : undefined,
        };
      }
    }
  } catch {
    // Storage may be disabled or contain an obsolete draft.
  }
  return newDraft(unit, last);
}

function WorkoutDuration({ startedAt, savingSeconds }: { startedAt?: number; savingSeconds?: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (startedAt === undefined || savingSeconds !== undefined) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [startedAt, savingSeconds]);

  return <div className="workout-duration">
    <Clock3 size={15} />
    {startedAt === undefined
      ? <span>Workout timer starts after your first set is filled in.</span>
      : <><strong role="timer" aria-label="Estimated workout duration">{formatDuration(savingSeconds ?? workoutSeconds(startedAt, now))}</strong>
        <span>Workout time · includes 30s for the first set</span></>}
  </div>;
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
  principal: string;
  edit: () => void;
  log: (entry: SessionInput) => Promise<Session>;
  onSaved: () => void;
}) {
  const { exercise, latest } = summary;
  const storageKey = draftPrefix(principal) + exercise.id;
  const [draft, setDraft] = useState(() => readDraft(storageKey, latest?.entry.unit ?? Unit.lb, latest));
  const [savingSeconds, setSavingSeconds] = useState<number>();
  const busy = savingSeconds !== undefined;
  const [error, setError] = useState("");
  const hasSets = draft.sets.some(hasValues);
  const complete = draft.sets.filter(isComplete).length;
  const slots = new Set(draft.sets.map(({ slot }) => slot));
  const nextWorkingSlot = WORKING_SET_SLOTS.find((slot) => !slots.has(slot));
  const defaultSlots = templateSlots(latest);
  const hasDraft = hasSets || draft.notes || draft.startedAt !== undefined ||
    draft.sets.length !== defaultSlots.length || defaultSlots.some((slot) => !slots.has(slot));
  const tags = categories.filter((category) => exercise.categoryIds.includes(category.id));

  function updateDraft(next: Draft) {
    const updated = next.startedAt === undefined && next.sets.some(isComplete)
      ? { ...next, startedAt: Date.now() }
      : next;
    setDraft(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // The in-memory draft remains usable if storage is unavailable.
    }
  }

  function resetDraft(last?: Session) {
    setDraft(newDraft(draft.unit, last));
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // The browser may block local storage.
    }
  }

  function setField(slot: number, field: keyof SetFields, value: string) {
    updateDraft({ ...draft, sets: draft.sets.map((row) => row.slot === slot ? { ...row, [field]: value } : row) });
  }

  function addSet(slot: number) {
    updateDraft({ ...draft, sets: [...draft.sets, blankSet(slot)].sort((a, b) => compareSetSlots(a.slot, b.slot)) });
  }

  function copyLast() {
    if (!latest || hasSets) return;
    updateDraft({
      ...draft,
      unit: latest.entry.unit,
      sets: latest.entry.sets.map(({ slot, weight, reps, restSeconds }) => ({
        slot, weight: String(weight / 100), reps: String(reps), rest: restSeconds?.toString() ?? "",
      })).sort((a, b) => compareSetSlots(a.slot, b.slot)),
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const sets: LiftSet[] = [];
    for (const row of draft.sets) {
      if (!hasValues(row)) continue;
      const { slot, weight, reps, rest } = row;
      if (!isComplete(row)) {
        setError(`Enter a valid weight and rep count for ${setName(slot).toLowerCase()}.`);
        return;
      }
      sets.push({ slot, weight: Math.round(Number(weight) * 100), reps: Number(reps), restSeconds: rest ? Number(rest) : undefined });
    }
    if (!sets.length) {
      setError("Enter the weight and reps for at least one set. Use 0 for bodyweight.");
      return;
    }
    const now = Date.now();
    const durationSeconds = workoutSeconds(draft.startedAt ?? now, now);
    sets.sort((a, b) => a.slot - b.slot);
    setSavingSeconds(durationSeconds);
    try {
      const saved = await log({ id: draft.id, exerciseId: exercise.id, unit: draft.unit, sets, notes: draft.notes.trim(), durationSeconds });
      resetDraft(saved);
      onSaved();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSavingSeconds(undefined);
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
              <th scope="col" aria-label="Remove set" />
            </tr></thead>
            <tbody>
              {draft.sets.map((row) => {
                const { slot } = row;
                const name = setName(slot);
                const mark = setMark(slot);
                const previous = latest?.entry.sets.find((set) => set.slot === slot);
                return (
                  <tr key={slot}>
                    <th scope="row"><span className={`set-mark mark-${mark}`} aria-hidden="true">{mark}</span><span className="set-name">{name}</span></th>
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
                    <td className="remove-set-cell">
                      <button className="icon-button remove-set" type="button" disabled={busy} aria-label={`Remove ${name} set`}
                        onClick={() => updateDraft({ ...draft, sets: draft.sets.filter((set) => set.slot !== slot) })}>
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {draft.sets.length === 0 && <tr><td className="no-sets" colSpan={6}>Add a set to start this entry.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="set-actions" aria-label="Add sets">
          <button className="button secondary" type="button" disabled={busy || nextWorkingSlot === undefined}
            onClick={() => { if (nextWorkingSlot !== undefined) addSet(nextWorkingSlot); }}>
            <Plus size={15} /> Add set
          </button>
          {!slots.has(WARM_UP_SLOT) && <button className="button secondary" type="button" disabled={busy}
            onClick={() => addSet(WARM_UP_SLOT)}>Add warm-up</button>}
          {!slots.has(BURNOUT_SLOT) && <button className="button secondary" type="button" disabled={busy}
            onClick={() => addSet(BURNOUT_SLOT)}>Add burnout</button>}
        </div>
        <WorkoutDuration startedAt={draft.startedAt} savingSeconds={savingSeconds} />
        <label className="note-field"><span><ClipboardList size={15} /> Session notes <small>Optional</small></span>
          <textarea placeholder="How did the sets feel?" rows={2} maxLength={500} value={draft.notes} disabled={busy}
            onChange={(event) => updateDraft({ ...draft, notes: event.target.value })} />
        </label>
        {error && <p role="alert" className="inline-error logger-error">{error}</p>}
        <div className="logger-footer">
          <span className="set-count"><span className={complete ? "live-dot" : "muted-dot"} /> {complete} / {draft.sets.length} sets entered</span>
          <div className="logger-actions">
            {hasDraft && <button className="text-button clear-draft" type="button" disabled={busy} onClick={() => {
              resetDraft(latest);
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
