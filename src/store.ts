import { AuthClient } from "@icp-sdk/auth/client";
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import {
  createActor, Unit, type Category, type Entry, type Error_, type Exercise, type HistoryPage,
  type Session, type Workspace,
} from "./bindings/backend";

const canisterEnv = safeGetCanisterEnv();
const backendId = import.meta.env.VITE_BACKEND_ID || canisterEnv?.["PUBLIC_CANISTER_ID:backend"]
  || "pnbfc-giaaa-aaaac-qhogq-cai";
const localIdentityUrl = import.meta.env.VITE_LOCAL_II_URL;
const agentOptions = { rootKey: canisterEnv?.IC_ROOT_KEY };

export const auth = new AuthClient(localIdentityUrl ? {
  agentOptions,
  identityProvider: {
    authorizeUrl: localIdentityUrl,
    canisterId: "rdmx6-jaaaa-aaaaa-aaadq-cai",
  },
} : undefined);

export interface TrainingStore {
  getWorkspace(): Promise<Workspace>;
  getHistory(exerciseId: string | null, before: bigint | null): Promise<HistoryPage>;
  saveCategory(category: Category): Promise<Category>;
  saveExercise(exercise: Exercise): Promise<Exercise>;
  removeCategory(id: string): Promise<unknown>;
  logSession(entry: Entry): Promise<Session>;
}

class TrainingError extends Error {
  constructor(readonly code: Error_["__kind__"], message: string) {
    super(message);
  }
}

function unwrap<T>(result: { __kind__: "ok"; ok: T } | { __kind__: "err"; err: Error_ }): T {
  if (result.__kind__ === "ok") return result.ok;
  const error = result.err;
  switch (error.__kind__) {
    case "invalidInput":
      throw new TrainingError(error.__kind__, error.invalidInput);
    case "limitReached":
      throw new TrainingError(error.__kind__, error.limitReached);
    case "unauthorized":
      throw new TrainingError(error.__kind__, "Your session ended. Sign in again to continue.");
    case "notFound":
      throw new TrainingError(error.__kind__, "That exercise or category is unavailable. Refresh and try again.");
    case "conflict":
      throw new TrainingError(error.__kind__, "This draft was already saved with different values. Check History and clear the draft before logging another session.");
  }
}

export function errorMessage(error: unknown) {
  return error instanceof TrainingError ? error.message : "Couldn’t reach the workout log. Try again.";
}

export function authenticatedStore(principal: string): TrainingStore {
  let previousIdentity: Awaited<ReturnType<typeof auth.getIdentity>> | undefined;
  let actor: ReturnType<typeof createActor>;
  const getActor = async () => {
    const identity = await auth.getIdentity();
    if (identity.getPrincipal().toText() !== principal) {
      throw new TrainingError("unauthorized", "Your session changed. Sign in again to continue.");
    }
    if (identity !== previousIdentity) {
      actor = createActor(backendId, { agentOptions: { ...agentOptions, identity } });
      previousIdentity = identity;
    }
    return actor;
  };

  return {
    getWorkspace: async () => unwrap(await (await getActor()).getWorkspace()),
    getHistory: async (exerciseId, before) => unwrap(await (await getActor()).getHistory(exerciseId, before)),
    saveCategory: async (category) => unwrap(await (await getActor()).saveCategory(category)),
    saveExercise: async (exercise) => unwrap(await (await getActor()).saveExercise(exercise)),
    removeCategory: async (id) => unwrap(await (await getActor()).removeCategory(id)),
    logSession: async (entry) => unwrap(await (await getActor()).logSession(entry)),
  };
}

export function createDemoStore(): TrainingStore {
  let categories: Category[] = [
    { id: "demo-chest", name: "Chest" },
    { id: "demo-back", name: "Back" },
    { id: "demo-legs", name: "Legs" },
    { id: "demo-arms", name: "Arms" },
  ];
  let exercises: Exercise[] = [
    { id: "demo-bench", name: "Barbell bench press", categoryIds: ["demo-chest"] },
    { id: "demo-lat-pulldown", name: "Lat pulldown", categoryIds: ["demo-back", "demo-arms"] },
    { id: "demo-row", name: "Seated cable row", categoryIds: ["demo-back"] },
    { id: "demo-squat", name: "Back squat", categoryIds: ["demo-legs"] },
    { id: "demo-curl", name: "Dumbbell curl", categoryIds: ["demo-arms"] },
  ];

  const sample = (exerciseId: string, daysAgo: number, weights: number[]): Session => ({
    loggedAt: BigInt(Date.now() - daysAgo * 86_400_000) * 1_000_000n,
    entry: {
      id: `${exerciseId}-${daysAgo}`, exerciseId, unit: Unit.lb, notes: "",
      sets: weights.map((weight, slot) => ({
        slot, weight: weight * 100, reps: [12, 8, 7, 6, 15][slot], restSeconds: [60, 90, 90, 120, undefined][slot],
      })),
    },
  });
  const sessions = [
    sample("demo-bench", 12, [65, 125, 125, 130, 85]),
    sample("demo-squat", 9, [95, 175, 185, 185, 115]),
    sample("demo-row", 6, [60, 105, 105, 110, 65]),
    sample("demo-lat-pulldown", 6, [55, 100, 100, 105, 65]),
    sample("demo-bench", 5, [75, 130, 135, 135, 90]),
    sample("demo-curl", 4, [10, 25, 25, 25, 15]),
    sample("demo-squat", 3, [95, 185, 195, 195, 125]),
    sample("demo-bench", 2, [75, 135, 135, 140, 95]),
  ];

  const replace = <T extends { id: string }>(list: T[], item: T) => {
    const updated = list.some(({ id }) => id === item.id);
    return updated ? list.map((current) => current.id === item.id ? item : current) : [...list, item];
  };

  const checkName = (items: Category[], item: Category) => {
    if (items.some(({ id, name }) => id !== item.id && name.toLowerCase() === item.name.toLowerCase())) {
      throw new TrainingError("invalidInput", "That name is already in use.");
    }
  };

  return {
    async getWorkspace() {
      return {
        categories,
        exercises: exercises.map((exercise) => {
          const entries = sessions.filter(({ entry }) => entry.exerciseId === exercise.id);
          return { exercise, latest: entries.at(-1), sessionCount: BigInt(entries.length) };
        }),
        sessionCount: BigInt(sessions.length),
      };
    },
    async getHistory(exerciseId, before) {
      const entries = exerciseId ? sessions.filter(({ entry }) => entry.exerciseId === exerciseId) : sessions;
      const end = before === null ? entries.length : Math.min(Number(before), entries.length);
      const start = Math.max(0, end - 20);
      return { sessions: entries.slice(start, end).reverse(), before: start ? BigInt(start) : undefined };
    },
    async saveCategory(category) {
      checkName(categories, category);
      categories = replace(categories, category);
      return category;
    },
    async saveExercise(exercise) {
      checkName(exercises, exercise);
      exercises = replace(exercises, exercise);
      return exercise;
    },
    async removeCategory(id) {
      categories = categories.filter((category) => category.id !== id);
      exercises = exercises.map((exercise) => ({ ...exercise, categoryIds: exercise.categoryIds.filter((tag) => tag !== id) }));
    },
    async logSession(entry) {
      const existing = sessions.find((session) => session.entry.id === entry.id);
      if (existing) return existing;
      const session = { entry, loggedAt: BigInt(Date.now()) * 1_000_000n };
      sessions.push(session);
      return session;
    },
  };
}
