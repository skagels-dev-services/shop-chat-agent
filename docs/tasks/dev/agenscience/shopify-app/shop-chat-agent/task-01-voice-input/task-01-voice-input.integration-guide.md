# Task 01 — External Services Integration Guide

This guide covers every external service the shop-chat-agent integrates with, how to sign up, and how to configure the `.env` file. Follow these steps before running the app locally or enabling Phase 3 features.

---

## Overview of Required Services

| Service | Phase | Required? | Purpose |
|---|---|---|---|
| Anthropic (Claude) | Core | Yes | AI chat agent |
| Shopify Partner Account | Core | Yes | App hosting, dev store |
| Deepgram | Phase 3 | Optional | Server-side speech-to-text |
| AssemblyAI | Phase 3 | Optional | Voice demographic signals (sentiment, etc.) |

---

## 1. Anthropic — Claude API

**Purpose:** Powers the chat agent. All customer conversations are processed by Claude.

### Sign Up
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and verify your email
3. Add a payment method (usage is billed per token; free credits are provided on signup)

### Get API Key
1. In the Anthropic Console, go to **API Keys** (left sidebar)
2. Click **Create Key**
3. Name it (e.g. `shop-chat-agent-dev`) and copy the key — it starts with `sk-ant-...`

### Configure `.env`
```
CLAUDE_API_KEY=sk-ant-...
```

### Default Model
The model is set in [app/services/config.server.js](../../../../shopify-app/shop-chat-agent/app/services/config.server.js):
```js
defaultModel: 'claude-haiku-4-5-20251001'
```
Change to `claude-sonnet-4-6` for higher quality responses at higher cost.

---

## 2. Shopify — App & Dev Store

**Purpose:** Hosts the storefront the agent is embedded in. Required for all phases.

### Sign Up for a Partner Account
1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Create a free Partner account
3. From the Partner Dashboard, create a **Development store** (unlimited, no cost)

### Register the App
The app is already scaffolded. To link it to your Partner account:
```bash
cd shopify-app/shop-chat-agent
npm run config:link
```
Follow the CLI prompts to select your Partner organization and store.

### Configure `.env`
```
SHOPIFY_API_KEY=<client ID from shopify.app.toml>
REDIRECT_URL=https://localhost:3458/auth/callback
```
`SHOPIFY_API_KEY` is the `client_id` value in `shopify.app.toml` — it is already set when you run `config:link`.

---

## 3. Shopify Admin API Token (Dev Scripts)

**Purpose:** Required only for running developer utility scripts (`npm run customers:list`, etc.). Not needed for the app itself at runtime.

### Create a Custom App in Shopify Admin
1. Go to your dev store admin: `https://admin.shopify.com/store/<your-store>`
2. **Settings → Apps and sales channels → Develop apps**
3. Click **Create an app**, give it a name (e.g. `dev-scripts`)
4. Click **Configuration** → **Admin API integration** → check these scopes:
   - `read_customers`
   - `write_customers` (needed to set metafields via script)
5. Click **Save**, then **Install app**
6. Click **API credentials** tab → under **Access tokens** → **Reveal token**
7. Copy the token (shown only once)

### Configure `.env`
```
SHOPIFY_STORE_DOMAIN=your-dev-store.myshopify.com
SHOPIFY_ADMIN_TOKEN=atkn_...
```

> **Note:** Shopify's current token format begins with `atkn_`. Older docs may reference `shpat_` — both refer to the Admin API access token.

---

## 4. Deepgram — Server-Side Speech-to-Text (Phase 3)

**Purpose:** Converts the customer's recorded audio to text on the server. More accurate and browser-independent than the Phase 1 Web Speech API. Required when `VOICE_ANALYSIS_ENABLED=true`.

### Sign Up
1. Go to [deepgram.com](https://deepgram.com)
2. Click **Get Started Free** — $200 in free credits included, no card required
3. Verify your email and complete account setup

### Get API Key
1. In the Deepgram Console, go to **API Keys** (left sidebar)
2. Click **Create a New API Key**
3. Give it a name and select **Member** role
4. Copy the key

### Configure `.env`
```
VOICE_ANALYSIS_ENABLED=true
VOICE_PROVIDER=deepgram
DEEPGRAM_API_KEY=your-deepgram-key
```

### Enable in Theme
In the Shopify theme editor, open the **AI Chat Assistant** block settings and check **"Enable Server-Side Voice Analysis"**.

---

## 5. AssemblyAI — Voice Demographic Signals (Phase 3, Optional)

**Purpose:** Analyzes audio for sentiment and demographic signals (age bracket, gender). Only needed when `VOICE_DEMOGRAPHICS_ENABLED=true`. The app works without it — Deepgram handles transcription independently.

### Sign Up
1. Go to [assemblyai.com](https://www.assemblyai.com)
2. Click **Get a Free API Key** — free tier includes 5 hours/month
3. Verify your email

### Get API Key
1. In the AssemblyAI dashboard, your API key is shown on the **home screen** immediately after login
2. Copy it

### Configure `.env`
```
VOICE_DEMOGRAPHICS_ENABLED=true
ASSEMBLYAI_API_KEY=your-assemblyai-key
```

> **Note:** The current implementation returns `sentiment` only. Full age/gender demographic inference requires AssemblyAI's Universal-2 model with Speaker Analysis add-ons enabled on a paid plan.

---

## Complete `.env` Reference

```bash
# ── Core ──────────────────────────────────────────────────────────────────────

# Anthropic — required for all chat functionality
CLAUDE_API_KEY=sk-ant-...

# Shopify app client ID (set automatically by shopify app config:link)
SHOPIFY_API_KEY=<from shopify.app.toml>

# OAuth redirect (keep as-is for local dev)
REDIRECT_URL=https://localhost:3458/auth/callback

# ── Dev Scripts ───────────────────────────────────────────────────────────────

# Required for npm run customers:list and other admin scripts
SHOPIFY_STORE_DOMAIN=your-dev-store.myshopify.com
SHOPIFY_ADMIN_TOKEN=atkn_...

# ── Phase 3: Voice Analysis ───────────────────────────────────────────────────

# Master switch — also enable the checkbox in Shopify theme block settings
VOICE_ANALYSIS_ENABLED=false

# STT provider: 'deepgram' (default)
VOICE_PROVIDER=deepgram

# Set true to also run AssemblyAI demographic analysis after transcription
VOICE_DEMOGRAPHICS_ENABLED=false

# Deepgram — required when VOICE_ANALYSIS_ENABLED=true
DEEPGRAM_API_KEY=...

# AssemblyAI — required only when VOICE_DEMOGRAPHICS_ENABLED=true
ASSEMBLYAI_API_KEY=...
```

---

## Minimum Setup (Core Chat Only)

If you only want the chat agent running without voice analysis:

```bash
CLAUDE_API_KEY=sk-ant-...
SHOPIFY_API_KEY=<from shopify.app.toml>
REDIRECT_URL=https://localhost:3458/auth/callback
```

Run the app:
```bash
cd shopify-app/shop-chat-agent
npm run dev
```

---

## Enabling Phase 3 Voice Analysis (Checklist)

- [ ] Deepgram account created and `DEEPGRAM_API_KEY` added to `.env`
- [ ] `VOICE_ANALYSIS_ENABLED=true` in `.env`
- [ ] App restarted (`npm run dev`)
- [ ] Shopify theme editor → AI Chat Assistant block → **"Enable Server-Side Voice Analysis"** checked
- [ ] (Optional) AssemblyAI key added and `VOICE_DEMOGRAPHICS_ENABLED=true` for sentiment analysis
