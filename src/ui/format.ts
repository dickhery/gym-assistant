import type { LiftSet, Session, Unit } from "../bindings/backend";

export const WARM_UP_SLOT = 0;
export const BURNOUT_SLOT = 4;
export const MAX_SET_SLOT = 21;
export const DEFAULT_SET_SLOTS = [WARM_UP_SLOT, 1, 2, 3, BURNOUT_SLOT];
export const WORKING_SET_SLOTS = Array.from({ length: MAX_SET_SLOT }, (_, index) => index + 1)
  .filter((slot) => slot !== BURNOUT_SLOT);
export const CATEGORY_COLORS = ["sage", "plum", "amber", "sky", "coral"] as const;

const workingSetNumber = (slot: number) => slot > BURNOUT_SLOT ? slot - 1 : slot;
export const setName = (slot: number) =>
  slot === WARM_UP_SLOT ? "Warm-up" : slot === BURNOUT_SLOT ? "Burnout" : `Heavy ${workingSetNumber(slot)}`;
export const setMark = (slot: number) =>
  slot === WARM_UP_SLOT ? "W" : slot === BURNOUT_SLOT ? "B" : String(workingSetNumber(slot));
const displayOrder = (slot: number) => slot === BURNOUT_SLOT ? MAX_SET_SLOT + 1 : slot;
export const compareSetSlots = (left: number, right: number) => displayOrder(left) - displayOrder(right);

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return `${hours ? `${hours}h ` : ""}${hours || minutes ? `${minutes}m ` : ""}${seconds % 60}s`;
}

export const formatCount = (value: bigint | number) => new Intl.NumberFormat().format(value);
export const unitName = (unit: Unit) => unit;
export const dateOf = (session: Session) => new Date(Number(session.loggedAt / 1_000_000n));
export const sessionDate = (session: Session) =>
  dateOf(session).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
export const setText = (set: LiftSet, unit: Unit) =>
  `${formatCount(set.weight / 100)} ${unitName(unit)} × ${set.reps}`;
export const categoryColor = (id: string) => {
  const hash = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
};
