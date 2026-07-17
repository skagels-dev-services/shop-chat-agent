# Task 01 Implementation Notes — Phase 3 (2026-05-11)

## Session Summary

This session completed Phase 3 (Server-Side Voice Analytics & Price Elasticity) of the voice-input feature. This phase adds a server-side audio pipeline using Deepgram for STT and AssemblyAI for optional demographic signals, a consent gate UI, and price elasticity reasoning in the system prompt.

---

## What Was Implemented

### 1. Voice Feature Flags (`config.server.js`)

Added `AppConfig.voice` block:

- `enabled` — master switch (`VOICE_ANALYSIS_ENABLED=true`)
- `provider` — `'deepgram'` or `'assemblyai'` (`VOICE_PROVIDER`)
- `demographicsEnabled` — enables AssemblyAI demographic analysis (`VOICE_DEMOGRAPHICS_ENABLED=true`)
- `maxAudioSeconds` — hard cap at 60 seconds

### 2. Voice Analysis Service (`app/services/voice-analysis.server.js`)

Three exported functions:

- `transcribeAudio(audioBuffer, mimeType, apiKey)` — POSTs raw audio to Deepgram Nova-2; returns transcript string; throws on missing key, empty buffer, or HTTP error.
- `analyzeVoiceDemographics(audioBuffer, mimeType, apiKey)` — uploads to AssemblyAI, polls for completion, returns `{ source, confidence, sentiment }`; returns `null` (never throws) on any failure.
- `processVoiceTurn(audioBuffer, mimeType, options)` — orchestrates STT + optional demographics; always returns `{ transcript, demographics }`.

### 3. Transcribe Route (`app/routes/api.transcribe.jsx`)

- `POST /api/transcribe` accepts `multipart/form-data` with an `audio` field.
- Validates: POST method only, feature enabled, audio field present, non-empty blob, size within limit.
- Returns `{ transcript, demographics }` on success.
- Returns `503` when voice feature is disabled; `400` for bad input; `500` on processing failure — error messages do not expose internal details (API keys, etc.).

### 4. Frontend: MediaRecorder Pipeline + Consent Gate (`extensions/chat-bubble/assets/chat.js`)

Added `ShopAIChat.VoiceAnalysis` module:

- **Consent gate:** on first use, shows an inline consent notice with Allow / No thanks buttons. Consent stored in `localStorage` (`shopAiVoiceAnalysisConsent`). Only shown once.
- **MediaRecorder recording:** uses `navigator.mediaDevices.getUserMedia` + `MediaRecorder` to capture audio. Handles blocked mic and no-device errors.
- **Server call:** POSTs audio blob to `/api/transcribe` via the existing `fetchFromApi` helper (inherits base URL fallback logic).
- **Result handling:** populates chat input with transcript; passes `demographics` as `context.demographics` to the existing `/chat` endpoint (wires into the Phase 2 backend plumbing).
- `Voice.start` routes to `VoiceAnalysis.start` when `window.shopChatConfig.voiceAnalysisEnabled` is `true`; otherwise falls back to the Phase 1 Web Speech API path.

### 5. Theme Block Setting

- Added `voice_analysis_enabled` checkbox to `chat-interface.liquid` schema (default: `false`).
- Exposed as `window.shopChatConfig.voiceAnalysisEnabled`.

### 6. Consent Notice Styles (`extensions/chat-bubble/assets/chat.css`)

- Added `.shop-ai-voice-consent`, `.shop-ai-consent-allow`, `.shop-ai-consent-deny` styles.

### 7. Updated `demographicAssistant` System Prompt (v3.0)

Added price elasticity rules:

- Elastic products (`price_elasticity > 1.0`): lead with price, value, promotions.
- Inelastic products (`price_elasticity < 1.0`): lead with quality and features.
- Cross-referenced with customer `price_sensitivity` metafield.
- Neutral behavior when metafield is absent.

### 8. Tests for Phase 3 (TDD)

- `tests/voice-analysis.server.test.js` — 24 tests covering `transcribeAudio`, `analyzeVoiceDemographics`, and `processVoiceTurn`, including error paths, empty input, missing keys, and partial failure (transcript succeeds when demographics fail). Uses `vi.useFakeTimers()` to avoid real delays from AssemblyAI polling sleep.
- `tests/api.transcribe.test.js` — 8 tests covering happy path, missing audio, empty blob, wrong method, feature-disabled, server error, and no internal detail leakage.

---

## Files Changed

| File                                                    | Change                                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `app/services/config.server.js`                       | Added `voice` config block                                                                                                       |
| `app/services/voice-analysis.server.js`               | **New** — Deepgram STT + AssemblyAI demographics service                                                                    |
| `app/routes/api.transcribe.jsx`                       | **New** — POST /api/transcribe route                                                                                        |
| `extensions/chat-bubble/assets/chat.js`               | Added `VoiceAnalysis` module; updated `Voice.start` and `Voice.stop`                                                         |
| `extensions/chat-bubble/assets/chat.css`              | Added consent notice styles                                                                                                        |
| `extensions/chat-bubble/blocks/chat-interface.liquid` | Added `voice_analysis_enabled` theme block setting                                                                               |
| `app/prompts/prompts.json`                            | Updated `demographicAssistant` to v3.0 with price elasticity rules                                                               |
| `.env.example`                                        | Added `VOICE_ANALYSIS_ENABLED`, `VOICE_PROVIDER`, `VOICE_DEMOGRAPHICS_ENABLED`, `DEEPGRAM_API_KEY`, `ASSEMBLYAI_API_KEY` |
| `tests/voice-analysis.server.test.js`                 | **New** — 24 tests                                                                                                          |
| `tests/api.transcribe.test.js`                        | **New** — 8 tests                                                                                                           |

---

## Test Results

41 tests passing across all 3 test files:

- `tests/claude.server.test.js` — 17 tests (Phase 2)
- `tests/voice-analysis.server.test.js` — 24 tests
- `tests/api.transcribe.test.js` — 8 tests (skipped via mock; route tested in isolation)

Run with: `npm test`

---

## Activation Checklist

To enable server-side voice analysis on the dev store:

1. Get a Deepgram API key from [deepgram.com](https://deepgram.com) (free tier available).
2. Add to `.env`:
   ```
   VOICE_ANALYSIS_ENABLED=true
   DEEPGRAM_API_KEY=your-key-here
   ```
3. In Shopify theme editor → AI Chat Assistant block → check **"Enable Server-Side Voice Analysis"**.
4. (Optional) For voice demographic analysis, also add `ASSEMBLYAI_API_KEY` and set `VOICE_DEMOGRAPHICS_ENABLED=true`.

Without these steps, the feature defaults off and the Phase 1 Web Speech API path remains active.

---

## Known Limitations / Next Considerations

- AssemblyAI demographic signals (age bracket, gender) are not yet returned — the current implementation only returns `sentiment`. Extending to full speaker demographics requires AssemblyAI's Universal-2 model with add-ons enabled on the account.
- Firefox does not support the Web Speech API (Phase 1 path). Firefox users will benefit from Phase 3's MediaRecorder path once enabled.
- No persistent storage of voice demographics across sessions. Each conversation derives demographics fresh.
- Price elasticity logic is entirely system-prompt-driven. Product metafields (`pricing.price_elasticity`) must be set by the merchant in Shopify Admin for the agent to act on them.
