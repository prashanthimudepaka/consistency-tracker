# Deploying to Vercel with a Neon database

This puts your tracker on a real URL with **one database as the single source of truth**.
Every device reads and writes the same row, so there is nothing to sync, no sync codes,
and no "which copy is right?" — whatever you change is what every device sees.

Both are free: Vercel's Hobby plan and Neon's free tier.

---

## How it works

```
   phone  ─┐
            ├─►  your-app.vercel.app  ─►  /api/state  ─►  Neon Postgres (one row)
   laptop ─┘
```

* `index.html` is served as a static page.
* `api/state.js` is a serverless function with two operations:
  * `GET /api/state` → the current data and its version number
  * `PUT /api/state` → save, but **only if** nobody else saved since you last read.
    If they did, you get their version back instead of silently overwriting it.
* Every request must carry a passcode, so the data isn't open to the internet.

---

## Step 1 — Create the database (2 minutes)

1. Go to **[neon.tech](https://neon.tech)** and sign up (GitHub login works).
2. Create a project — any name, e.g. `consistency-tracker`. Pick the region closest to you.
3. On the project dashboard, copy the **connection string**. It looks like:

   ```
   postgresql://user:password@ep-something-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```

   Use the **pooled** one (the host contains `-pooler`) — it's the right choice for serverless.

> Alternative: you can skip this step and add Neon from inside Vercel later
> (**Storage → Create Database → Neon**), which sets `DATABASE_URL` for you automatically.

---

## Step 2 — Import the repo into Vercel (3 minutes)

1. Go to **[vercel.com](https://vercel.com)** and sign in with GitHub.
2. **Add New… → Project**, then **Import** `prashanthimudepaka/consistency-tracker`.
3. Leave the build settings alone:
   * Framework Preset: **Other**
   * Build Command: *(empty)*
   * Output Directory: *(empty)*
4. Expand **Environment Variables** and add these two:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from Step 1 |
   | `APP_PASSCODE` | a passcode you invent — this is what protects your data |

   Pick a real passcode, not `1234`. It's the only thing standing between your data
   and anyone who finds the URL.
5. Press **Deploy** and wait for it to finish.

You'll get a URL like `https://consistency-tracker-xxxx.vercel.app`.

> If you added the database from inside Vercel instead, add `APP_PASSCODE` under
> **Settings → Environment Variables**, then **Deployments → ⋯ → Redeploy**.
> Environment variables only take effect on a new deployment.

---

## Step 3 — Move your existing data across (important, do this first)

Your current data lives in the browser storage of the **GitHub Pages** site. The Vercel
site is a different address, so it starts out empty. Move the data before you open the
new URL anywhere else, or the empty version will become the new source of truth.

1. On the device that has your real data, open the **old** site
   (`prashanthimudepaka.github.io/consistency-tracker`) and press **⬇ Backup**.
   A `.json` file downloads.
2. Open your **new Vercel URL**. It will ask for the passcode — enter the one from Step 2.
3. Press **⬆ Restore** and choose the file you just downloaded.
4. The ☁ button now reads **☁ Cloud** and the save line says **Saved ☁**.

Your data is now in the database.

---

## Step 4 — Add your other devices

On each device: open the Vercel URL, enter the **same passcode** once, done. It pulls
everything from the database immediately.

On a phone, add it to the home screen so it opens like an app:
* **Android / Chrome:** ⋮ → *Add to Home screen*
* **iPhone / Safari:** Share → *Add to Home Screen*

---

## What you'll see

| Indicator | Meaning |
|---|---|
| **☁ Cloud** | Connected. Every change saves straight to the database. |
| **Saved ☁** | That change is in the database. |
| **☁ Offline** | No connection. Changes are kept on the device and upload when you're back. |
| **☁ Locked** | Passcode needed or wrong. |
| **☁ Setup** | A missing environment variable — the message tells you which. |

Changes appear on your other devices when they next check: every 20 seconds while open,
and instantly when you switch back to the tab or reopen the app.

---

## Things worth knowing

* **The old sites keep working.** GitHub Pages and the claude.ai artifact are untouched
  and keep their own separate copies. Once you're on Vercel, use the Vercel URL for
  everything and treat the others as archives.
* **Simultaneous edits are handled properly.** If two devices save within the same second,
  the second one is rejected rather than overwriting — it reloads the winning version and
  tells you. No silent data loss, which was the whole point of moving to a database.
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
| ☁ Setup — "APP_PASSCODE is not set" | Add the variable in Settings → Environment Variables, then **redeploy**. |
| ☁ Setup — "No database URL found" | `DATABASE_URL` missing or misspelled. Add it, then redeploy. |
| ☁ Locked, passcode rejected | The passcode must match `APP_PASSCODE` exactly, including case. |
| Page loads but stays on local saving | The function isn't deployed. Check the `api/` folder is in the repo and the build log shows a function being created. |
| 500 errors in the function log | Usually a bad connection string. Re-copy the **pooled** one from Neon. |
