# Bot Detection with AI

A sophisticated, localhost-only bot detection system that combines behavioral analysis, invisible traps, and AI-powered scoring to distinguish between human users and automated bots. This demo showcases a multi-layered security approach with a clean, professional SaaS interface.

## 🌟 Features

- **🎯 Multi-Layer Detection**: Combines behavioral CAPTCHA, invisible traps, and automation heuristics
- **🤖 AI-Powered Scoring**: Machine learning-based risk assessment with configurable thresholds
- **🎨 Professional UI**: Clean white/purple/black SaaS design with responsive layout
- **📊 Admin Dashboard**: Real-time monitoring with detailed access logs and analytics
- **🔒 Privacy-First**: Minimal fingerprinting, localhost-only operation, no cloud dependencies
- **🛡️ Bot Simulation**: Built-in Selenium, Puppeteer, and Playwright attack scripts for testing

## 🏗️ Architecture Overview

```mermaid
graph TB
    A[User Browser] --> B[Client Detection Layer]
    B --> C[Behavioral Analysis]
    B --> D[Invisible Traps]
    B --> E[Bot-Detect Library]
    
    C --> F[Mouse Movement Tracking]
    C --> G[Keystroke Dynamics]
    C --> H[Timing Analysis]
    
    D --> I[Honeypot Fields]
    D --> J[Hidden Elements]
    
    E --> K[Automation Detection]
    E --> L[WebDriver Detection]
    E --> M[Headless Browser Detection]
    
    F --> N[AI Scoring Engine]
    G --> N
    H --> N
    I --> N
    J --> N
    K --> N
    L --> N
    M --> N
    
    N --> O[Decision Engine]
    O --> P[Accept/Reject]
    
    P --> Q[Access Logs]
    P --> R[User Feedback]
    
    Q --> S[Admin Dashboard]
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and **npm** 9+
- **Chromium/Chrome** (for bot simulations)
- **Playwright browsers**: `npx playwright install` (optional)

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone https://github.com/abhiveeramallu/Bot-detection.git
   cd Bot-detection
   npm install
   ```

2. **Verify bot-detect bundle**:
   Ensure `public/vendor/botdetect.min.js` exists. If not, follow `public/vendor/README.md` to rebuild.

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Access the application**:
   - **Login Page**: http://localhost:3000
   - **Admin Dashboard**: http://localhost:3000/admin.html

## 🎭 Bot Attack Simulation

Test the detection system with automated attacks:

```bash
# Selenium WebDriver attack
npm run bot:selenium

# Puppeteer-based attack
npm run bot:puppeteer

# Playwright-based attack
npm run bot:playwright
```

*Run these commands while the server is running to see real-time detection in action.*

## 📁 Project Structure

```mermaid
graph LR
    A[Root] --> B[bots/]
    A --> C[public/]
    A --> D[server/]
    A --> E[storage/]
    A --> F[vendor/]
    
    B --> B1[selenium.js]
    B --> B2[puppeteer.js]
    B --> B3[playwright.js]
    
    C --> C1[index.html]
    C --> C2[admin.html]
    C --> C3[app.js]
    C --> C4[styles.css]
    C --> C5[vendor/]
    
    D --> D1[index.js]
    D --> D2[aiScoring.js]
    D --> D3[logger.js]
    
    E --> E1[access_log.csv]
    
    F --> F1[bot-detect/]
```

### Directory Details

- **`bots/`** - Automated attack scripts using popular automation frameworks
- **`public/`** - Frontend assets including login UI, admin dashboard, and client-side detection
- **`server/`** - Express.js backend with AI scoring, decision engine, and logging
- **`storage/`** - CSV access logs (git-ignored for privacy)
- **`vendor/`** - Third-party libraries including bot-detect

## 🔍 Detection Pipeline

```mermaid
flowchart TD
    A[Login Attempt] --> B[Client-Side Collection]
    B --> C{Behavioral Analysis}
    B --> D{Invisible Traps}
    B --> E{Bot-Detect Scan}
    
    C --> C1[Mouse Patterns]
    C --> C2[Typing Rhythm]
    C --> C3[Timing Metrics]
    
    D --> D1[Honeypot Click]
    D --> D2[Hidden Field]
    D --> D3[Trap Interaction]
    
    E --> E1[WebDriver Check]
    E --> E2[Headless Detection]
    E --> E3[Automation Flags]
    
    C1 --> F[AI Scoring]
    C2 --> F
    C3 --> F
    D1 --> F
    D2 --> F
    D3 --> F
    E1 --> F
    E2 --> F
    E3 --> F
    
    F --> G{Risk Score >= 0.6?}
    G -->|Yes| H[REJECTED]
    G -->|No| I[ACCEPTED]
    
    H --> J[Log Attempt]
    I --> J
    J --> K[Update Dashboard]
```

## 📊 Detection Features

### Behavioral Analysis
- **Mouse Movement**: Track movement patterns, velocity, and natural vs robotic motion
- **Keystroke Dynamics**: Analyze typing rhythm, speed variations, and pause patterns
- **Timing Metrics**: Measure time to first click, form completion time, and interaction delays

### Invisible Traps
- **Honeypot Fields**: Hidden form fields that bots typically fill
- **Trap Elements**: Invisible buttons and links designed to catch automated interactions
- **CSS Traps**: Elements positioned off-screen or with zero opacity

### Automation Detection
- **WebDriver Detection**: Identify Selenium, Puppeteer, and Playwright automation
- **Headless Browser Flags**: Detect headless Chrome, Firefox, and WebKit
- **Plugin/Language Checks**: Verify browser fingerprint authenticity

### AI Scoring Engine
- **Multi-Feature Analysis**: Combines all signals into a unified risk score
- **Configurable Thresholds**: Adjustable sensitivity levels (default: 0.6)
- **Reason Generation**: Human-readable explanations for detection decisions

## 📈 Admin Dashboard Features

- **Real-time Statistics**: Live counts of accepted vs rejected attempts
- **Detailed Logs**: Comprehensive CSV export with all detection metrics
- **Visual Analytics**: Color-coded decisions and score visualizations
- **Filtering Options**: Sort by timestamp, decision, username, or risk factors

## 🔧 Configuration

### Thresholds
```javascript
const SCORE_THRESHOLD = 0.6;      // AI risk score threshold
const CAPTCHA_THRESHOLD = 0.6;     // CAPTCHA anomaly threshold
```

### Detection Features
The AI scoring engine analyzes:
- **CAPTCHA Metrics**: Drag duration, mouse speed variance, corrections, reaction time
- **Behavioral Signals**: Mouse movements, keystrokes, typing patterns
- **Automation Flags**: WebDriver, headless UA, missing plugins/languages
- **Trap Interactions**: Honeypot clicks, hidden field triggers

## 📝 Logging Format

Every login attempt is logged to `storage/access_log.csv` with:

```csv
timestamp,decision,label,reason,aiScore,captchaScore,behaviorScore,automationScore,
automationFlags,botDetectDecision,botSignalCount,trapClicked,mouseMoveCount,
keystrokeCount,typingDurationMs,userAgent,platform,language,timezone
```

**Note**: `storage/*.csv` files are git-ignored to protect user privacy.

## 🛡️ Security & Privacy

- **Human-Friendly Messages**: Non-technical feedback that doesn't expose detection logic
- **Admin-Only Details**: Internal scoring and technical reasons restricted to logs
- **Localhost Operation**: No cloud services or external API calls
- **Minimal Fingerprinting**: Privacy-conscious data collection (UA, platform, language, timezone)
- **No PII Storage**: Username sanitization and no personal information retention

## 🧪 Testing & Development

### Bot Simulation Scripts
Each bot script demonstrates different attack vectors:
- **Selenium**: Traditional WebDriver automation
- **Puppeteer**: Headless Chrome automation
- **Playwright**: Cross-browser automation framework

### Manual Testing
1. Start the server: `npm start`
2. Open http://localhost:3000 in a regular browser (should be accepted)
3. Run bot scripts (should be rejected)
4. Monitor results in admin dashboard

### One-click Bot Test (Local Demo)
From the login page, click **Run Bot Test** to launch all bot scripts against the current site and populate the admin logs.
This button is **disabled in production** unless `ALLOW_BOT_RUN=true` is set.

## ☁️ Vercel Deployment Notes
- API routes are handled by `api/[...path].js`, so `/api/login` and `/api/logs` work on Vercel.
- Logs are written to `/tmp/access_log.csv` in serverless environments (ephemeral). For persistence, set `LOG_PATH` or wire to external storage.
- The UI in `public/` is served automatically by Vercel.

## 🚀 Production Considerations

For production deployment, consider:
- **Admin Authentication**: Add access control to `/admin.html` and `/api/logs`
- **Rate Limiting**: Implement IP-based request throttling
- **CSRF Protection**: Add anti-CSRF tokens for form submissions
- **HTTPS**: Enable SSL/TLS for secure communication
- **Database**: Replace CSV logging with proper database storage
- **Scaling**: Consider load balancing for high-traffic scenarios

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature description'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[bot-detect](https://github.com/AudriusVaskevicius/bot-detect)** - JavaScript bot detection library
- **Express.js** - Web framework for Node.js
- **Playwright, Puppeteer, Selenium** - Browser automation frameworks (for testing)

## 📞 Support

For questions, issues, or contributions:
- Create an issue on GitHub
- Check the existing documentation
- Review the bot simulation examples

---

**⚠️ Disclaimer**: This is a demo project for educational purposes. For production use, implement proper authentication, security hardening, and compliance measures.
