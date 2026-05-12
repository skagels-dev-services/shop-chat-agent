import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Use fake timers so AssemblyAI polling sleep() doesn't slow tests
vi.useFakeTimers();

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

const { transcribeAudio, analyzeVoiceDemographics, processVoiceTurn } =
  await import('../app/services/voice-analysis.server.js');

// ── helpers ────────────────────────────────────────────────────────────────

function makeAudioBlob(bytes = 1024) {
  return new Uint8Array(bytes).fill(0);
}

function deepgramSuccessResponse(transcript = 'hello world') {
  return {
    ok: true,
    json: async () => ({
      results: {
        channels: [{ alternatives: [{ transcript, confidence: 0.98 }] }],
      },
    }),
  };
}

function assemblyUploadResponse() {
  return { ok: true, json: async () => ({ upload_url: 'https://cdn.assemblyai.com/fake-audio' }) };
}

function assemblyCreateResponse(id = 'abc123') {
  return { ok: true, json: async () => ({ id }) };
}

function assemblyPollResponse(transcript = 'hello world') {
  return {
    ok: true,
    json: async () => ({
      id: 'abc123',
      status: 'completed',
      text: transcript,
      sentiment_analysis_results: [{ sentiment: 'NEUTRAL', confidence: 0.9 }],
    }),
  };
}

// Advance fake timers so polling sleep() resolves immediately
async function runAssemblyPoll() {
  await vi.runAllTimersAsync();
}

// ── transcribeAudio ────────────────────────────────────────────────────────

describe('transcribeAudio', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('returns a transcript string on success', async () => {
    mockFetch.mockResolvedValue(deepgramSuccessResponse("I'm looking for a snowboard"));
    const result = await transcribeAudio(makeAudioBlob(), 'audio/webm', 'fake-key');
    expect(result).toBe("I'm looking for a snowboard");
  });

  it('returns empty string when transcript is blank', async () => {
    mockFetch.mockResolvedValue(deepgramSuccessResponse(''));
    const result = await transcribeAudio(makeAudioBlob(), 'audio/webm', 'fake-key');
    expect(result).toBe('');
  });

  it('throws when Deepgram returns a non-ok HTTP status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad Request' });
    await expect(transcribeAudio(makeAudioBlob(), 'audio/webm', 'fake-key'))
      .rejects.toThrow(/transcription failed/i);
  });

  it('throws when fetch rejects (network error)', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));
    await expect(transcribeAudio(makeAudioBlob(), 'audio/webm', 'fake-key'))
      .rejects.toThrow('network error');
  });

  it('throws when API key is missing', async () => {
    await expect(transcribeAudio(makeAudioBlob(), 'audio/webm', ''))
      .rejects.toThrow(/api key/i);
  });

  it('throws when audio buffer is empty', async () => {
    await expect(transcribeAudio(new Uint8Array(0), 'audio/webm', 'fake-key'))
      .rejects.toThrow(/empty/i);
  });
});

// ── analyzeVoiceDemographics ───────────────────────────────────────────────

describe('analyzeVoiceDemographics', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('returns a demographics object with expected shape', async () => {
    mockFetch
      .mockResolvedValueOnce(assemblyUploadResponse())
      .mockResolvedValueOnce(assemblyCreateResponse())
      .mockResolvedValueOnce(assemblyPollResponse('test'));

    const promise = analyzeVoiceDemographics(makeAudioBlob(), 'audio/webm', 'fake-key');
    await runAssemblyPoll();
    const result = await promise;

    expect(result).toMatchObject({
      source: 'voice_analysis',
      confidence: expect.any(String),
    });
  });

  it('includes sentiment when available', async () => {
    mockFetch
      .mockResolvedValueOnce(assemblyUploadResponse())
      .mockResolvedValueOnce(assemblyCreateResponse())
      .mockResolvedValueOnce(assemblyPollResponse('test'));

    const promise = analyzeVoiceDemographics(makeAudioBlob(), 'audio/webm', 'fake-key');
    await runAssemblyPoll();
    const result = await promise;

    expect(result).toHaveProperty('sentiment');
  });

  it('returns null when API key is missing', async () => {
    const result = await analyzeVoiceDemographics(makeAudioBlob(), 'audio/webm', '');
    expect(result).toBeNull();
  });

  it('returns null on upload API error without throwing', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'error' });
    const result = await analyzeVoiceDemographics(makeAudioBlob(), 'audio/webm', 'fake-key');
    expect(result).toBeNull();
  });

  it('returns null on network error without throwing', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    const result = await analyzeVoiceDemographics(makeAudioBlob(), 'audio/webm', 'fake-key');
    expect(result).toBeNull();
  });
});

// ── processVoiceTurn ───────────────────────────────────────────────────────

describe('processVoiceTurn', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('returns transcript and null demographics when demographics disabled', async () => {
    mockFetch.mockResolvedValue(deepgramSuccessResponse('find me a jacket'));
    const result = await processVoiceTurn(makeAudioBlob(), 'audio/webm', {
      deepgramApiKey: 'dg-key',
      assemblyAiApiKey: '',
      demographicsEnabled: false,
    });
    expect(result.transcript).toBe('find me a jacket');
    expect(result.demographics).toBeNull();
  });

  it('returns both transcript and demographics when demographics enabled', async () => {
    mockFetch
      .mockResolvedValueOnce(deepgramSuccessResponse('find me a jacket'))
      .mockResolvedValueOnce(assemblyUploadResponse())
      .mockResolvedValueOnce(assemblyCreateResponse('x1'))
      .mockResolvedValueOnce(assemblyPollResponse('find me a jacket'));

    const promise = processVoiceTurn(makeAudioBlob(), 'audio/webm', {
      deepgramApiKey: 'dg-key',
      assemblyAiApiKey: 'aai-key',
      demographicsEnabled: true,
    });
    await runAssemblyPoll();
    const result = await promise;

    expect(result.transcript).toBe('find me a jacket');
    expect(result.demographics).not.toBeNull();
    expect(result.demographics.source).toBe('voice_analysis');
  });

  it('still returns transcript if demographics analysis fails', async () => {
    mockFetch
      .mockResolvedValueOnce(deepgramSuccessResponse('test message'))
      .mockRejectedValueOnce(new Error('assembly down'));

    const result = await processVoiceTurn(makeAudioBlob(), 'audio/webm', {
      deepgramApiKey: 'dg-key',
      assemblyAiApiKey: 'aai-key',
      demographicsEnabled: true,
    });
    expect(result.transcript).toBe('test message');
    expect(result.demographics).toBeNull();
  });

  it('throws when audio is empty', async () => {
    await expect(processVoiceTurn(new Uint8Array(0), 'audio/webm', {
      deepgramApiKey: 'dg-key',
      assemblyAiApiKey: '',
      demographicsEnabled: false,
    })).rejects.toThrow();
  });

  it('throws when deepgramApiKey is missing', async () => {
    await expect(processVoiceTurn(makeAudioBlob(), 'audio/webm', {
      deepgramApiKey: '',
      assemblyAiApiKey: '',
      demographicsEnabled: false,
    })).rejects.toThrow(/api key/i);
  });
});
