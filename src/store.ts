import { AuthClient } from "@icp-sdk/auth/client";
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import {
  createActor, type Category, type Error_, type Exercise, type HistoryPage,
  type Session, type SessionInput, type Workspace,
} from "./bindings/backend";

const canisterEnv = safeGetCanisterEnv();
const backendId = import.meta.env.VITE_BACKEND_ID || canisterEnv?.["PUBLIC_CANISTER_ID:backend"]
  || "pnbfc-giaaa-aaaac-qhogq-cai";
const localIdentityUrl = import.meta.env.VITE_LOCAL_II_URL;
const { hostname, origin } = window.location;
const isLocalGateway = canisterEnv?.IC_ROOT_KEY
  && (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1");
const agentOptions = {
  rootKey: isLocalGateway ? canisterEnv.IC_ROOT_KEY : undefined,
  // Gateway aliases default to different API hosts. Use the single mainnet endpoint in our CSP.
  host: isLocalGateway ? origin : "https://icp-api.io",
};

export const auth = new AuthClient({
  agentOptions,
  identityProvider: localIdentityUrl ? {
    authorizeUrl: localIdentityUrl,
    canisterId: "rdmx6-jaaaa-aaaaa-aaadq-cai",
  } : undefined,
});

export interface TrainingStore {
  getWorkspace(): Promise<Workspace>;
  getHistory(exerciseId: string | null, before: bigint | null): Promise<HistoryPage>;
  saveCategory(category: Category): Promise<Category>;
  saveExercise(exercise: Exercise): Promise<Exercise>;
  removeCategory(id: string): Promise<unknown>;
  logSession(entry: SessionInput): Promise<Session>;
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
    if (auth.getPrincipal()?.toText() !== principal || identity.getPrincipal().toText() !== principal) {
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
