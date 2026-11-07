# Gym Assistant

Gym Assistant is a strength-training journal on the Internet Computer. Open an exercise to see the weight, reps, and recorded rest for every set in its last session, then log today's work beside it.

- Log a warm-up, three heavy sets, and a burnout. Save the sets you completed, including zero-weight bodyweight sets.
- Reuse the previous session's numbers, switch between pounds and kilograms per session, run a rest countdown, and record notes or actual rest in seconds.
- Create and rename categories, and assign one exercise to any number of them. Removing a category keeps its exercises and history.
- Filter session history by exercise. Sign in with Internet Identity to sync your log across devices. The demo workspace uses temporary sample data.

## Run locally

Install Node.js 22.12 or later. The project pins the ICP CLI and Mops through npm.

```sh
npm ci
npm exec -- icp network start -d
VITE_LOCAL_II_URL=http://id.ai.localhost:8000/authorize npm exec -- icp deploy
```

Open the frontend URL printed by the CLI. A fresh local network uses a local Internet Identity instance. For UI-only work, run `npm run bindings` and `npm run dev`, then use the demo workspace.

Run `npm run build` to generate Candid bindings, type-check TypeScript, and build the frontend. Run `npm exec -- mops check` to check the Motoko backend. After changing the backend interface, regenerate its Candid with `npm exec -- mops generate candid`.

## Deploy to mainnet

The frontend is hosted at the first URL below once the assets have been uploaded.

| Canister | ID |
| --- | --- |
| [Frontend](https://qrnfr-liaaa-aaaah-arh3a-cai.icp.net) | `qrnfr-liaaa-aaaah-arh3a-cai` |
| Backend | `pnbfc-giaaa-aaaac-qhogq-cai` |

Use a backend controller for the backend deployment and a frontend controller or an identity with the frontend asset canister's `Commit` permission for the asset sync.

```sh
npm ci
npm exec -- icp canister link backend pnbfc-giaaa-aaaac-qhogq-cai -e ic
npm exec -- icp canister link frontend qrnfr-liaaa-aaaah-arh3a-cai -e ic
npm exec -- icp deploy backend -e ic --no-create
npm run build
npm exec -- icp sync frontend -e ic
```

The frontend command syncs assets to the existing legacy asset canister. Run the mainnet frontend build without `VITE_LOCAL_II_URL` so it uses mainnet Internet Identity.

## Data and authentication

The Motoko backend keys all categories, exercises, and sessions by the authenticated caller principal. Reads and writes reject anonymous callers. Session writes use a client-generated ID so repeating the same request returns the saved session. The Motoko migration chain preserves account data during upgrades. Signed-in drafts are stored locally in the browser until a session is saved.

The project uses the [official ICP skills](https://skills.internetcomputer.org/llms.txt) on demand.
