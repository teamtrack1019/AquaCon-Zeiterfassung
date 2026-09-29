# AquaCon Zeiterfassung

Next.js time-tracking app for AquaCon (worker + admin), backed by **Firebase Firestore**.

## Local development

```bash
npm install
cp .env.example .env
# fill Firebase + NextAuth + ADMIN_* vars
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Workers log in with credentials created by Admin.
- Admin logs in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` (bootstrapped on first login or via seed).

## Firebase setup

1. Create a Firebase project (or reuse an existing one).
2. Enable **Firestore** (Native mode).
3. Project settings → Service accounts → **Generate new private key**.
4. Put the JSON into `FIREBASE_SERVICE_ACCOUNT_JSON` (escape newlines as `\n` on Vercel).
5. Rules: keep Firestore locked to Admin SDK only (default deny for clients is fine — this app talks to Firestore only from the server).

### Optional: migrate old Postgres data

If you still have the previous Postgres database:

```bash
# .env must include DATABASE_URL/DIRECT_URL + Firebase vars
npm run db:migrate
```

## Vercel production

1. Import this repo in Vercel.
2. Set environment variables (Production):
   - `FIREBASE_SERVICE_ACCOUNT_JSON`
   - `NEXTAUTH_URL` (e.g. `https://your-app.vercel.app`)
   - `NEXTAUTH_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
3. Remove old `DATABASE_URL` / `DIRECT_URL` if present (no longer used by the app).
4. Deploy. On first login, Admin is created from `ADMIN_*` if missing.
5. Create workers from the Admin panel.

## Auth notes

- No open self-registration on the login form.
- Passwords are stored with bcrypt in Firestore.
- Legacy plaintext passwords are upgraded automatically after a successful login.
