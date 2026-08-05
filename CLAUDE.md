# CLAUDE.md

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

**Routing** (`src/App.jsx`): a flat `react-router-dom` v6 `<Routes>` list, each top-level route rendering a `*Wrapper` component. Routes are **not** guarded — `AuthContext`'s `user`/`loading` state exists but nothing currently redirects unauthenticated users away from routes like `/dashboard`.

**Page composition pattern**: every feature folder under `src/components/` follows `Wrapper -> AppShell -> Page`:
- `FooWrapper.jsx` wraps `FooPage.jsx` in `AppShell` (see `src/components/dashboard/DashboardWrapper.jsx` for the canonical example).
- `AppShell` (`src/components/layout/AppShell.jsx`) renders the `Sidebar` plus a `<main>` content area, and reads/writes sidebar-open state via `AppStateContext`.
- Follow this same three-file pattern when adding a new top-level route.

**Global state** — two small context providers wrap the whole app in `App.jsx`:
- `AuthContext` (`src/context/AuthContext.jsx`): subscribes to Firebase `onAuthStateChanged`, exposes `{ user, loading }` via `useAuth()`.
- `AppStateContext` (`src/context/AppStateContext.jsx`): a single `useReducer` for cross-cutting UI state — `sidebarOpen` and `activeModal` (`{ type, ...payload }`). Modals across the app (registration, remarks, change-password) are opened by dispatching `OPEN_MODAL` with a `type`, and the owning page conditionally renders the matching modal component based on `state.activeModal?.type`. Follow this pattern (don't introduce local per-component modal-open state) when adding new modals.

**Firebase** (`src/services/firebase.js`): initializes the v9 modular SDK and exports `auth` (Firebase Auth) and `rtdb` (Realtime Database — **not** Firestore; there is no `getFirestore()` call anywhere in this app). Config is currently hardcoded inline (not in an untracked `.env`, even though `.env` is gitignored) — do not add secrets beyond what's already there without checking with the user first. `src/services/auth.js` wraps `signInWithEmailAndPassword`/`signOut`.

**Data is live, backed by the Realtime Database.** Every top-level page (dashboard, payment, search-history, accounts, reports, settings) subscribes to `firebase.js` listeners (`listenToGateLogs`, `listenToRfidUsers`, `listenToPayments`, `listenToAdminProfile`) or the `useEnrichedGateLogs`/`useRfidScanner` hooks — none of them render hardcoded sample arrays anymore. RTDB paths in use: `gateLogs` (RFID scans), `rfidUsers` (registered vehicles/owners), `payments`, `adminProfiles/{uid}` (per-admin profile, keyed by Firebase Auth uid), `settings/app`, `users/system`.

`ProfilePage` falls back to a `localStorage` copy (`igate_admin_profile`) only when there is no authenticated `user` (i.e. the login bypass below) — real logins persist to `adminProfiles/{uid}` in RTDB instead, and the email field becomes read-only in that case since changing it here wouldn't actually update Firebase Auth.

`SettingsPage`'s "Recent Logs" panel merges real RTDB gate-scan history (via `useEnrichedGateLogs`) with locally-generated session events (gate toggle clicks, login) — the gate open/close buttons themselves are still local-only UI state, not wired to any hardware/RTDB command path.

There is no Firestore usage or `firebase.json`/RTDB security-rules file checked into this repo — rules are managed directly in the Firebase console.

**Remarks feature**: `useRemarks` (`src/hooks/useRemarks.js`) persists free-text remarks per RFID to `localStorage` (key `igate_user_remarks`), not Firestore. Used by the dashboard and search-history activity tables together with `RemarkModal` and the `RemarkAddButton`/`RemarkTick` components in `src/components/shared/RemarkBadge.jsx`.

**Styling**: one global stylesheet, `src/index.css` (~1900 lines), using plain class names (no CSS modules/Tailwind/styled-components). Match existing class-naming conventions (e.g. `dashboard-*`, `payment-*`, `activity-*`) when styling new UI rather than introducing a new styling approach.

## Known issue to be aware of

`src/components/auth/LoginForm.jsx` contains a hardcoded credential bypass (`admin@bulsu.edu.ph` / `123456` skips Firebase auth entirely and navigates straight to `/dashboard`). Do not extend or rely on this bypass in new work, and flag it to the user if it becomes relevant — it looks like leftover dev/demo scaffolding rather than intended behavior. Note this also means `auth.currentUser` is `null` after a bypass login, so any feature requiring a real signed-in user (e.g. `ChangePasswordModal`, `ProfilePage`'s RTDB-backed profile) will fall back to an error state or `localStorage`, not real Firebase behavior — test those with a real Firebase Auth account.

`ChangePasswordModal` (`src/components/modals/ChangePasswordModal.jsx`) reauthenticates with the current password via `reauthenticateWithCredential`/`EmailAuthProvider` before calling `updatePassword` — both from `firebase/auth`, using `auth.currentUser`. It shows a friendly error if there's no real signed-in user.
