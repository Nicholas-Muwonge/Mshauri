// agents/orchestrator.js — the core multi-agent pipeline.
// Flow: user message -> triage agent -> specialist agent (legal/medical) -> response
// Every step is logged to agentLogs so judges/investors can see AI actually running the business.

const { callGemini } = require('../gemini');
const {
  TRIAGE_PROMPT,
  LEGAL_AGENT_PROMPT,
  MEDICAL_AGENT_PROMPT,
  DOCUMENT_AGENT_PROMPT,
  TRANSLATION_PROMPT,
} = require('./prompts');
const db = require('../db');

/**
 * Step 1: Triage — classify domain, urgency, language.
 */
async function runTriage({ message, conversationId }) {
  const result = await callGemini({
    systemInstruction: TRIAGE_PROMPT,
    userContent: message,
    temperature: 0.1,
    maxOutputTokens: 256,
  });

  await db.logAgentExecution({
    agentType: 'triage',
    input: message,
    output: result.text,
    conversationId,
    latencyMs: result.latencyMs,
    model: result.model,
  });

  let parsed;
  try {
    const cleaned = result.text.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // Fallback if the model didn't return clean JSON
    parsed = { domain: 'unclear', urgency: 'medium', summary: message.slice(0, 80), language_detected: 'en' };
  }

  return parsed;
}

/**
 * Step 2: Specialist agent (legal or medical) generates the actual guidance.
 */
async function runSpecialist({ domain, message, conversationId, history = [] }) {
  const systemInstruction = domain === 'legal' ? LEGAL_AGENT_PROMPT : MEDICAL_AGENT_PROMPT;
  const agentType = domain === 'legal' ? 'legal' : 'medical';

  const contextBlock =
    history.length > 0
      ? `Previous conversation:\n${history.map((h) => `${h.role}: ${h.content}`).join('\n')}\n\nLatest message: ${message}`
      : message;

  const result = await callGemini({
    systemInstruction,
    userContent: contextBlock,
    temperature: 0.3,
    maxOutputTokens: 1024,
  });

  await db.logAgentExecution({
    agentType,
    input: contextBlock,
    output: result.text,
    conversationId,
    latencyMs: result.latencyMs,
    model: result.model,
  });

  return { text: result.text, agentType, live: result.live };
}

/**
 * Step 3 (optional): Translation agent for Luganda/Swahili users.
 */
async function runTranslation({ text, targetLanguage, conversationId }) {
  if (targetLanguage === 'en') return text;

  const langName = targetLanguage === 'lg' ? 'Luganda' : targetLanguage === 'sw' ? 'Swahili' : 'English';
  const result = await callGemini({
    systemInstruction: TRANSLATION_PROMPT,
    userContent: `Translate this to ${langName}:\n\n${text}`,
    temperature: 0.2,
    maxOutputTokens: 1024,
  });

  await db.logAgentExecution({
    agentType: 'translation',
    input: text,
    output: result.text,
    conversationId,
    latencyMs: result.latencyMs,
    model: result.model,
  });

  return result.text;
}

/**
 * Step 4 (optional, paid): Document generation agent.
 */
async function runDocumentAgent({ docType, context, conversationId }) {
  const result = await callGemini({
    systemInstruction: DOCUMENT_AGENT_PROMPT,
    userContent: `Document type requested: ${docType}\n\nContext from conversation:\n${context}`,
    temperature: 0.2,
    maxOutputTokens: 1024,
  });

  await db.logAgentExecution({
    agentType: 'document',
    input: context,
    output: result.text,
    conversationId,
    latencyMs: result.latencyMs,
    model: result.model,
  });

  return result.text;
}

/**
 * Full pipeline entry point — called by the /api/chat route.
 * Decides whether to escalate to a human based on urgency/domain.
 */
async function processUserMessage({ message, conversationId, history }) {
  const triage = await runTriage({ message, conversationId });

  const escalateToHuman = triage.urgency === 'emergency' || triage.domain === 'unclear';

  let specialistResponse = null;
  if (triage.domain === 'legal' || triage.domain === 'medical') {
    specialistResponse = await runSpecialist({
      domain: triage.domain,
      message,
      conversationId,
      history,
    });
  }

  let finalText = specialistResponse
    ? specialistResponse.text
    : `Thanks for reaching out. Your message didn't clearly match a legal or medical question — ` +
      `could you tell me a bit more about what you need help with? For example, is this about a ` +
      `legal issue (contracts, tenancy, business) or a health concern (symptoms, care advice)?`;

  if (triage.urgency === 'emergency') {
    finalText =
      `⚠️ This sounds urgent. If you are in immediate danger or experiencing a medical emergency, ` +
      `please call emergency services or go to the nearest hospital/police station right now.\n\n` +
      finalText +
      `\n\nA human reviewer has also been notified and will follow up with you shortly.`;
  }

  // Auto-translate if needed
  if (triage.language_detected && triage.language_detected !== 'en') {
    finalText = await runTranslation({
      text: finalText,
      targetLanguage: triage.language_detected,
      conversationId,
    });
  }

  return {
    triage,
    responseText: finalText,
    escalateToHuman,
    agentType: specialistResponse?.agentType || 'triage',
  };
}

module.exports = {
  runTriage,
  runSpecialist,
  runTranslation,
  runDocumentAgent,
  processUserMessage,
};
