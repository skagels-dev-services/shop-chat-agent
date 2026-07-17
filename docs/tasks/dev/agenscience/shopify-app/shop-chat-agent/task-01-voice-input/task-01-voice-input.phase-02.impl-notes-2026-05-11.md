# Task 01 Implementation Notes — Phase 2 (2026-05-11)

## Session Summary

This session completed Phase 2 (Demographics from Customer Metafields) of the voice-input feature. Most backend plumbing for demographics had been added early during Phase 1; the remaining Phase 2 work was the system prompt update and establishing the test framework.

---

## What Was Implemented

### 1. Test Framework Setup
- Installed `vitest` as a dev dependency.
- Added `"test"` and `"test:watch"` npm scripts to `package.json`.
- Created `vitest.config.js` targeting `tests/**/*.test.js`.

### 2. Unit Tests for `claude.server.js` (TDD)
- Created `tests/claude.server.test.js` (17 tests).
- Tests cover: `getSystemPrompt` return shape, fallback behavior, demographics summary appending/omitting, field-level inclusion, unknown-field handling, and Phase 2 prompt content requirements.

### 3. Updated `demographicAssistant` System Prompt (v2.0)
- Instructs Claude to proactively call Customer Account MCP tools at conversation start.
- Retrieves `customer_profile` namespace metafields: `age_bracket`, `gender`, `price_sensitivity`, `preferred_style`.
- Metafield values treated as higher-confidence than voice-inferred signals.
- Graceful skip when customer is unauthenticated or tools unavailable.
- Explicit "do not reveal or disclose" rule for inferred demographics.

---

## Files Changed

| File | Change |
|---|---|
| `package.json` | Added `vitest` devDependency, `test` and `test:watch` scripts |
| `vitest.config.js` | **New** — vitest configuration |
| `tests/claude.server.test.js` | **New** — 17 unit tests for claude.server.js |
| `app/prompts/prompts.json` | Updated `demographicAssistant` to v2.0 |

---

## Test Results

17 tests passing in `tests/claude.server.test.js`.

Run with: `npm test`
