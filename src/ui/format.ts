import type { LiftSet, Session, Unit } from "../bindings/backend";

export const SET_NAMES = ["Warm-up", "Heavy 1", "Heavy 2", "Heavy 3", "Burnout"] as const;
export const SET_MARKS = ["W", "1", "2", "3", "B"] as const;
export const CATEGORY_COLORS = ["sage", "plum", "amber", "sky", "coral"] as const;

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
