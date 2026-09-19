# Ziyar Majlis — Restaurant Dashboard

Internal management dashboard for the Ziyar Majlis restaurant. Built as a
full-stack **Next.js** app (App Router) with a **MongoDB / Mongoose** backend —
i.e. the MERN stack with Next.js providing both the React frontend and the
Node/Express-style API layer (via Next.js API routes). Fully mobile-friendly.

## Tech stack

- **Next.js 14** (App Router, TypeScript)
- **React 18**
- **MongoDB Atlas** via **Mongoose**
- **Tailwind CSS** (responsive, mobile-first)
- **jose** for JWT session cookies (Edge-compatible auth)

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables in `.env.local` (already scaffolded):

   ```bash
   MONGODB_URI=          # <-- paste your MongoDB Atlas connection string here
   ADMIN_EMAIL=ziyarmajlis@gmail.com
   ADMIN_PASSWORD=Admin@Ziyar
   JWT_SECRET=change_this_to_a_long_random_secret_string
   ```

   > The app runs without a database connected — the dashboard shows sample data
   > and a "Database not connected" notice. Add `MONGODB_URI` when ready.

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 — you'll be redirected to `/login`.

## Login

Use the admin credentials from `.env.local`:

- **Email:** `ziyarmajlis@gmail.com`
- **Password:** `Admin@Ziyar`

## Project structure

```
app/
  api/auth/            Login & logout API routes
  dashboard/           Protected dashboard (overview + sections)
  login/               Login page
  layout.tsx           Root layout
components/
  DashboardShell.tsx   Responsive sidebar + topbar (mobile drawer)
  ui.tsx               Reusable Card / StatCard / placeholder components
lib/
  auth.ts              JWT session + credential helpers
  mongodb.ts           Cached Mongoose connection
  nav.ts               Sidebar navigation config
middleware.ts          Route protection (redirects to /login)
```

## Dashboard sections

Overview · Orders · Menu · Reservations · Staff · Inventory · Settings

The Overview page is functional; the section pages are scaffolded placeholders
ready to be wired to MongoDB collections as features are built out.

## Notes

- Auth is intentionally simple: a single admin defined by environment
  variables, with a signed httpOnly session cookie. When you add multi-user
  support later, move users into a MongoDB collection and hash passwords.
