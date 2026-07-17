# Tech Spec: Voice Input with Demographic Analysis
**Task:** task-01-voice-input  
**Date:** 2026-05-05  
**Status:** Draft — awaiting review

---

## Overview

This spec describes how to add voice input to the shop chat agent and use voice-derived and account-derived demographic signals to personalize the agent's responses. It also covers the price elasticity optimization referenced in the task.

---

## Answering the Task's Open Questions

### Does the chat agent support voice/mic input today?
No. The existing chat UI accepts only typed text. The backend (`chat.jsx`) accepts a `message` string in the POST body — voice support must be added at the frontend level before anything reaches the server.

### Is there anything off the shelf that already analyzes voice?
Yes. The most relevant options are covered in the [Third-Party Services](#third-party-services) section. The short answer is: speech-to-text (STT) is a commodity; demographic inference from voice (age, gender, accent) is a specialized, ethically sensitive capability available from a small number of vendors.

### Can an agent determine gender, age, education from voice?
- **Gender:** Detectable with reasonable accuracy from pitch/formant analysis (available in AssemblyAI, Deepgram, and others as an add-on).
- **Age:** Estimable within a bracket (e.g., child / young adult / adult / senior) but not precisely. AssemblyAI and specialized vendors (e.g., Behavioral Signals) offer this.
- **Education level:** Not reliably inferable from voice alone. This is better sourced from Customer Account Metafields if the merchant has collected it explicitly.
- **NLP built-in or 3rd party:** A separate third-party service is required. Neither Claude nor Shopify provide this natively.

**Recommendation:** Treat voice-inferred demographics as a low-confidence signal, supplement with (higher-confidence) Shopify Customer Account Metafields, and always disclose to the customer what is being analyzed.

---

## Architecture Overview

```
Browser (Chat Widget)
  │
  ├─ Web Speech API ──► transcribed text ──► existing chat POST /chat
  │       (primary, free, no backend needed)
  │
  └─ MediaRecorder API ──► audio blob ──► POST /api/transcribe+analyze
          (fallback / richer analysis)              │
                                                    ├─ STT (Deepgram or Whisper)
                                                    └─ Voice Analysis (AssemblyAI)
                                                           │
                                                    demographic signals
                                                           │
                                              injected into system prompt context
                                                    or passed as metadata
                                                           │
                                              Claude agent ──► Customer Accounts MCP
                                                           └─► StoreFront MCP
```

The existing `/chat` SSE endpoint and `claude.server.js` require **minimal changes** — demographic context is injected at the system prompt level, not in the message content.

---

## Component Design

### 1. Voice Input (Browser — New)

**File:** A new React component, e.g. `app/components/VoiceInputButton.jsx`, embedded in the chat widget (currently a Shopify theme extension or standalone embed).

**Approach A — Web Speech API (recommended for MVP)**
- Native browser API, zero cost, zero backend changes for transcription.
- `SpeechRecognition` / `webkitSpeechRecognition` is supported in Chrome, Edge, Safari 14.1+; not supported in Firefox.
- When recognition ends, the transcript is placed into the chat text field and submitted normally.
- No audio is recorded or sent to any server.

```js
// Pseudocode
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'en-US';
recognition.interimResults = false;
recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  submitChatMessage(transcript);  // calls existing POST /chat
};
recognition.start();
```

**Approach B — MediaRecorder + Server-side STT (fallback / richer analysis)**
- Captures raw audio using `MediaRecorder` API (supported in all modern browsers).
- Audio blob posted to a new backend route `/api/transcribe`.
- Backend calls Deepgram or OpenAI Whisper for transcription.
- Also calls AssemblyAI for demographic signals (see Section 3).
- Returns `{ transcript, demographics }` to the client.
- Client submits `transcript` to `/chat` with a `demographics` metadata field.

**Implementation plan:** Ship Approach A for MVP (gets voice input working immediately with no new dependencies), then layer in Approach B once a third-party vendor is selected and privacy consent is resolved.

---

### 2. Backend Transcription Route (Approach B only)

**File:** `app/routes/api.transcribe.jsx`

**Request:** `POST /api/transcribe` with `multipart/form-data`, field `audio` (WebM or MP4 blob).

**Response:**
```json
{
  "transcript": "I'm looking for a snowboard for a beginner",
  "demographics": {
    "source": "voice_analysis",
    "confidence": "low",
    "estimated_gender": "male",
    "estimated_age_bracket": "young_adult",
    "sentiment": "neutral"
  }
}
```

**Backend processing:**
1. Receive audio blob (max ~60 s for a chat turn).
2. Call Deepgram Nova-2 (or OpenAI Whisper) for transcription — Deepgram is preferred for latency (streaming transcription, ~300 ms TTFT).
3. Optionally call AssemblyAI Speaker Diarization + demographic model if voice analysis consent has been given.
4. Return transcript + optional demographics JSON.

**New env vars required:**
```
DEEPGRAM_API_KEY=...
ASSEMBLYAI_API_KEY=...   # only if voice demographics enabled
```

---

### 3. Voice Demographic Analysis

**What is analyzed and why:**

| Signal | Inference Method | Confidence | Use in Agent |
|---|---|---|---|
| Gender | Voice pitch/formant (AssemblyAI) | Medium | Product tone, pronoun use |
| Age bracket | Voice acoustic model (AssemblyAI) | Low–Medium | Product complexity, budget framing |
| Sentiment / Emotion | Prosody analysis | Medium | Urgency, concern detection |
| Education level | Not from voice; retrieve from Customer Metafields if stored | N/A | Language register |

**Recommended vendor:** AssemblyAI  
- Offers STT + Speaker Analysis in one API call.  
- Has `speaker_labels`, `sentiment_analysis`, and (via the Universal-2 model + add-ons) basic speaker demographic scoring.  
- GDPR/CCPA compliant data processing agreements available.  
- Pricing: ~$0.65/hr transcription + add-on cost for analysis.

**Alternative if voice demographics are descoped:** Deepgram Nova-2 for STT only (~$0.0043/min), and rely entirely on Shopify Customer Account Metafields for demographics. This is the lower-risk path.

---

### 4. Demographics Integration with the Agent

Voice-derived demographics and Shopify Customer Account Metafields are combined into a **demographics context object** that is injected into the Claude system prompt at the start of the conversation.

**New prompt type:** `demographicAssistant` (added to `prompts.json`)

The system prompt instructs Claude to:
- Adjust vocabulary complexity based on estimated education/age bracket.
- Frame product recommendations around inferred price sensitivity.
- Use neutral language if gender/demographics are unknown.
- Never reveal to the customer what demographic inferences have been made.

**Flow change in `chat.jsx`:**

```
POST /chat body:
{
  "message": "...",
  "conversation_id": "...",
  "prompt_type": "demographicAssistant",   // new
  "context": {                              // new optional field
    "demographics": {
      "source": "voice_analysis | metafield | none",
      "estimated_gender": "...",
      "estimated_age_bracket": "...",
      "price_sensitivity": "high | medium | low"  // derived from Customer Metafields
    }
  }
}
```

The `handleChatSession` function in `chat.jsx` passes `context.demographics` to `createClaudeService`, which prepends a demographics preamble to the system prompt.

**Changes to `claude.server.js`:**  
Add an optional `demographicsContext` parameter to `streamConversation`. If present, prepend a short demographic context block to `systemInstruction` before calling the Claude API. The block is a brief, structured summary (not raw JSON) such as:

> "Customer context (use to personalize, do not disclose): likely young adult male, moderate price sensitivity."

---

### 5. Customer Account Metafields for Demographics

The agent already has access to the Customer Accounts MCP. The MCP can retrieve customer metafields set by the merchant.

**Recommended Metafield namespace/keys** (merchant configures these once in Shopify):

| Namespace | Key | Type | Example |
|---|---|---|---|
| `customer_profile` | `age_bracket` | `single_line_text_field` | `"young_adult"` |
| `customer_profile` | `gender` | `single_line_text_field` | `"male"` |
| `customer_profile` | `price_sensitivity` | `single_line_text_field` | `"high"` |
| `customer_profile` | `preferred_style` | `single_line_text_field` | `"performance"` |

**Agent behavior:** At the start of a conversation (when a customer is authenticated), the agent automatically calls the Customer Accounts MCP to retrieve these metafields. Metafield values override or supplement voice-inferred values (metafields = higher confidence).

This requires no new server code — the existing MCP tool call mechanism handles it. A new system prompt instruction is added telling Claude to make this tool call at conversation start.

---

### 6. Price Elasticity via Product Metafields

**Recommended Metafield** (merchant configures per product):

| Namespace | Key | Type | Example |
|---|---|---|---|
| `pricing` | `price_elasticity` | `number_decimal` | `1.8` (elastic) or `0.4` (inelastic) |

**Agent behavior:** When the agent calls `search_shop_catalog` (existing StoreFront MCP tool), it retrieves products with their metafields. The system prompt instructs Claude to:
- For **price-elastic products** (elasticity > 1.0): emphasize value, promotions, and competitive pricing; present lower-priced options first.
- For **price-inelastic products** (elasticity < 1.0): emphasize quality and unique features; price is less central.
- Cross-reference with customer `price_sensitivity` metafield to further tune recommendations.

This is entirely a **system prompt + agent reasoning change** — no new API calls are needed beyond what already exists. The agent queries metafields via MCP tool calls.

---

## Privacy and Ethics

Voice demographic analysis carries significant regulatory and ethical risk. The following constraints must be respected:

1. **Consent first:** The microphone must only activate after the customer explicitly clicks a mic button. A visible indicator must show when recording is active.
2. **Disclosure:** If voice analysis (beyond STT) is performed, the customer must be informed before recording starts (e.g., "Your voice may be analyzed to personalize your experience."). This is required under GDPR and CCPA.
3. **No raw audio storage:** Audio blobs must not be persisted. Only the transcript and derived signals are stored, if at all.
4. **Demographic signals are hints, not rules:** The agent must never discriminate (e.g., refuse to show premium products to a customer with "high price sensitivity"). It uses demographics to *order* or *frame* suggestions, not to exclude.
5. **No disclosure of inferences to customer:** Claude must not tell the customer what it has inferred about them.
6. **Data minimization:** If the merchant has not configured Customer Metafields and voice analysis is disabled, the agent operates without any demographic context — this is the safe default.

**Recommendation:** Ship Approach A (Web Speech API, no voice analytics) first. Voice demographic analysis (Approach B) should be a separately toggled feature requiring explicit merchant opt-in and customer consent UI.

---

## Third-Party Services

| Service | Role | Pricing (approx.) | Notes |
|---|---|---|---|
| Web Speech API | STT in browser | Free | Chrome/Edge/Safari only; no server needed |
| Deepgram Nova-2 | Server-side STT | ~$0.0043/min | Best latency, good accuracy |
| OpenAI Whisper | Server-side STT | ~$0.006/min | Broad language support |
| AssemblyAI Universal-2 | STT + speaker demographics | ~$0.65/hr + add-ons | Best option for combined STT + demographics |
| Azure Cognitive Services | STT + speaker ID | Pay-per-use | Enterprise option; no demographic inference |

**Recommended selection:**
- MVP: Web Speech API (no cost, no new dependencies)
- Phase 2: Deepgram (STT only) or AssemblyAI (STT + demographics)

---

## Files Changed / Created

| File | Change |
|---|---|
| `app/components/VoiceInputButton.jsx` | **New** — microphone button component, Web Speech API |
| `app/routes/api.transcribe.jsx` | **New** — server-side STT + voice analysis route (Phase 2) |
| `app/services/voice-analysis.server.js` | **New** — AssemblyAI/Deepgram client wrapper (Phase 2) |
| `app/services/claude.server.js` | **Modified** — accept optional `demographicsContext` param |
| `app/routes/chat.jsx` | **Modified** — accept `context.demographics` in request body |
| `app/prompts/prompts.json` | **Modified** — add `demographicAssistant` prompt type |
| `app/services/config.server.js` | **Modified** — add voice feature flags |
| `.env.example` | **Modified** — add `DEEPGRAM_API_KEY`, `ASSEMBLYAI_API_KEY` |

No Prisma schema changes are required for MVP. Phase 2 may add a `VoiceDemographics` table if the agent needs to persist inferred demographics across sessions.

---

## Phased Delivery

### Phase 1 — MVP Voice Input (no new dependencies)
- Add `VoiceInputButton` component using Web Speech API.
- Transcribed text populates the chat input field; submitted via existing POST `/chat`.
- No demographic analysis. No backend changes.

### Phase 2 — Demographics from Customer Metafields
- Update system prompt to query Customer Account Metafields at conversation start.
- Add `demographicAssistant` prompt type.
- Modify `chat.jsx` to accept and forward demographics context.
- Modify `claude.server.js` to prepend demographics preamble.

### Phase 3 — Voice Analytics + Price Elasticity
- Add `/api/transcribe` route with Deepgram/AssemblyAI integration.
- Add consent disclosure UI before first voice analysis.
- Add price elasticity logic to system prompt.
- Merchant configures Product and Customer Metafields in Shopify admin.

---

## Open Questions for Review

1. **Consent UI:** What copy and UX should be used for the voice analysis disclosure? Should it be a one-time modal or inline tooltip?
2. **Metafield source:** Will the merchant populate customer demographic metafields manually, via import, or via a separate onboarding flow? This affects whether Phase 2 delivers real value before Phase 3.
3. **Price elasticity data:** Does the merchant already have price elasticity values per product, or does this need to be calculated? If calculated, by what method?
4. **Feature flags:** Should voice analysis be on by default for all shops or must each merchant opt in?
5. **Firefox support:** The Web Speech API is not supported in Firefox. Is a server-side fallback (MediaRecorder + Deepgram) required for MVP, or is Chrome/Safari sufficient for the initial demo?
