// routes/whatsapp.js — Twilio WhatsApp webhook. Same agent pipeline as the web app.
// To go live: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER in .env,
// configure this URL (https://yourdomain.com/api/whatsapp/webhook) as the Twilio webhook,
// and join the WhatsApp sandbox or get a production WhatsApp Business number approved.
const express = require('express');
const router = express.Router();
const db = require('../db');
const { processUserMessage } = require('../agents/orchestrator');

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_NUMBER || ''; // e.g. 'whatsapp:+14155238886'
const twilioConfigured = Boolean(TWILIO_SID && TWILIO_AUTH && TWILIO_FROM);

// Twilio sends incoming WhatsApp messages as application/x-www-form-urlencoded POSTs.
router.post('/webhook', express.urlencoded({ extended: false }), async (req, res) => {
  const from = req.body.From; // e.g. 'whatsapp:+256700000000'
  const body = req.body.Body;

  if (!from || !body) {
    return res.status(400).send('Missing From or Body');
  }

  const phone = from.replace('whatsapp:', '');
  const user = await db.findOrCreateUser({ phone, language: 'en' });

  // Find or create an open conversation for this user.
  const conversations = await db.listConversationsByUser(user.id);
  let convo = conversations.find((c) => c.status === 'open');
  if (!convo) {
    convo = await db.createConversation({ userId: user.id, domain: 'unclassified' });
  }

  await db.addMessage({ conversationId: convo.id, role: 'user', content: body });

  const history = (await db.listMessages(convo.id)).slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const result = await processUserMessage({ message: body, conversationId: convo.id, history });

  await db.updateConversation(convo.id, {
    domain: result.triage.domain,
    urgency: result.triage.urgency,
    status: result.escalateToHuman ? 'escalated' : 'open',
  });

  await db.addMessage({
    conversationId: convo.id,
    role: 'agent',
    content: result.responseText,
    agentType: result.agentType,
  });

  // Reply via TwiML so Twilio sends the message back over WhatsApp.
  res.set('Content-Type', 'text/xml');
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
      result.responseText
    )}</Message></Response>`
  );
});

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { router, twilioConfigured };
