# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

The four backend API capabilities below are implemented; presentation-tier work remains separate.

- Presentation tier decision: Keep React components responsible for rendering and request state, with typed API calls through the existing shared client. Preserve routing and Bootstrap styling. Each capability must show accessible loading, empty, success, and error states; do not hide request failures behind empty data.
- Logic tier decision: Keep `/api/*` routes thin and implement business rules in the existing service functions. Validate request bodies and references before writes, return deliberate 4xx responses for invalid input or missing records, and forward unexpected errors to the existing error handler. Do not add authentication in this exercise.
- Data tier decision: Add required fields and meaningful value validation to the existing Mongoose schemas, preserving reference types and the default empty team members array. Use the shared database configuration. Preserve the passing seed behavior: stable upserts, no deletion of unrelated records, and reconciliation of a demo user's previous team membership.
- Activity tracking approach: Validate `userId`, `teamId`, a non-empty activity type, and positive finite minutes. Check ID syntax and the existence of both referenced records before creating anything. Store the submitted references, type, and minutes; compute one point per minute and set `occurredAt` on the server. Preserve the `{ activity }` and `{ activities }` response envelopes.
  Activity creation returns `400` for malformed bodies or invalid values and `404` for missing users or teams, without creating reference records. Client-supplied points and timestamps are ignored. Run its contract and additional validation checks with `npm test --prefix octofit-tracker/backend -- tests/api.contract.test.ts tests/activity.validation.test.ts -t 'creates and lists valid activities|activity creation validation'`.
- Team management approach: Validate non-empty name and mascot fields and an optional members array, defaulting to `[]`. Validate member IDs and referenced users before writing. Preserve submitted names, mascots, and member IDs in the `{ team }` and `{ teams }` responses.
  Team creation returns `400` for invalid fields or malformed member IDs and `404` for missing members, without writing a team or creating users. Run its contract with `npm run test:api --prefix octofit-tracker/backend -- -t 'creates teams and exposes members'`; additional validation is covered by `tests/team.validation.test.ts`.
- Leaderboard approach: Aggregate activity points by team and resolve team names, then sort totals descending with a stable team-name tie-breaker. Return `{ leaderboard }` entries containing `teamName`, `totalPoints`, and a 1-based `rank`; return an empty array when there are no scored activities.
  Leaderboard aggregation uses stored activity points, not minutes, across all team members. Equal totals are ordered by team name, then team ID, with sequential ranks. Empty results and tied totals are covered by `tests/leaderboard.test.ts`.
- Workout suggestions approach: Look up the user by the email path parameter and return `404` when absent. Use the most recent recognized activity from the previous 30 days to choose a focus, mapping `run`/`cycle` to endurance and `strength` activity to strength; use the user's fitness goal when there is no recognized recent activity. Ignore future activities and activities belonging to other users. Return matching workouts ordered by title in `{ suggestions }`, with a reason explaining the activity or goal. Return an empty array when no workout matches, rather than an unrelated recommendation. Additional scenarios are covered by `tests/workout.suggestions.test.ts`.

### Smallest safe implementation order

1. Add model validation and rerun the data contract tests, preserving the passing seed test.
2. Implement team creation and activity creation/validation in small steps, checking the corresponding API tests after each change.
3. Implement leaderboard aggregation and personalized workout suggestions, then run the complete API contract suite.
4. Replace frontend placeholders with typed API-backed rendering and accessible request states, checking each capability's component tests.
5. Run both complete test suites and both builds before considering the implementation complete. Keep MongoDB on `27017`, Express on `8000`, and Vite on `5173`.

## Test plan

### Verified red baseline

- Executed `npm ls --prefix octofit-tracker/backend --depth=0` and `npm ls --prefix octofit-tracker/frontend --depth=0`: both exited with code `0`, with no missing dependencies. The installation commands were not rerun during this inspection.
- Executed `npm test --prefix octofit-tracker/backend`: 8 failed and 1 passed across 2 files; exit code `1`.
  - Data contract: 4 failures because required validation is missing for user identity/goals, team name/mascot, activity fields/references, and workout focus/duration/difficulty. The seed idempotency, record preservation, and membership reconciliation test passes.
  - API contract: 4 failures because activity and team creation return `501` instead of rejecting invalid input with `400`, the leaderboard returns no entries instead of ordered totals, and workout suggestions do not match the user's activity pattern or provide the required reason.
- Executed `npm test --prefix octofit-tracker/frontend`: all 15 tests failed; exit code `1`. Placeholder components do not render API data, request user-specific workout suggestions, or expose the required loading, empty, and accessible error states.
- Dependency install-script warnings remain for esbuild and mongodb-memory-server, but both test suites started and completed. These baseline failures are application assertions, not missing-package or test-runner startup errors.

### Validation during implementation

| Scope | Command | Required outcome |
| --- | --- | --- |
| Data tier | `npm run test:data --prefix octofit-tracker/backend` | All 5 tests pass: required schema validation, correct references/defaults, and unchanged safe seed behavior. Covered by the baseline backend run; not yet run separately. |
| Logic tier | `npm run test:api --prefix octofit-tracker/backend` | All 4 tests pass: invalid bodies and malformed/missing references yield 4xx without writes; valid creations preserve fields; totals and ranks match; recommendations are personalized; unknown users yield 4xx. Covered by the baseline backend run; not yet run separately. |
| Presentation tier | `npm test --prefix octofit-tracker/frontend` | All 15 tests pass, including fetched data, the user-specific suggestion URL, and loading/empty/error states for all four routes. |
| Backend regression | `npm test --prefix octofit-tracker/backend` | All 9 tests pass together after implementation. |
| Backend type check | `npm run build --prefix octofit-tracker/backend` | TypeScript check exits with code `0`; not yet run. |
| Frontend build | `npm run build --prefix octofit-tracker/frontend` | TypeScript check and Vite production build exit with code `0`; not yet run. |

Add focused tests alongside the implementation for invalid values, malformed team member IDs, leaderboard ties, and workout goal fallback. Do not weaken existing assertions or substitute unrelated results just to make tests pass. Record subsequent commands and outcomes here as implementation progresses.
