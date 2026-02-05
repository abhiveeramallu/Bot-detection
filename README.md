# Bot Detection with AI

A demo-ready, offline, localhost-only bot detection system with a clean, flat SaaS UI. It combines lightweight behavioral signals, invisible traps, and bot-detect integration to classify attempts while keeping human-facing feedback simple and non-technical.

## Highlights
- **Clean UI**: white/purple/black, flat, professional SaaS layout.
- **Human-safe feedback**: clear success/rejection messages without exposing scores or detection logic.
- **Layered verification**: behavioral CAPTCHA + traps + automation heuristics.
- **Admin logging**: CSV logs with AI score, CAPTCHA score, behavior score, automation flags, and reason summaries.
- **Admin dashboard**: accepted vs rejected counts, color-coded decisions, score bars.

## Requirements
- **Node.js** 18+ and **npm** 9+
- Optional (bot simulations):
  - **Chromium/Chrome** installed
  - **Playwright** browsers: `npx playwright install`

See `requirements.txt` for a short list.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Verify `public/vendor/botdetect.min.js` exists. If you want to rebuild it, follow `public/vendor/README.md`.
3. Start the server:
   ```bash
   npm start
   ```
4. Open:
   - Login: `http://localhost:3000`
   - Admin logs: `http://localhost:3000/admin.html`

## Bot Attack Simulation
Run any of the scripts below (server must be running):
```bash
npm run bot:selenium
npm run bot:puppeteer
npm run bot:playwright
```

## Project Structure
```
.
├── bots/              # Selenium / Puppeteer / Playwright attack scripts
├── public/            # Login UI + client detection logic
│   ├── vendor/        # bot-detect bundle
│   ├── admin.html     # Admin dashboard
│   ├── admin.js       # Admin UI logic
│   ├── app.js         # Client behavior + captcha + submit
│   ├── index.html     # Login UI
│   └── styles.css     # UI theme
├── server/            # Express API, AI scoring, decision engine, logging
├── storage/           # CSV access logs (ignored from git)
├── package.json
└── README.md
```

## Logging
Every attempt is recorded in `storage/access_log.csv` with:
- Decision + label
- Reason summary (admin-only)
- AI score, behavior score, CAPTCHA score
- Automation flags and signal counts
- Interaction metrics (timing, mouse, typing)

`storage/*.csv` is ignored from git to avoid committing sensitive logs.

## Security & Privacy
- Human-facing messages are **non-technical** and never expose thresholds or feature weights.
- Internal scoring details are **admin-only** in logs.
- No cloud services; localhost-only by default.
- Minimal fingerprinting (UA, platform, language, timezone) to keep the demo privacy-friendly.

## Notes
This is a demo project and does not ship with admin authentication. For production, add access control to `/admin.html` and `/api/logs`.
# Bot-detection
