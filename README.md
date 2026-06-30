# Mshauri

AI-powered legal and health guidance for everyday Ugandans — built for the XPRIZE Build with
Gemini hackathon (Professional Services Access category).

Mshauri lets anyone ask a legal or health question in plain language (English, Luganda, or
Swahili) and get a real, useful answer in seconds — for the price of a boda ride, paid via
Mobile Money. Complex or urgent cases are escalated to a human professional. AI runs the core
of the business: triage, response generation, translation, and document drafting.

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│   Frontend   │ ───▶ │   Express API     │ ───▶ │   Gemini (Google)    │
│  (React/Vite)│      │   (Node.js)       │      │   2.0 Flash           │
└─────────────┘      └────────┬─────────┘      └─────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼              ▼              ▼
        ┌───────────┐  ┌─────────────┐  ┌───────────────┐
        │ lowdb      │  │ Flutterwave  │  │ Twilio        │
        │ (JSON DB)  │  │ (MTN/Airtel) │  │ (WhatsApp)    │
        └───────────┘  └─────────────┘  └───────────────┘
```

### Agent pipeline

Every message flows through this pipeline (see `backend/agents/orchestrator.js`):

1. **Triage agent** — classifies domain (legal/medical/unclear), urgency (low → emergency), and
   detected language. Returns structured JSON.
2. **Specialist agent** — legal or medical agent generates the actual guidance, grounded in
   Ugandan law/health-system context via its system prompt.
3. **Translation agent** — if the user's language isn't English, translates the final response.
4. **Escalation logic** — emergencies and unclear cases are flagged for human review.
5. **Document agent** (paid feature) — drafts a letter/document based on conversation context,
   gated behind a successful payment.

Every single agent call is logged to the database (`agentLogs` table) with input, output,
latency, and model used — this is the evidence trail for "AI runs in production."

## Project structure

```
mshauri/
├── backend/              Express API + agent orchestration + DB
│   ├── server.js          Main entrypoint, all REST routes
│   ├── db.js              lowdb (file-backed JSON) persistence layer
│   ├── gemini.js           Gemini API wrapper (falls back to offline stub if no key)
│   ├── payments.js         Flutterwave Mobile Money integration
│   ├── momo.js              Direct MTN MoMo Collections API integration (alternative)
│   ├── paymentProvider.js   Switches between payments.js / momo.js via PAYMENT_PROVIDER env var
│   ├── agents/
│   │   ├── prompts.js       System prompts for each agent
│   │   └── orchestrator.js  Pipeline logic (triage → specialist → translate)
│   ├── routes/
│   │   └── whatsapp.js      Twilio WhatsApp webhook (same pipeline, different channel)
│   ├── data/mshauri.json    The database file (gitignored, regenerates on boot)
│   ├── Dockerfile
│   └── .env.example
└── frontend/             React + Vite web app
    └── src/
        ├── pages/          Landing, Onboarding, Chat, Documents, Admin
        ├── components/     PaymentModal
        └── api.js          API client
```

## Running locally

### Backend

```bash
cd backend
npm install
cp .env.example .env     # already done — edit with your real keys
node server.js
```

Runs on `http://localhost:8080`. Without any API keys set, it runs fully in **offline/simulation
mode** — every feature works (chat, payments, documents) using clearly-labeled stub responses, so
you can test and demo the whole app without spending API credits or holding real money.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`.

### Going live — three things to add

Edit `backend/.env`:

| Variable | Where to get it | What it unlocks |
|---|---|---|
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey | Real AI responses instead of offline stub |
| Payment provider (see below) | — | Real Mobile Money charges |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_NUMBER` | https://console.twilio.com | WhatsApp bot channel |

Restart the backend after editing `.env`. The `/api/status` endpoint and the Admin dashboard
(`/admin` in the web app) show you live vs. offline status for each integration at a glance.

#### Payment provider options

`backend/.env` has a `PAYMENT_PROVIDER` switch — pick whichever fits, and leave the other
section's keys blank:

- **`PAYMENT_PROVIDER=momo`** — talks directly to MTN's MoMo Collections API
  (`backend/momo.js`), no aggregator fee on top of MTN's own fees. Requires signing up at
  https://momodeveloper.mtn.com, subscribing to the "Collections" product, and provisioning an
  API user/key. Slower to set up, cheaper per transaction, MTN-only (you'd need a second,
  separate integration for Airtel Money if you want both networks directly).
- **`PAYMENT_PROVIDER=flutterwave`** (or leave unset) — uses Flutterwave
  (`backend/payments.js`), which aggregates MTN + Airtel Money behind one integration. Faster
  merchant onboarding, one API for both networks, but takes a cut on top of telco fees.
- **Leave all payment keys blank** — either provider runs in clearly-labeled simulation mode:
  every payment auto-succeeds in the database so you can test and demo the entire paywall flow
  (chat → paywall → "payment" → document unlock) with zero payment setup at all.

## Deploying to Google Cloud (required: uses Google Cloud product)

The backend is a standard containerized Node app — deploys to **Cloud Run** in one command:

```bash
cd backend
gcloud run deploy mshauri-api \
  --source . \
  --region africa-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key_here,FLUTTERWAVE_SECRET_KEY=your_key_here
```

> Note: Cloud Run filesystems are ephemeral — for production persistence beyond a demo, swap
> `lowdb` for **Firestore** (a few hours of work; the `db.js` module is a thin enough abstraction
> that only the internals change, not the API used by `server.js`). This is the natural next step
> once you're past the hackathon demo and need durable production data.

Deploy the frontend to **Firebase Hosting** or **Cloud Run** as a static build:

```bash
cd frontend
npm run build
firebase deploy --only hosting
```

Update `frontend/.env` with your deployed backend URL before building:
```
VITE_API_BASE=https://your-cloud-run-url.run.app/api
```

## Google Cloud products used / recommended

- **Gemini API** (via Google AI Studio or Vertex AI) — every agent in the pipeline
- **Cloud Run** — serverless hosting for the backend
- **Firestore** (recommended upgrade path from lowdb for production durability)
- **Cloud Translation API** (optional alternative/supplement to the Gemini-based translation agent)
- **Maps Platform** (recommended next step — facility finder for the medical agent's "go to a
  clinic" recommendations)

## What's real vs. simulated right now

This is a fully wired system, not a mockup — but it ships with safe defaults so it's testable
without live credentials:

- **Database**: real, persists to disk (`backend/data/mshauri.json`). Not simulated.
- **Agent pipeline**: real orchestration logic, real prompts. Calls the real Gemini API the
  moment you add `GEMINI_API_KEY` — until then, returns a clearly-labeled offline stub so you can
  test the full flow.
- **Payments**: real integration code for both Flutterwave and direct MTN MoMo — switch via
  `PAYMENT_PROVIDER` in `.env`. Without credentials for whichever provider is selected, payments
  are auto-marked successful (clearly labeled "SIMULATION MODE") so the paywall flow can be
  tested end-to-end without a live merchant account or telco integration.
- **WhatsApp**: real Twilio webhook code, reusing the exact same agent pipeline as the web app.
  Inactive until Twilio credentials are added.

## Next steps to build a real business on this

1. Get a Flutterwave Uganda merchant account verified (takes a few days) — this unlocks real
   Mobile Money revenue.
2. Get a Gemini API key and move to Vertex AI for production-scale rate limits.
3. Swap lowdb → Firestore for durable, concurrent-safe storage.
4. Apply for WhatsApp Business API access via Twilio (or Google's own messaging tools) — this
   is almost certainly your highest-leverage acquisition channel in Uganda.
5. Partner with 1–2 local NGOs, SACCOs, or community health workers as initial distribution and
   as your first real, attributable customers for the hackathon submission.
6. Recruit one part-time advocate and one part-time clinician for the human-escalation path —
   this is both a safety requirement and the "jobs created" story for the submission narrative.
# Mshauri
