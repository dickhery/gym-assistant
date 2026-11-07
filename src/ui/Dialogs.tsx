import { Check, FolderPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Category, Exercise } from "../bindings/backend";
import { categoryColor } from "./format";

export type Editor =
  | { kind: "category"; category?: Category; newId: string }
  | { kind: "exercise"; exercise?: Exercise; defaultCategory?: string; newId: string };

export function EditorDialog({
  editor,
  categories,
  close,
  save,
  removeCategory,
}: {
  editor: Editor;
  categories: Category[];
  close: () => void;
  save: (name: string, categoryIds: string[]) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const current = editor.kind === "exercise" ? editor.exercise : editor.category;
  const [name, setName] = useState(current?.name ?? "");
  const [selected, setSelected] = useState(
    editor.kind === "exercise"
      ? editor.exercise?.categoryIds ?? (editor.defaultCategory ? [editor.defaultCategory] : [])
      : [],
  );
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim()) void run(() => save(name.trim(), selected));
  }

  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby="editor-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
      onClick={(event) => {
        if (event.currentTarget === event.target && !busy) close();
      }}
    >
      <form onSubmit={onSubmit} className="dialog-content">
        <div className="dialog-heading">
          <span className="modal-icon">{current ? <Pencil size={20} /> : editor.kind === "category" ? <FolderPlus size={20} /> : <Plus size={22} />}</span>
          <button type="button" className="icon-button" onClick={close} disabled={busy} aria-label="Close dialog"><X size={20} /></button>
        </div>
        <h2 id="editor-title">{current ? "Edit" : "New"} {editor.kind}</h2>
        <p>{editor.kind === "exercise" ? "Give it a name and choose where it appears in your library." : "Group exercises however you train."}</p>
        <label className="field-label">
          {editor.kind === "exercise" ? "Exercise name" : "Category name"}
          <input autoFocus required maxLength={60} value={name} onChange={(event) => setName(event.target.value)}
            placeholder={editor.kind === "exercise" ? "e.g. Lat pulldown" : "e.g. Back"} disabled={busy} />
        </label>
        {editor.kind === "exercise" && categories.length > 0 && (
          <fieldset className="category-field">
            <legend>Categories <span>Optional · Choose any</span></legend>
            <div className="category-options">
              {categories.map((category) => (
                <label key={category.id} className="category-option">
                  <input type="checkbox" disabled={busy} checked={selected.includes(category.id)}
                    onChange={(event) => setSelected(event.target.checked
                      ? [...selected, category.id]
                      : selected.filter((id) => id !== category.id))} />
                  <span className={`category-dot ${categoryColor(category.id)}`} />
                  {category.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {error && <p className="inline-error" role="alert">{error}</p>}
        {confirmRemove && <p className="remove-warning">Remove this category? Its exercises and training history will stay in your library.</p>}
        <div className="dialog-actions">
          {editor.kind === "category" && editor.category && (
            <button type="button" className="button danger" disabled={busy} onClick={() => {
              if (!confirmRemove) setConfirmRemove(true);
              else void run(() => removeCategory(editor.category!.id));
            }}>
              <Trash2 size={15} /> {confirmRemove ? "Confirm removal" : "Remove"}
            </button>
          )}
          <button type="submit" className="button primary" disabled={busy || !name.trim()}>
            <Check size={17} /> {busy ? "Saving…" : current ? "Save changes" : `Add ${editor.kind}`}
          </button>
        </div>
      </form>
    </dialog>
  );
}
