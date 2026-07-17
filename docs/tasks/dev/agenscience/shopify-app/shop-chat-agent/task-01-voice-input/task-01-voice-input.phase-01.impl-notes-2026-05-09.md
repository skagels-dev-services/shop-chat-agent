# Task 01 Implementation Notes (2026-05-09)

## Session Summary
This session focused on implementing and stabilizing the voice-input enhancement for the Shopify `shop-chat-agent`, plus fixing dev/runtime issues that blocked testing.

## What Was Implemented

### 1. Voice Input UX (Storefront Chat Widget)
- Added microphone button to the chat input area.
- Implemented browser speech recognition (`SpeechRecognition` / `webkitSpeechRecognition`) in the chat client.
- Added recording-state behavior for the mic button.
- Added explicit voice error handling paths for:
  - unsupported browser
  - blocked mic permission
  - missing audio device
  - no speech detected
  - network-related recognition errors

### 2. Live Listening Feedback
- Added a live status line in the chat window (`Listening...`) while voice capture is active.
- Status line clears automatically when capture ends, on failure, or when chat window closes.

### 3. Chat Endpoint Reliability in Theme Extension
- Removed hardcoded API assumptions by adding configurable API base URL support in the theme block settings.
- Added API URL fallback logic in chat client:
  - configured base URL
  - Shopify app proxy fallback (`/apps/shop-chat-agent`)
  - localhost fallback for local/dev workflows
- Improved chat transport error messaging to make misconfiguration visible to users during testing.

### 4. Prompt and Backend Context Plumbing for Demographics
- Added `demographicAssistant` system prompt option.
- Exposed `demographicAssistant` in theme block prompt selector.
- Added backend support for optional request payload `context.demographics`.
- Added Claude system prompt enrichment logic that appends demographics summary when provided.

## Important Clarification
Voice-driven demographic inference is **not fully implemented yet**.

Current behavior:
- Voice is converted to transcript in-browser and sent as normal chat text.

Not yet implemented:
- Server-side audio upload route (for example `api.transcribe`).
- Third-party voice analysis integration (Deepgram/AssemblyAI).
- Automatic extraction of demographic signals directly from audio.

## Dev/Environment Issues Resolved
- Fixed `npx prisma generate` startup failure (`prisma: command not found`) by restoring local package binaries (`node_modules/.bin`) via dependency reinstall.
- Fixed Shopify theme schema validation error by ensuring `api_base_url` setting default is non-blank.

## Files Touched (high level)
- `extensions/chat-bubble/assets/chat.js`
- `extensions/chat-bubble/assets/chat.css`
- `extensions/chat-bubble/blocks/chat-interface.liquid`
- `extensions/chat-bubble/locales/en.default.json`
- `app/routes/chat.jsx`
- `app/services/claude.server.js`
- `app/prompts/prompts.json`

## Testing Outcome
- Chat and mic UI now operate with clearer runtime behavior and diagnostics.
- Voice capture works in supported browsers when recording is allowed to complete.
- Remaining demographic-analysis objective requires Phase 2 implementation (audio pipeline + provider integration).

## Suggested Next Step
Implement Phase 2 endpoint and provider integration so each voice turn can optionally return:
- `transcript`
- `demographics` (with source + confidence)

Then pass that into existing `context.demographics` backend plumbing already added in this session.
