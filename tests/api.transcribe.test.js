import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../app/services/voice-analysis.server.js', () => ({
  processVoiceTurn: vi.fn(),
}));

vi.mock('../app/services/config.server.js', () => ({
  default: {
    voice: {
      enabled: true,
      provider: 'deepgram',
      demographicsEnabled: false,
      maxAudioSeconds: 60,
    },
  },
  AppConfig: {
    voice: {
      enabled: true,
      provider: 'deepgram',
      demographicsEnabled: false,
      maxAudioSeconds: 60,
    },
  },
}));

const { processVoiceTurn } = await import('../app/services/voice-analysis.server.js');
const { action, loader } = await import('../app/routes/api.transcribe.jsx');

// ── helpers ────────────────────────────────────────────────────────────────

function makeFormData(audioBlob, mimeType = 'audio/webm') {
  const fd = new FormData();
  fd.append('audio', new Blob([audioBlob], { type: mimeType }), 'audio.webm');
  return fd;
}

function makeRequest(formData, method = 'POST') {
  return new Request('http://localhost/api/transcribe', {
    method,
    body: formData,
  });
}

// ── action (POST /api/transcribe) ──────────────────────────────────────────

describe('POST /api/transcribe', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 200 with transcript and null demographics on success', async () => {
    processVoiceTurn.mockResolvedValue({ transcript: 'hello world', demographics: null });

    const req = makeRequest(makeFormData(new Uint8Array(512)));
    const res = await action({ request: req });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.transcript).toBe('hello world');
    expect(body.demographics).toBeNull();
  });

  it('returns 200 with demographics when voice analysis is present', async () => {
    const demographics = { source: 'voice_analysis', confidence: 'low', sentiment: 'neutral' };
    processVoiceTurn.mockResolvedValue({ transcript: 'show me boots', demographics });

    const req = makeRequest(makeFormData(new Uint8Array(512)));
    const res = await action({ request: req });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.demographics).toMatchObject({ source: 'voice_analysis' });
  });

  it('returns 400 when no audio field is present in the form', async () => {
    const fd = new FormData();
    const req = makeRequest(fd);
    const res = await action({ request: req });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/audio/i);
  });

  it('returns 400 when audio blob is empty', async () => {
    const req = makeRequest(makeFormData(new Uint8Array(0)));
    const res = await action({ request: req });

    expect(res.status).toBe(400);
  });

  it('returns 405 for GET requests', async () => {
    const req = new Request('http://localhost/api/transcribe', { method: 'GET' });
    const res = await action({ request: req });

    expect(res.status).toBe(405);
  });

  it('returns 503 when voice feature is disabled', async () => {
    const { default: AppConfig } = await import('../app/services/config.server.js');
    const original = AppConfig.voice.enabled;
    AppConfig.voice.enabled = false;

    const req = makeRequest(makeFormData(new Uint8Array(512)));
    const res = await action({ request: req });

    expect(res.status).toBe(503);
    AppConfig.voice.enabled = original;
  });

  it('returns 500 when processVoiceTurn throws', async () => {
    processVoiceTurn.mockRejectedValue(new Error('deepgram down'));

    const req = makeRequest(makeFormData(new Uint8Array(512)));
    const res = await action({ request: req });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('includes CORS Access-Control-Allow-Origin header on success', async () => {
    processVoiceTurn.mockResolvedValue({ transcript: 'hello', demographics: null });
    const req = makeRequest(makeFormData(new Uint8Array(512)));
    const res = await action({ request: req });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });

  it('responds 204 to OPTIONS preflight via action', async () => {
    const req = new Request('http://localhost/api/transcribe', { method: 'OPTIONS' });
    const res = await action({ request: req });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('responds 204 to OPTIONS preflight via loader', async () => {
    const req = new Request('http://localhost/api/transcribe', { method: 'OPTIONS' });
    const res = await loader({ request: req });
    expect(res.status).toBe(204);
  });

  it('returns 500 and does not expose internal error details to client', async () => {
    processVoiceTurn.mockRejectedValue(new Error('secret internal error with api key abc123'));

    const req = makeRequest(makeFormData(new Uint8Array(512)));
    const res = await action({ request: req });
    const body = await res.json();

    expect(body.error).not.toContain('abc123');
  });
});
