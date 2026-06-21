# Deploying the Vedic Personality Reading (hosted version)

This is a step-by-step guide for putting the reading online with **Vercel** so people
can take it from their **phones**, with **all results collected in one place**.

You do **not** need to be a programmer. Budget ~15 minutes. Everything used here
has a **free tier**.

---

## What you are setting up
- A public website (your domain) where anyone can take the reading on a phone or computer.
- A central database that stores every reading.
- A password-protected "Facilitator" dashboard to see all results and analytics.

---

## Before you start, you need
1. A **Vercel account** — free, sign up at https://vercel.com (you can sign in with GitHub).
2. A **GitHub account** — free, https://github.com (easiest way to give Vercel the code).
3. The domain name you want to use (optional — Vercel also gives you a free
   `your-project.vercel.app` address you can use immediately).

---

## Step 1 — Put the code on GitHub
1. Create a new **empty repository** on GitHub (e.g. `vedic-test`). Keep it Private if you like.
2. Upload the **contents of this folder** to that repository.
   - Easiest: on the new repo page, click **"uploading an existing file"**, then
     drag in everything inside this `VedicPersonalityTest-Hosted` folder
     (the `index.html`, `api`, `js`, `css` folders and `package.json`).
   - Do **not** upload a `node_modules` folder if one exists.

## Step 2 — Import the project into Vercel
1. Go to https://vercel.com/new
2. Choose **Import** next to your `vedic-test` GitHub repository.
3. Leave all build settings at their defaults and click **Deploy**.
   (Vercel automatically detects it: static site + serverless functions in `/api`.)
4. Wait for the first deploy to finish. You now have a live URL like
   `https://vedic-test.vercel.app` — the reading page already works, but it cannot
   save results yet until you add the database (next step).

## Step 3 — Add the central database (Vercel Postgres)
1. In your project on Vercel, open the **Storage** tab.
2. Click **Create Database** → choose **Postgres** → pick the free plan → **Create**.
3. When asked, **Connect** the database to this project (accept the defaults).
   This automatically adds the database connection settings to your project.
4. That's it — no tables to create by hand. The app creates them automatically
   the first time someone submits a reading.

## Step 4 — Set the Facilitator password
1. In your project, open **Settings → Environment Variables**.
2. Add a new variable:
   - **Name:** `ADMIN_PASSWORD`
   - **Value:** a password of your choice (this unlocks the dashboard)
3. Save.

## Step 5 — Redeploy so the new settings take effect
1. Open the **Deployments** tab.
2. On the most recent deployment, click the **•••** menu → **Redeploy** → **Redeploy**.

✅ **Done.** Visit your URL. Take a reading on your phone. Then open the
**Facilitator** link (top-right) and log in with your `ADMIN_PASSWORD` to see results.

---

## Step 6 (optional) — Use your own domain
1. In your project, open **Settings → Domains**.
2. Type your domain and click **Add**, then follow the on-screen DNS instructions
   (Vercel tells you exactly what record to add at your domain registrar).
3. Once it shows "Valid", your reading is live on your domain.

---

## How the facilitator uses it day-to-day
- Open the site → click **Facilitator** (top-right) → enter the password.
- **Generate access codes:** the reading now requires a one-time, 4-digit access code
  to start — takers without a valid, unused code can't begin. Under **Access codes**,
  enter how many you need, click **Generate codes**, then **Copy all** and print/hand
  them out (e.g. one slip of paper per person). A code is only consumed when someone
  actually finishes and submits, so an abandoned attempt doesn't waste it. Click
  **Show all codes** any time to see which are used vs. still available.
- **Universal code:** for a walk-up/kiosk setup, set one 4-digit code (e.g. `0000`)
  that never expires and any number of people can use — type it into **Universal
  code** and click **Set universal code**.
- **Reset all to unused:** click **Reset all to unused** to mark every single-use
  code unused again (e.g. before a new event reusing the same printed codes).
- **Share the reading:** copy the link, or click **Show QR code** and let people
  scan it with their phone camera to open the reading.
- **Show or hide results from takers:** flip the toggle. It applies to everyone
  instantly — when OFF, takers only see a thank-you screen and you review their
  results privately in the dashboard.
- **Analytics:** totals, averages, average time to complete, dominant-quality
  distribution, and a date-range filter (today / 7 days / 30 days / this month /
  last month / custom).
- **Export to Excel:** download all results in the selected date range.

---

## Optional: live Excel backup via Google Sheets
Every reading is always saved in the database (Step 3) and can be exported on demand
from the Facilitator dashboard. If you'd also like a **live Google Sheet** that gets a new
row automatically the instant someone finishes the reading (no clicking export), set this up
once:

1. **Create the Sheet.** Go to https://sheets.new — this makes a blank Google Sheet.
   Copy its **ID** from the URL: `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.
2. **Create a Google Cloud service account** (a robot account just for this app):
   - Go to https://console.cloud.google.com/projectcreate and create a project (any name).
   - In that project, go to **APIs & Services → Library**, search **Google Sheets API**, click **Enable**.
   - Go to **APIs & Services → Credentials → Create Credentials → Service account**. Give it
     any name, click through the defaults, then **Done**.
   - Click the new service account → **Keys** tab → **Add Key → Create new key → JSON**.
     A `.json` file downloads — open it in any text editor.
3. **Share the Sheet with the robot account.** In the downloaded JSON, copy the
   `client_email` value (looks like `something@your-project.iam.gserviceaccount.com`).
   Back in your Google Sheet, click **Share**, paste that email in, and give it **Editor** access.
4. **Add the Vercel environment variables.** In your Vercel project, open
   **Settings → Environment Variables** and add:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — the `client_email` value from the JSON file.
   - `GOOGLE_PRIVATE_KEY` — the `private_key` value from the JSON file, pasted exactly as-is
     (it's a long value starting with `-----BEGIN PRIVATE KEY-----`).
   - `GOOGLE_SHEET_ID` — the Sheet ID you copied in step 1.
5. **Redeploy** (Deployments tab → latest → **•••** → Redeploy) so the new settings take effect.

That's it — from now on, every submitted reading appends a row (timestamp, name, email, age,
zip, phone, access code, dominant quality, scores, time to complete) to that Sheet in real time. You can open
it in Google Sheets any time, or use **File → Download → Microsoft Excel (.xlsx)** to get a
real Excel file. If these variables aren't set, the app behaves exactly as before — this
feature is entirely optional and never blocks a submission if it fails.

## Optional: AI-personalized readings
By default, takers and the facilitator see the same write-up for everyone who shares a
dominant quality. Turning this on adds a **"Get my personalized insights"** button (on the
taker's result screen) and a **"Generate AI insight"** button (in the facilitator's profile
view) that calls Claude to write a short reading and 3–5 action items grounded in that
specific person's actual 36 answers — not just their aggregate score. It's generated once
per person and saved, so re-opening the same profile never re-generates or re-charges.

1. **Get an API key.** Go to https://console.anthropic.com, sign up/sign in, open
   **API Keys**, and create a new key. You'll need a payment method on the account, but
   usage here is tiny — each generation costs well under a cent (roughly $0.02 at typical
   usage), so even a few hundred readings costs only a few dollars total.
2. **Add the Vercel environment variable.** In your Vercel project, open
   **Settings → Environment Variables** and add:
   - `ANTHROPIC_API_KEY` — the key you just created.
3. **Redeploy** (Deployments tab → latest → **•••** → Redeploy) so the new setting takes effect.

That's it — the buttons appear automatically once the key is set. If it's not set, the app
behaves exactly as before; this feature is entirely optional. The exact model used can be
changed with an optional `ANTHROPIC_MODEL` variable (defaults to Anthropic's top model,
`claude-opus-4-8`) if you'd rather use a cheaper one.

## Frequently asked
**Do takers install anything?** No. They just open the link in any phone browser.

**Do takers need anything besides the link?** Yes — a 4-digit access code from the
facilitator. Generate codes from the dashboard (see above) and hand them out; each
single-use code lets exactly one person take the reading, or set one universal code
for a walk-up/kiosk setup where anyone can type the same code.

**Where are results stored?** In the Vercel Postgres database — one shared place,
visible to the facilitator from any device.

**Can many people take it at the same time?** Yes — that's the whole point of the
hosted version.

**What's the password if I didn't set one?** If `ADMIN_PASSWORD` is not set, it
defaults to `vedic`. Please set your own in Step 4.

**Is there a cost?** The free tiers of Vercel and Vercel Postgres are enough for
typical workshop/classroom use. Heavy usage may eventually require a paid plan.

---

## For developers (optional local run)
```
npm install
npm i -g vercel
vercel link        # connect to the Vercel project (pulls the database settings)
vercel env pull .env.local
vercel dev         # runs the site + API locally at http://localhost:3000
```
