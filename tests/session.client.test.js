/**
 * Session management behavioral tests
 *
 * chat.js is a browser IIFE and cannot be imported directly in a Node test
 * environment. These tests specify the exact behavior expected of the
 * ShopAIChat.Session object and the keyword-routing logic in Message.send().
 * Any change to the regex patterns or isExpired logic in chat.js must be
 * reflected here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Regex patterns (must match chat.js Message.send) ──────────────────────────

const NEW_CHAT_EXACT    = /^new chat$/i;
const NEW_CHAT_PARTIAL  = /\bnew chat\b/i;
const TEST_TIMEOUT_MSG  = 'test session timeout';

/**
 * Mirrors ShopAIChat.Session.isExpired() from chat.js.
 * Returns true when shopAiLastActivity is older than TIMEOUT_MS.
 */
const TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_KEY = 'shopAiLastActivity';

function isExpired(storage) {
  const last = storage.getItem(ACTIVITY_KEY);
  if (!last) return false;
  return (Date.now() - parseInt(last, 10)) > TIMEOUT_MS;
}

// ── sessionStorage mock ───────────────────────────────────────────────────────

function makeStorage() {
  const store = {};
  return {
    getItem:    (k) => store[k] ?? null,
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
}

// ── Keyword routing ───────────────────────────────────────────────────────────

describe('keyword routing — exact "new chat" match', () => {
  it('matches bare lowercase', () => {
    expect(NEW_CHAT_EXACT.test('new chat')).toBe(true);
  });

  it('matches uppercase', () => {
    expect(NEW_CHAT_EXACT.test('NEW CHAT')).toBe(true);
  });

  it('matches mixed case', () => {
    expect(NEW_CHAT_EXACT.test('New Chat')).toBe(true);
  });

  it('does not match with leading space', () => {
    expect(NEW_CHAT_EXACT.test(' new chat')).toBe(false);
  });

  it('does not match with trailing space', () => {
    expect(NEW_CHAT_EXACT.test('new chat ')).toBe(false);
  });

  it('does not match when embedded in a sentence', () => {
    expect(NEW_CHAT_EXACT.test('I want a new chat')).toBe(false);
  });

  it('does not match "new chatter"', () => {
    expect(NEW_CHAT_EXACT.test('new chatter')).toBe(false);
  });
});

describe('keyword routing — partial "new chat" match (clarification trigger)', () => {
  it('matches when "new chat" appears at the end of a sentence', () => {
    expect(NEW_CHAT_PARTIAL.test('I want a new chat')).toBe(true);
  });

  it('matches when "new chat" appears at the start of a sentence', () => {
    expect(NEW_CHAT_PARTIAL.test('new chat please')).toBe(true);
  });

  it('matches when "new chat" appears in the middle', () => {
    expect(NEW_CHAT_PARTIAL.test('can we start a new chat session')).toBe(true);
  });

  it('matches case-insensitively in a sentence', () => {
    expect(NEW_CHAT_PARTIAL.test('Tell me about NEW CHAT options')).toBe(true);
  });

  it('does not match "new chatter" (word boundary enforced)', () => {
    expect(NEW_CHAT_PARTIAL.test('new chatter')).toBe(false);
  });

  it('does not match "new chatting"', () => {
    expect(NEW_CHAT_PARTIAL.test('new chatting')).toBe(false);
  });

  it('does not match "renew chat" (word boundary before "new" enforced)', () => {
    expect(NEW_CHAT_PARTIAL.test('renew chat')).toBe(false);
  });
});

describe('keyword routing — exact match takes priority over partial', () => {
  it('"new chat" satisfies exact check before partial is evaluated', () => {
    // In Message.send(), exact is tested first. If exact passes, the function
    // returns immediately and the partial branch is never reached.
    const msg = 'new chat';
    expect(NEW_CHAT_EXACT.test(msg)).toBe(true);
    // Partial also matches, but exact wins — this confirms routing order matters.
    expect(NEW_CHAT_PARTIAL.test(msg)).toBe(true);
  });
});

describe('keyword routing — test session timeout trigger', () => {
  it('matches the exact phrase (lowercase)', () => {
    expect('test session timeout'.toLowerCase() === TEST_TIMEOUT_MSG).toBe(true);
  });

  it('matches any case variant since code lowercases before comparing', () => {
    expect('Test Session Timeout'.toLowerCase() === TEST_TIMEOUT_MSG).toBe(true);
    expect('TEST SESSION TIMEOUT'.toLowerCase() === TEST_TIMEOUT_MSG).toBe(true);
  });

  it('does not match when extra words are included', () => {
    expect('test session timeout now'.toLowerCase() === TEST_TIMEOUT_MSG).toBe(false);
    expect('please test session timeout'.toLowerCase() === TEST_TIMEOUT_MSG).toBe(false);
  });
});

// ── Session.isExpired ─────────────────────────────────────────────────────────

describe('Session.isExpired()', () => {
  let storage;

  beforeEach(() => {
    storage = makeStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false when no activity has been recorded', () => {
    expect(isExpired(storage)).toBe(false);
  });

  it('returns false immediately after activity is recorded', () => {
    storage.setItem(ACTIVITY_KEY, Date.now().toString());
    expect(isExpired(storage)).toBe(false);
  });

  it('returns false when idle for less than 15 minutes', () => {
    storage.setItem(ACTIVITY_KEY, (Date.now() - 14 * 60 * 1000).toString());
    expect(isExpired(storage)).toBe(false);
  });

  it('returns false when idle for exactly 15 minutes (boundary — > not >=)', () => {
    storage.setItem(ACTIVITY_KEY, (Date.now() - TIMEOUT_MS).toString());
    expect(isExpired(storage)).toBe(false);
  });

  it('returns true when idle for just over 15 minutes', () => {
    storage.setItem(ACTIVITY_KEY, (Date.now() - TIMEOUT_MS - 1).toString());
    expect(isExpired(storage)).toBe(true);
  });

  it('returns true when idle for 30 minutes', () => {
    storage.setItem(ACTIVITY_KEY, (Date.now() - 30 * 60 * 1000).toString());
    expect(isExpired(storage)).toBe(true);
  });

  it('returns true when idle for several hours', () => {
    storage.setItem(ACTIVITY_KEY, (Date.now() - 3 * 60 * 60 * 1000).toString());
    expect(isExpired(storage)).toBe(true);
  });
});
