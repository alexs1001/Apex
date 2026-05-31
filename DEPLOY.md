# Deploy guide — My Dashboard

Everything you need to go from zip → live webapp in about 10 minutes.

---

## 1 · Supabase (cross-device sync)

1. Go to **https://supabase.com** → New project (pick any name, any region).
2. Once created, go to **SQL Editor → New query**, paste the contents of `supabase_setup.sql`, and click **Run**. This creates the `app_state` table.
3. Go to **Settings → API**. Copy:
   - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - **service_role** secret key (under "Project API keys" — the long one labeled `service_role`)
   - **anon / public** key (safe to embed in the browser — the `topbar.js` only uses it for the publishable key display)

---

## 2 · WHOOP developer app

1. Go to **https://developer.whoop.com** → sign in with your WHOOP account.
2. Click **Create App**.
   - App name: anything (e.g. "My Dashboard")
   - Redirect URI: `https://YOUR-VERCEL-DOMAIN.vercel.app/api/whoop-callback`  
     *(you'll get this domain after step 3 — you can come back and update it)*
   - Scopes: check all of these:
     `read:recovery`, `read:sleep`, `read:workout`, `read:cycles`, `read:profile`, `read:body_measurement`, `offline`
3. Save. Copy your **Client ID** and **Client Secret**.

---

## 3 · Deploy to Vercel

1. Push this folder to a GitHub repo (public or private).
2. Go to **https://vercel.com** → New Project → Import your repo.
3. Vercel auto-detects the `vercel.json`. Just click **Deploy**.
4. Once deployed, copy your production URL (e.g. `https://my-dashboard-xxxx.vercel.app`).

### Add environment variables

In Vercel → your project → **Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `WHOOP_CLIENT_ID` | Client ID from step 2 |
| `WHOOP_CLIENT_SECRET` | Client Secret from step 2 |
| `WHOOP_REDIRECT_URI` | `https://YOUR-VERCEL-DOMAIN.vercel.app/api/whoop-callback` |
| `SUPABASE_URL` | Project URL from step 1 |
| `SUPABASE_SERVICE_KEY` | service_role key from step 1 |

After adding them, go to **Deployments → Redeploy** (top-right) so the new env vars take effect.

---

## 4 · Wire up the frontend constants

Open these two files and paste in your values:

### `topbar.js` (lines 12–13)
```js
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_KEY = 'your-anon-public-key-here';
```

### `health.html` (WHOOP JS section, line ~595)
```js
const CLIENT_ID = 'your-whoop-client-id-here';
```

Commit and push — Vercel redeploys automatically.

---

## 5 · Update WHOOP redirect URI

Go back to **developer.whoop.com** → your app → update the Redirect URI to match your actual Vercel domain if you used a placeholder in step 2.

---

## 6 · Test

1. Open `https://YOUR-VERCEL-DOMAIN.vercel.app`
2. Add a goal → the green dot in the topbar should update.
3. Go to **health.html** → click **Connect WHOOP** → authorise → you land back on health.html with your live recovery score.
4. Open the same URL on your phone — data syncs automatically via Supabase.

---

## File map

```
dashboard/
├── index.html          Goals + Day Ring + Ticker
├── health.html         WHOOP card + Daily Stack
├── gym.html            Progressive Overload tracker
├── finance.html        Finance tracker
├── po-water.html       Water Coach
├── topbar.js           Shared sticky nav + Supabase sync
├── api/
│   ├── whoop-callback.js   OAuth code → tokens redirect
│   ├── whoop-refresh.js    Refresh expired access token
│   ├── whoop-data.js       WHOOP API proxy (CORS fix)
│   └── sync.js             Supabase read/write proxy
├── vercel.json         Routing config
├── package.json        Node deps for serverless fns
├── supabase_setup.sql  Run once in Supabase SQL editor
└── DEPLOY.md           This file
```

---

## How sync works

- Every time you write to `localStorage` (add goal, log water, check a supplement), `topbar.js` intercepts the write and sends a debounced POST to `/api/sync` within ~1.5 seconds.
- `/api/sync` upserts the payload into Supabase using the service-role key.
- On page load and every 5 minutes, `topbar.js` GETs `/api/sync` and merges remote state back into `localStorage`.
- Water logs are merged by taking the **max** per day — so a tap from your phone and a tap from your laptop both count.

---

## Local development

```bash
npm install -g vercel
vercel dev
```

This runs the serverless functions locally. Set the env vars in a `.env.local` file:

```
WHOOP_CLIENT_ID=...
WHOOP_CLIENT_SECRET=...
WHOOP_REDIRECT_URI=http://localhost:3000/api/whoop-callback
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```
