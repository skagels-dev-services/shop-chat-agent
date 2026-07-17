/**
 * Voice Analysis Service
 * Handles speech-to-text via Deepgram and optional demographic analysis via AssemblyAI.
 */

const DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true';
const ASSEMBLYAI_UPLOAD_URL = 'https://api.assemblyai.com/v2/upload';
const ASSEMBLYAI_TRANSCRIPT_URL = 'https://api.assemblyai.com/v2/transcript';
const ASSEMBLYAI_POLL_INTERVAL_MS = 2000;
const ASSEMBLYAI_POLL_MAX_ATTEMPTS = 30;

/**
 * Transcribes audio using Deepgram Nova-2.
 * @param {Uint8Array|ArrayBuffer} audioBuffer - Raw audio bytes
 * @param {string} mimeType - MIME type (e.g. 'audio/webm')
 * @param {string} apiKey - Deepgram API key
 * @returns {Promise<string>} Transcript text
 */
export async function transcribeAudio(audioBuffer, mimeType, apiKey) {
  if (!apiKey) {
    throw new Error('Deepgram API key is required');
  }

  if (!audioBuffer || audioBuffer.byteLength === 0 || audioBuffer.length === 0) {
    throw new Error('Audio buffer is empty');
  }

  const response = await fetch(DEEPGRAM_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': mimeType,
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Transcription failed: ${response.status} ${detail}`);
  }

  const data = await response.json();
  return data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
}

/**
 * Analyzes voice audio for demographic signals using AssemblyAI.
 * Returns null (never throws) so a failed analysis never blocks transcription.
 * @param {Uint8Array|ArrayBuffer} audioBuffer - Raw audio bytes
 * @param {string} mimeType - MIME type
 * @param {string} apiKey - AssemblyAI API key
 * @returns {Promise<Object|null>} Demographics object or null
 */
export async function analyzeVoiceDemographics(audioBuffer, mimeType, apiKey) {
  if (!apiKey) return null;

  try {
    // Upload audio
    const uploadRes = await fetch(ASSEMBLYAI_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': mimeType,
      },
      body: audioBuffer,
    });

    if (!uploadRes.ok) return null;

    const { upload_url } = await uploadRes.json();

    // Request transcript with sentiment analysis
    const transcriptRes = await fetch(ASSEMBLYAI_TRANSCRIPT_URL, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        sentiment_analysis: true,
      }),
    });

    if (!transcriptRes.ok) return null;

    const { id } = await transcriptRes.json();

    // Poll for completion
    const result = await pollAssemblyAI(id, apiKey);
    if (!result) return null;

    return buildDemographicsFromAssemblyAI(result);
  } catch {
    return null;
  }
}

/**
 * Polls AssemblyAI until the transcript is complete or max attempts reached.
 * @param {string} transcriptId
 * @param {string} apiKey
 * @returns {Promise<Object|null>}
 */
async function pollAssemblyAI(transcriptId, apiKey) {
  for (let i = 0; i < ASSEMBLYAI_POLL_MAX_ATTEMPTS; i++) {
    await sleep(ASSEMBLYAI_POLL_INTERVAL_MS);

    const res = await fetch(`${ASSEMBLYAI_TRANSCRIPT_URL}/${transcriptId}`, {
      headers: { 'Authorization': apiKey },
    });

    if (!res.ok) return null;

    const data = await res.json();

    if (data.status === 'completed') return data;
    if (data.status === 'error') return null;
  }

  return null;
}

/**
 * Maps AssemblyAI transcript result to the demographics context shape.
 * @param {Object} result - AssemblyAI completed transcript
 * @returns {Object} Demographics context object
 */
function buildDemographicsFromAssemblyAI(result) {
  const sentimentResults = result.sentiment_analysis_results ?? [];
  const dominantSentiment = sentimentResults.length > 0
    ? sentimentResults[0].sentiment.toLowerCase()
    : 'neutral';

  return {
    source: 'voice_analysis',
    confidence: 'low',
    sentiment: dominantSentiment,
  };
}

/**
 * Orchestrates a full voice turn: STT + optional demographics.
 * @param {Uint8Array|ArrayBuffer} audioBuffer
 * @param {string} mimeType
 * @param {Object} options
 * @param {string} options.deepgramApiKey
 * @param {string} options.assemblyAiApiKey
 * @param {boolean} options.demographicsEnabled
 * @returns {Promise<{ transcript: string, demographics: Object|null }>}
 */
export async function processVoiceTurn(audioBuffer, mimeType, options) {
  const { deepgramApiKey, assemblyAiApiKey, demographicsEnabled } = options;

  const transcript = await transcribeAudio(audioBuffer, mimeType, deepgramApiKey);

  let demographics = null;
  if (demographicsEnabled && assemblyAiApiKey) {
    demographics = await analyzeVoiceDemographics(audioBuffer, mimeType, assemblyAiApiKey);
  }

  return { transcript, demographics };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
