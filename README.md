# AquaCon Zeiterfassung

Next.js time-tracking app for AquaCon (worker + admin).

## Local development

```bash
npm install
cp .env.example .env
# fill DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, ADMIN_*
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Workers log in with credentials created by Admin.
- Admin logs in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` (bootstrapped on first login or via seed).

## Vercel production

1. Import this repo in Vercel.
2. Set environment variables (Production):
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXTAUTH_URL` (e.g. `https://your-app.vercel.app`)
   - `NEXTAUTH_SECRET` (`openssl rand -base64 32`)
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
3. Deploy. On first login, Admin is created from `ADMIN_*` if missing.
4. Create workers from the Admin panel — they use their own logins.

Database stays Postgres for now; Firebase migration is planned later.

## Auth notes

- No open self-registration on the login form.
- Passwords are stored with bcrypt.
- Legacy plaintext passwords are upgraded automatically after a successful login.
