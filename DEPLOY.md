# Deploying to Vercel with a Neon database

This puts your tracker on a real URL with **accounts and one database as the single
source of truth**. You sign in with a username and password; every device signed into
the same account reads and writes the same row, so there is nothing to sync, no sync
codes, and no "which copy is right?" — whatever you change is what every device sees.

Both are free: Vercel's Hobby plan and Neon's free tier.

---

## How it works

```
   phone  ─┐   sign in    ┌─►  /api/auth   (accounts + sessions)
            ├─►  your-app.vercel.app                              ─►  Neon Postgres
   laptop ─┘               └─►  /api/state  (your account's row)
```

* `index.html` is served as a static page.
* `api/auth.js` handles **sign up / sign in / sign out** — passwords are stored as
  salted scrypt hashes, and the session lives in an httpOnly cookie for a year.
* `api/state.js` reads and writes **your account's row**, and only saves if nobody
  else saved since you last read — a simultaneous save from another device is
  rejected and reloaded instead of silently overwritten.

---

## Step 1 — Import the repo into Vercel (3 minutes)

1. Go to **[vercel.com](https://vercel.com)** and sign in with GitHub.
2. **Add New… → Project**, then **Import** `prashanthimudepaka/consistency-tracker`.
3. Leave the build settings alone:
   * Framework Preset: **Other**
   * Build Command: *(empty)*
   * Output Directory: *(empty)*
4. Press **Deploy** and wait for it to finish.

You'll get a URL like `https://consistency-tracker-xxxx.vercel.app`.
The page will say the database isn't configured yet — that's Step 2.

## Step 2 — Add the Neon database from inside Vercel (2 minutes)

1. In your Vercel project, open the **Storage** tab.
2. **Create Database → Neon** (Postgres). Accept the defaults; pick the region
   closest to you. This creates the Neon database **and** sets `DATABASE_URL`
   on the project automatically — no connection strings to copy.
3. Environment variables only take effect on a new deployment:
   **Deployments → ⋯ on the latest → Redeploy**.

That's the whole setup. The tables create themselves on first use.

## Step 3 — Create your account

Open your Vercel URL. You'll see the sign-in screen:

1. Press **New here? Create an account**.
2. Pick a username (3–32 characters, letters/numbers/dots/dashes/underscores)
   and a password of at least 6 characters. Usernames are not case-sensitive.
3. Press **Create account** — you're in, and you stay signed in on that device.

## Step 4 — Move your existing data across (important, do this first)

Your current data lives in the browser storage of the **GitHub Pages** site. The
Vercel site is a different address, so your account starts out with this page's
sample data. Move the real data before you open the new URL anywhere else:

1. On the device that has your real data, open the **old** site
   (`prashanthimudepaka.github.io/consistency-tracker`) and press **⬇ Backup**.
   A `.json` file downloads.
2. Open your **new Vercel URL**, sign in, and press **⬆ Restore** — choose the
   file you just downloaded.
3. The save line says **Saved ☁**. Your data is now in the database.

## Step 5 — Add your other devices

On each device: open the Vercel URL, sign in with the **same username and
password**, done. It pulls everything from your account immediately.

On a phone, add it to the home screen so it opens like an app:
* **Android / Chrome:** ⋮ → *Add to Home screen*
* **iPhone / Safari:** Share → *Add to Home Screen*

---

## What you'll see

| Indicator | Meaning |
|---|---|
| **☁ yourname** | Signed in. Every change saves straight to your account. |
| **Saved ☁** | That change is in the database. |
| **☁ Offline** | No connection. Changes are kept on the device and upload when you're back. |
| **☁ Locked** | Signed out or session expired — the sign-in screen is showing. |
| **☁ Setup** | The database isn't connected yet — the message tells you what's missing. |

Changes appear on your other devices when they next check: every 20 seconds while
open, and instantly when you switch back to the tab or reopen the app.

Pressing the **☁ yourname** button shows who is signed in and offers **sign out**.

---

## Things worth knowing

* **The old sites keep working.** GitHub Pages and the claude.ai artifact are untouched
  and keep their own separate copies (the sign-in screen never appears there). Once
  you're on Vercel, use the Vercel URL for everything and treat the others as archives.
* **Each account is separate.** If someone else creates an account on your URL, they
  get their own empty tracker — they can't see yours. Note: a brand-new account created
  in a browser that already has tracker data adopts that browser's local data as its
  starting point (that's what makes migration effortless).
* **Passwords can't be recovered** — there's no email reset. If you forget it, the data
  is still in Neon; you'd delete your row's user in the Neon console or ask Claude to
  add a reset. So pick something you'll remember.
* **Simultaneous edits are handled properly.** If two devices save within the same
  second, the second one is rejected rather than overwriting — it reloads the winning
  version and tells you. No silent data loss.
* **Neon's free tier sleeps** after a few minutes of no use. The first load after that
  takes an extra second while it wakes up. Normal, and free.
* **Backups still work.** ⬇ Backup downloads the whole dataset any time. Worth doing
  occasionally regardless of where it's hosted.
* **Updating the app later:** push to `main` and Vercel redeploys automatically. Your
  data lives in the database, so it is never affected by a deploy.

---

## If something goes wrong

| Symptom | Cause and fix |
|---|---|
| ☁ Setup — "No database URL found" | The Neon database isn't connected. Vercel → Storage → Create Database → Neon, then **redeploy**. |
| "Wrong username or password" | Usernames are case-insensitive but passwords are not — check caps lock. |
| "That username is already taken" | You (or someone) already signed up with it — use Sign in instead. |
| Page loads straight into local saving, no sign-in screen | The functions aren't deployed. Check the `api/` folder is in the repo and the build log shows functions being created. |
| 500 errors in the function log | Check the `DATABASE_URL` env var exists on the project, then redeploy. |
