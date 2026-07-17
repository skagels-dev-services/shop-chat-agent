/**
 * POST /api/transcribe
 * Receives an audio blob, runs STT via Deepgram, and optionally runs
 * demographic analysis via AssemblyAI. Returns transcript + demographics.
 */
import AppConfig from '../services/config.server';
import { processVoiceTurn } from '../services/voice-analysis.server';

const MAX_AUDIO_BYTES = AppConfig.voice.maxAudioSeconds * 16000 * 2; // ~60 s at 16kHz 16-bit

// Handle CORS preflight
export async function loader({ request }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders(request) });
}

export async function action({ request }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, request);
  }

  if (!AppConfig.voice.enabled) {
    return json({ error: 'Voice analysis is not enabled' }, 503, request);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Invalid multipart/form-data body' }, 400, request);
  }

  const audioFile = formData.get('audio');

  if (!audioFile || typeof audioFile === 'string') {
    return json({ error: 'Missing audio field in form data' }, 400, request);
  }

  const audioBuffer = await audioFile.arrayBuffer();

  if (!audioBuffer || audioBuffer.byteLength === 0) {
    return json({ error: 'Audio blob is empty' }, 400, request);
  }

  if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
    return json({ error: `Audio exceeds maximum length of ${AppConfig.voice.maxAudioSeconds} seconds` }, 400, request);
  }

  const mimeType = audioFile.type || 'audio/webm';

  try {
    const { transcript, demographics } = await processVoiceTurn(
      audioBuffer,
      mimeType,
      {
        deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
        assemblyAiApiKey: process.env.ASSEMBLYAI_API_KEY || '',
        demographicsEnabled: AppConfig.voice.demographicsEnabled,
      }
    );

    return json({ transcript, demographics }, 200, request);
  } catch (error) {
    console.error('Transcription error:', error);
    return json({ error: 'Transcription failed. Please try again.' }, 500, request);
  }
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function json(data, status = 200, request = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(request ? corsHeaders(request) : {}),
    },
  });
}
