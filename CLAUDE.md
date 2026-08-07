# iGATE Capstone Project (SKUL JUAN) - System Architecture & AI Guidelines

## 1. Safety Guardrails & Logic Preservation (Strict)
- **UI vs. Logic Isolation:** Never remove, refactor, or simplify existing state hooks (`useState`, `useEffect`), Firebase RTDB listeners, or business logic when performing UI/layout updates. Always preserve non-UI code line-for-line.
- **Strict Modification Constraint:** You are strictly forbidden from modifying state management, backend logic, or hardware handlers unless the prompt explicitly requests a logic change.

## 2. Architecture & Clean Code Rules (Anti-"Vibe Code")
- **Layered Architecture:** Keep UI components strictly for rendering layout. Abstract all Firebase operations and business logic into dedicated Custom Hooks (`/src/hooks`) or Service Classes (`/src/services`).
- **DRY Principle (Don't Repeat Yourself):** Avoid redundant inline code or duplicate UI elements. Reuse base components (e.g., Modals, Tables, Stat Cards) via generic props instead of creating single-use components.
- **Single Responsibility:** Each file must do ONE thing well. UI handles presentation; Hooks handle state/events; Services handle Firebase/hardware communications.

## 3. Communication & Code Quality Guidelines
- **Smarter & Direct Responses:** Skip unnecessary pleasantries or fluff. Provide concise explanations and direct, precise code edits.
- **Git Milestones:** Suggest clean git commits after achieving major, stable functional milestones.

---

# CLAUDE.md (Original Repository Context & Architecture)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

iGate - a vehicle gate access & tracking system for Bulacan State University (Bustos Campus). React SPA (Vite) with Firebase (Auth + Realtime Database) as the backend. Staff log in and manage gate access logs, vehicle/account registration, payments, reports, and RFID-based entry/exit records.

## Commands

```bash
npm install     # install dependencies
npm run dev     # start Vite dev server
npm run build   # production build
npm run serve   # preview the production build
```

There is no lint script, no test runner, and no test files in this repo currently.

## Architecture

**Routing** (`src/App.jsx`): `react-router-dom` v6 nested routes, each top-level route rendering a `*Wrapper` component. `/login` is public; every other route is nested under `<RequireAuth />` (`src/components/auth/RequireAuth.jsx`), which redirects to `/login` if `AuthContext`'s `user` is null. `/account-management` and `/settings` are additionally nested under `<RequireRole allowedRoles={ADMIN_ROLES} />` (`src/components/auth/RequireRole.jsx`), which redirects non-admins to `/dashboard`. `ADMIN_ROLES` and the full `ROLES` list live in `src/constants/roles.js` — currently `Super Admin`, `Administrator`, `Security Guard` (no `Staff` login role; don't reintroduce it). `Sidebar` (`src/components/sidebar/Sidebar.jsx`) filters nav items by the same `roles` list so guarded pages aren't shown as dead links.

**Page composition pattern**: every feature folder under `src/components/` follows `Wrapper -> AppShell -> Page`:
- `FooWrapper.jsx` wraps `FooPage.jsx` in `AppShell` (see `src/components/dashboard/DashboardWrapper.jsx` for the canonical example).
- `AppShell` (`src/components/layout/AppShell.jsx`) renders the `Sidebar` plus a `<main>` content area, and reads/writes sidebar-open state via `AppStateContext`.
- Follow this same three-file pattern when adding a new top-level route.

**Global state** — two small context providers wrap the whole app in `App.jsx`:
- `AuthContext` (`src/context/AuthContext.jsx`): subscribes to Firebase `onAuthStateChanged`, then subscribes to `adminProfiles/{uid}` for the signed-in user's `role`, exposing `{ user, role, loading }` via `useAuth()`. `loading` stays true until both the auth state *and* the role fetch have resolved, so route guards don't flash the wrong content mid-login.
- `AppStateContext` (`src/context/AppStateContext.jsx`): a single `useReducer` for cross-cutting UI state — `sidebarOpen` and `activeModal` (`{ type, ...payload }`). Some modals (Payment's `RegistrationModal`, `RemarkModal`) are opened via `dispatch({ type: 'OPEN_MODAL', ... })` and rendered off `state.activeModal?.type` — prefer this for anything cross-cutting. In practice it's not universal: `RegisterRfidModal` (Dashboard), and `EditRfidUserModal`/`ConfirmModal` (Account Management) use plain local `useState` instead, since they're single-page-scoped and don't need to be reachable from elsewhere. Match whichever pattern the modal you're touching already uses rather than assuming one is canonical.

**Firebase** (`src/services/firebase.js`): initializes the v9 modular SDK and exports `auth` (Firebase Auth) and `rtdb` (Realtime Database — **not** Firestore; there is no `getFirestore()` call anywhere in this app). Config is currently hardcoded inline (not in an untracked `.env`, even though `.env` is gitignored) — do not add secrets beyond what's already there without checking with the user first. `src/services/auth.js` wraps `signInWithEmailAndPassword`/`signOut`.

**Data is live, backed by the Realtime Database.** Every top-level page (dashboard, payment, search-history, accounts, reports, settings) subscribes to `firebase.js` listeners (`listenToGateLogs`, `listenToRfidUsers`, `listenToPayments`, `listenToAdminProfile`) or the `useEnrichedGateLogs`/`useRfidScanner` hooks — none of them render hardcoded sample arrays anymore. RTDB paths in use: `gateLogs` (RFID scans), `rfidUsers` (registered vehicles/owners), `payments`, `adminProfiles/{uid}` (per-admin profile, keyed by Firebase Auth uid), `settings/app`, `users/system`.

`ProfilePage` falls back to a `localStorage` copy (`igate_admin_profile`) only when there is no authenticated `user` — every real login persists to `adminProfiles/{uid}` in RTDB instead, and the email field becomes read-only in that case since changing it here wouldn't actually update Firebase Auth.

`SettingsPage`'s "Recent Logs" panel merges real RTDB gate-scan history (via `useEnrichedGateLogs`) with locally-generated session events (gate toggle clicks, login) — the gate open/close buttons themselves are still local-only UI state, not wired to any hardware/RTDB command path.

There is no Firestore usage anywhere in this app. RTDB security rules **are** version-controlled: `database.rules.json` (repo root) is the source of truth, deployed to the Firebase console's Rules tab — `firebase.json` points the Firebase CLI at it for `firebase deploy --only database`. Rules require `auth != null` on every path, scope `adminProfiles/{uid}` to its own owner, and structurally validate writes to match the shapes in `src/models/`. Changing a write shape in `src/services/firebase.js` without updating both the matching `src/models/*.js` validator and `database.rules.json` will make writes fail silently against real rules even though local dev (which uses the same rules) may still pass if you haven't deployed the latest rules yet.

**Data models** (`src/models/*.js`): one file per RTDB entity (`gateLog`, `rfidUser`, `payment`, `adminProfile`, `appSettings`, `systemUser`), each exporting a JSDoc `@typedef` and a `validate*()` function that normalizes and throws on invalid shape. Every write in `src/services/firebase.js` runs its payload through the matching validator before `set()`/`push()`. This is plain-JS runtime validation, not TypeScript — the repo has no TS toolchain, don't introduce one for this without asking. `rfidUser`'s `role` field (Student/Faculty/Staff/Visitor — the vehicle owner's category) is unrelated to the admin login `role` in `src/constants/roles.js`; don't conflate the two. `rfidUser` also has `email` (optional, format-checked) and `status` (`Active`/`Inactive`, default `Active`) — format/enum patterns live in `src/utils/validators.js` (`isValidRfid`, `isValidPlate`, `isValidEmail`) and are shared between the model validators and every registration/edit form's inline field checks, so the two never drift apart.

**RFID user CRUD** (`src/services/firebase.js`): `registerRfidUser` (strict-create, throws on duplicate RFID — used by the Dashboard's "Register RFID" button) and `upsertRfidUser` (create-or-renew, never throws on an existing RFID — used by the Payment registration/renewal flow) are both open to any authenticated role, since Security Guards legitimately create/renew via those two entry points. `updateRfidUser` (full-field edit, Account Management's Edit modal), `deleteRfidUser`, and `setRfidUserStatus` (deactivate/reactivate) are the three actions gated to `ADMIN_ROLES` — enforced at the route level (`/account-management` is already admin-only) *and*, for delete/status specifically, at the RTDB rules level too (see below), because those two are meaningfully distinguishable from a guard's create/renew at the rules layer in a way a generic "edit" isn't.

**Why `database.rules.json`'s `rfidUsers` write rule looks the way it does**: RTDB rules see only the resulting data diff, not which UI screen or business operation produced it — so "Account Management edit" and "Payment renewal" are indistinguishable from the rules' point of view when both do a `set()` on an existing record. The rule therefore allows any authenticated role to create-or-update a record (`newData.exists()`), but requires `Super Admin`/`Administrator` when the write is a delete (`!newData.exists()`). The `status` child has its own `.validate` requiring the value be unchanged (fine for a guard's renewal `set()`, which resends the same status) or the actor already be an admin — this is what actually makes deactivate/reactivate admin-only, since the outer `.write` rule alone can't express it. If you touch this rule, keep both branches in mind or you'll either lock guards out of registration or let them silently deactivate accounts.

**Hardware note**: the physical RFID reader (`sketch_scanner.ino`, ESP32) POSTs directly to `gateLogs` over the RTDB REST API using a legacy database secret (`FIREBASE_AUTH` in the sketch), not Firebase Auth — a valid secret bypasses `database.rules.json` entirely, so the `auth != null` rule on `gateLogs` does not affect it. If `FIREBASE_AUTH` is ever blank in the sketch, the scanner depends on the rules being fully public and will silently stop logging scans the moment `database.rules.json` is deployed. A raw `gateLogs` entry only ever has `cardId`/`cardHex`/`direction`/`timestamp` (that's all the hardware knows) — never assume it carries `name`/`plateNumber`/etc. directly; always go through `useEnrichedGateLogs` (`src/hooks/useEnrichedGateLogs.js`), which joins each scan against `rfidUsers` by normalized `cardId`/`cardHex`, to get those fields.

**Live dashboard metrics** (`src/hooks/useGateStats.js`): computes `totalRegisteredVehicles` (active `rfidUsers` count), `vehiclesInsideCampus`, `todaysEntries`, `todaysExits` from the full `gateLogs` + `rfidUsers` listeners — rendered by `StatsCards`. "Inside campus" requires finding each card's single most recent scan across the *entire* history (a `Map` keyed by normalized `cardId`/`cardHex`, keeping whichever entry has the latest `timestamp`), so it can't be derived from a single new event — that's why this hook uses the full-history `listenToGateLogs` (`onValue`), not the event-stream one below.

**Hardware-ready live feed** (`listenToNewGateLogs` in `src/services/firebase.js`): uses RTDB's `onChildAdded` instead of `onValue` — the same event type a real ESP32 write triggers — filtered to entries timestamped after the listener attached (so the initial backlog burst `onChildAdded` always sends on mount isn't treated as "new"). Currently drives the "just scanned" row flash in `RecentActivityTable` and the "last scan received" live timestamp on `DashboardPage`; reach for this (not `listenToGateLogs`) for anything that should react to a single new scan as it happens rather than the whole list.

**Simulating hardware without physical scanner present**: `SimulateScanModal` (`src/components/dashboard/SimulateScanModal.jsx`, admin-only, triggered from `DashboardPage`) calls `logGateEntry` — the exact same function/validation path (`validateGateLog`) a real hardware-authenticated write would eventually reuse if the ESP32 ever posts through the app instead of raw REST. Useful for exercising the live dashboard/stats during development.

**Remarks feature**: `useRemarks` (`src/hooks/useRemarks.js`) persists free-text remarks per RFID to `localStorage` (key `igate_user_remarks`), not Firestore. Used by the dashboard and search-history activity tables together with `RemarkModal` and the `RemarkAddButton`/`RemarkTick` components in `src/components/shared/RemarkBadge.jsx`. Note the keying isn't consistent: `RecentActivityTable` keys remarks off the gate-log entry's own id (per scan event), while `SearchHistoryPage` keys off `person.rfidId` (per person) — this predates Phase 4 and wasn't changed, just preserved as-is.

**`SearchHistoryPage.jsx` has two independent sections**: the original single-person lookup (search by Plate/RFID/Name → one matched `rfidUsers` record + their own scan history) is unchanged, and a second "All Entry & Exit Logs" section below it is a general filterable/sortable/paginated table over every `useEnrichedGateLogs()` entry (date range, vehicle type, RFID, driver name filters; click `Time`/`Name` headers to sort; CSV via `src/utils/csv.js#downloadCsv` — no library, a hand-rolled `Blob` download — and PDF via `window.print()`, matching the same pattern `PaymentPage`/`ReportsPage` already use). `ReportsPage.jsx` has a similar-looking filter/table of its own that predates this — the two overlap in purpose but haven't been consolidated; don't assume one supersedes the other without asking.

**Barrier gate control** (`src/components/dashboard/GateStatusCard.jsx`, Phase 6): shows a live OPEN/CLOSED/UNKNOWN badge for the physical gate and, for any of the three staff roles (`ROLES`, not `ADMIN_ROLES` — Security Guards need this too, and it's on the Dashboard rather than System Settings specifically because `/settings` is admin-only), a manual override button (reusing `GateButton`, the same component `SettingsPage`'s local-only toggle uses) that goes through a `ConfirmModal` before writing. State lives at `settings/app/gateStatus` (`{ state, updatedAt, updatedBy, updatedByName }`, `src/models/appSettings.js#validateGateStatus`), written via `setGateStatus`/read via `listenToGateStatus` in `services/firebase.js` — always as a targeted leaf write, never through `validateAppSettings`/`initializeFirebaseCollections`, so a gate toggle can never clobber `appName`/`campus`/etc., and the once-per-app-mount `initializeFirebaseCollections()` call can never stomp a live gate state back to a default. A physical ESP32 relay controller is expected to read (and eventually write) this same path the way `sketch_scanner.ino` already reads/writes `gateLogs` today — over the RTDB REST API using a legacy database secret that bypasses `database.rules.json` entirely (see the hardware note below) — so no relay firmware exists in this repo yet and no rule was added to make the node publicly readable; `database.rules.json` only adds a `.validate` on `gateStatus` for shape (`state` must be `OPEN`/`CLOSED`, `updatedAt` a number).

**`StatsCards.jsx`** was rebuilt in Phase 4 to show exactly `Total Registered Vehicles` / `Vehicles Inside Campus` / `Today's Entries` / `Today's Exits` (via `useGateStats`), replacing an earlier Car/Students/Faculty/Motorcycles/Total breakdown sourced from `rfidUsers`. That breakdown is gone, not hidden — if it's still wanted, it needs to be re-added as a separate component rather than assumed to still exist.

**Styling**: one global stylesheet, `src/index.css` (~1900 lines), using plain class names (no CSS modules/Tailwind/styled-components). Match existing class-naming conventions (e.g. `dashboard-*`, `payment-*`, `activity-*`) when styling new UI rather than introducing a new styling approach.

## Known issues to be aware of

There is no working sign-up flow — `LoginForm.jsx` has a "Sign-up" link to `/signup`, but no such route/component exists. New admin accounts must currently be created directly in the Firebase Auth console.

Assigning a *different* user's role (e.g. a Super Admin promoting a Security Guard to Administrator) has no UI anywhere in the app — `database.rules.json` only allows a user to write their own `adminProfiles/{uid}`, and only when their own current role is already `Super Admin` (or the profile doesn't exist yet, to bootstrap the very first login). Cross-user role assignment today means editing `adminProfiles/{otherUid}/role` directly in the Firebase console. Building an in-app user-management screen for this is a natural next step but out of scope until asked for.

Because `System Settings` is now Super-Admin/Administrator-only (`ADMIN_ROLES` in `src/constants/roles.js`), and "My Profile" / "Change Password" are only linked to from `SettingsPage`, a Security Guard currently has no in-app way to reach `/profile` or open `ChangePasswordModal` even though the `/profile` route itself has no role restriction. If this needs fixing, it means adding a role-independent entry point to those (e.g. in `AppShell` or the top bar), not loosening the `/settings` guard.

`ChangePasswordModal` (`src/components/modals/ChangePasswordModal.jsx`) reauthenticates with the current password via `reauthenticateWithCredential`/`EmailAuthProvider` before calling `updatePassword` — both from `firebase/auth`, using `auth.currentUser`. It shows a friendly error if there's no real signed-in user (this used to matter for the login bypass; the bypass has since been removed, so `auth.currentUser` should always be real now for anyone who successfully reaches an authenticated route).