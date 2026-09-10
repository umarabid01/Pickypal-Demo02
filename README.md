# PickyPal — MERN Edition

An AI food-ordering assistant for people with allergies/dietary restrictions, rebuilt as a
full MERN stack (MongoDB, Express, React, Node) from the original Next.js prototype.

This is a portfolio/demo project — payments and delivery are mocked, but the AI agent
system, database, and API are all real and fully working once you add your own keys.

---

## 1. Architecture

```
pickypal-mern/
├── backend/     Express API + MongoDB (Node)
└── frontend/    React app (Vite)
```

**Backend (`/backend`)** — Node + Express + MongoDB (via Mongoose)
- `server.js` — Express app entrypoint
- `routes/message.js` — `POST /api/message`, the main chat endpoint
- `routes/simulate-step.js` — `POST /api/simulate-step`, advances delivery status for the demo
- `lib/orchestrator.js` — the "brain": decides which AI agent(s) to call based on
  conversation phase, and what to save to the database
- `agents/` — 5 separate AI agents, each with its own prompt and structured JSON output:
  - `discovery.js` — understands what the user wants, filters the menu by their allergies
  - `preference.js` — detects and saves new allergies/dietary info/name/language
  - `order.js` — builds and modifies the shopping cart
  - `payment.js` — mocked JazzCash/EasyPaisa payment flow
  - `rider.js` — mocked delivery status updates
- `config/aiClient.js` — picks Gemini 2.5 Flash or GPT-4o depending on which API key you set
- `models/` — MongoDB schemas: `User`, `Order`, `Restaurant`, `ConversationLog`
- `scripts/seed.js` — loads the demo restaurant/menu data into MongoDB

**Frontend (`/frontend`)** — React + Vite
- A WhatsApp-style chat UI (`ChatWindow`, `MessageBubble`, `PhoneFrame`) on the left
- A live "Agent Trace" panel on the right showing each AI agent call, its input, and its
  structured JSON output as it happens — this is what makes the multi-agent system visible
  to someone watching a demo
- `api.js` — talks to the backend via `VITE_API_URL`

---

## 2. How the flow works

Every chat message goes through this loop:

1. **User sends a message** → frontend POSTs it to `/api/message` with a `sessionId`.
2. **Orchestrator looks up (or creates) the user and their conversation** in MongoDB.
3. **Orchestrator checks the current "phase"** of the conversation:
   `idle → discovering → ordering → paying → tracking → delivered`
4. **Based on the phase, it calls the relevant agent(s):**
   - **idle/discovering** → runs the **Preference Agent** and **Discovery Agent** in
     parallel. Preference Agent extracts any new allergy/dietary info from the message and
     saves it to the `User` document. Discovery Agent reads the user's saved allergies,
     cross-references them against every restaurant's menu (loaded from MongoDB), and
     returns only the items that are *safe* for that user, plus a natural-language reply
     (in English/Urdu/Punjabi, matching the user).
   - **ordering** → runs the **Order Agent**, which reads the selected restaurant's menu
     and the current cart, and returns updated cart contents based on what the user said
     ("add 2 chicken karahi", "remove the drink", etc.). This gets saved as an `Order`
     document.
   - **paying** → runs the **Payment Agent** (mocked), which "processes" JazzCash/EasyPaisa
     and marks the order as paid.
   - **tracking** → runs the **Rider Agent** (mocked), which advances the order through
     `placed → preparing → rider_assigned → on_the_way → delivered` one step at a time,
     either automatically or via the "Simulate Next Step" button in the demo UI.
5. **Every agent call is logged as a "trace step"** (agent name, input, output JSON,
   status, duration) — saved to the `ConversationLog` document and streamed back to the
   frontend, which is what populates the Agent Trace Panel live.
6. **The orchestrator returns a reply + trace steps + phase** to the frontend, which
   renders the chat bubble and updates the trace panel.

The AI model itself never talks to the database directly — it only returns structured
JSON (defined per-agent in `backend/agents/*.js` + `backend/prompts/*.system.md`), and the
orchestrator decides what to actually write to MongoDB based on that JSON. This keeps the
AI's role limited to "understand language, decide what should happen" while your code
stays in control of what's actually persisted.

---

## 3. Local setup

### Prerequisites
- Node.js 18+
- A MongoDB Atlas account (free) — see step 4
- A Gemini API key (free) — see step 5

### Backend
```bash
cd backend
cp .env.example .env
# edit .env: paste your MONGODB_URI and GEMINI_API_KEY
npm install
npm run seed        # loads the 5 demo restaurants into MongoDB
npm run dev          # starts on http://localhost:5000
```

### Frontend
```bash
cd frontend
cp .env.example .env    # VITE_API_URL=http://localhost:5000 by default
npm install
npm run dev              # starts on http://localhost:5173
```

Open `http://localhost:5173` — you should see the chat UI on the left and the empty Agent
Trace Panel on the right. Send a message like "I want something spicy, no peanuts" and
watch both panels update.

---

## 4. Set up MongoDB Atlas (free)

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a new **free M0 cluster** (choose any nearby region).
3. Under **Database Access**, create a database user with a username/password.
4. Under **Network Access**, add IP `0.0.0.0/0` ("allow access from anywhere") — fine for
   a demo; for a real product you'd restrict this to your backend host's IP.
5. Click **Connect → Drivers**, copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```
6. Paste it into `backend/.env` as `MONGODB_URI`, and add your database name before the
   `?`, e.g. `.../pickypal?retryWrites=true...`.
7. Run `npm run seed` from `/backend` once to populate the `restaurants` collection.

---

## 5. Get a free Gemini API key

1. Go to https://aistudio.google.com/app/apikey
2. Sign in with a Google account, click **Create API Key**.
3. Copy the key into `backend/.env` as `GEMINI_API_KEY`.

That's it — the backend automatically uses Gemini 2.5 Flash whenever this key is present.
(If you'd rather use GPT-4o, leave `GEMINI_API_KEY` blank and set `OPENAI_API_KEY`
instead — note OpenAI is pay-as-you-go, no real free tier.)

---

## 6. Deploy the backend for free (Render)

1. Push this project to a GitHub repo (backend and frontend can be in the same repo).
2. Go to https://render.com, sign up, click **New → Web Service**.
3. Connect your GitHub repo, and set:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. Under **Environment**, add:
   - `MONGODB_URI` = your Atlas connection string
   - `GEMINI_API_KEY` = your Gemini key
   - `CORS_ORIGIN` = your frontend's URL (you'll get this in step 7 — you can come back
     and edit this env var afterward)
5. Deploy. Render will give you a URL like `https://pickypal-backend.onrender.com`.
6. **Note**: Render's free tier sleeps after ~15 minutes of inactivity. The first request
   after sleeping takes ~30-50 seconds to wake up. This is worth mentioning when you demo
   it live — send a request to `/api/health` a minute before your demo to "wake it up."

---

## 7. Deploy the frontend for free (Vercel)

1. Go to https://vercel.com, sign up, click **Add New → Project**.
2. Import the same GitHub repo.
3. Set:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (auto-detected)
4. Under **Environment Variables**, add:
   - `VITE_API_URL` = your Render backend URL from step 6 (e.g.
     `https://pickypal-backend.onrender.com`)
5. Deploy. Vercel gives you a URL like `https://pickypal.vercel.app`.
6. Go back to Render and update `CORS_ORIGIN` to this Vercel URL, then redeploy the
   backend so it accepts requests from your live frontend.

---

## 8. Showcasing it

- Share the Vercel URL directly — anyone can open it and chat with PickyPal immediately,
  no login needed.
- The Agent Trace Panel is your strongest selling point in a live demo: switch to it (or
  view it side-by-side on desktop) so viewers can see the actual AI reasoning and
  structured JSON output per turn, not just a black-box chat reply.
- Mention clearly that payment and delivery are mocked for this prototype — the AI
  understanding, allergy filtering, and database are fully real and working.

---

## 9. What's mocked vs. real

| Piece | Status |
|---|---|
| AI understanding (Discovery, Preference, Order agents) | **Real** — actual Gemini/GPT-4o calls |
| Allergy/dietary filtering | **Real** — computed from live MongoDB menu data |
| Database (users, orders, conversation history) | **Real** — MongoDB Atlas |
| Payment (JazzCash/EasyPaisa) | **Mocked** — auto-succeeds |
| Delivery/rider tracking | **Mocked** — advances on a button click or auto-progresses |
| WhatsApp channel | **Mocked** — a WhatsApp-styled web chat, not real WhatsApp |

If you want to go further, the two most convincing upgrades for a real seller pitch are:
connecting the WhatsApp Cloud API (Meta) so it works in actual WhatsApp, and adding a
simple restaurant-owner dashboard to view/manage incoming orders.
