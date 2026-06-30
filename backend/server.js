// server.js — Mshauri backend. Express API serving the web frontend and WhatsApp webhook.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { processUserMessage, runDocumentAgent } = require('./agents/orchestrator');
const { initiateMoMoPayment, hasLiveKey: paymentLive, PRICES_UGX, providerName } = require('./paymentProvider');
const { verifyPayment } = require('./payments'); // verify/webhook flow still Flutterwave-specific
const { hasLiveKey: geminiLive } = require('./gemini');
const { router: whatsappRouter, twilioConfigured } = require('./routes/whatsapp');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/whatsapp', whatsappRouter);

const PORT = process.env.PORT || 8080;

// ---------- Health / status ----------
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    geminiLive,
    paymentProvider: providerName,
    paymentLive,
    twilioConfigured,
    prices: PRICES_UGX,
  });
});

// ---------- Users ----------
app.post('/api/users', async (req, res) => {
  const { phone, name, language } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });
  const user = await db.findOrCreateUser({ phone, name, language });
  res.json({ user });
});

// ---------- Conversations + chat ----------
app.post('/api/conversations', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  const convo = await db.createConversation({ userId, domain: 'unclassified' });
  res.json({ conversation: convo });
});

app.get('/api/conversations/:id/messages', async (req, res) => {
  const messages = await db.listMessages(req.params.id);
  res.json({ messages });
});

app.post('/api/chat', async (req, res) => {
  const { conversationId, userId, message } = req.body;
  if (!conversationId || !message) {
    return res.status(400).json({ error: 'conversationId and message are required' });
  }

  await db.addMessage({ conversationId, role: 'user', content: message });

  const history = (await db.listMessages(conversationId)).slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const result = await processUserMessage({ message, conversationId, history });

  await db.updateConversation(conversationId, {
    domain: result.triage.domain,
    urgency: result.triage.urgency,
    status: result.escalateToHuman ? 'escalated' : 'open',
  });

  const agentMsg = await db.addMessage({
    conversationId,
    role: 'agent',
    content: result.responseText,
    agentType: result.agentType,
  });

  res.json({
    message: agentMsg,
    triage: result.triage,
    escalateToHuman: result.escalateToHuman,
  });
});

// ---------- Payments ----------
app.post('/api/payments/initiate', async (req, res) => {
  const { userId, conversationId, type, phone, email } = req.body;
  if (!userId || !type || !phone) {
    return res.status(400).json({ error: 'userId, type, and phone are required' });
  }
  const result = await initiateMoMoPayment({ userId, conversationId, type, phone, email });
  res.json(result);
});

app.get('/api/payments/:txRef/verify', async (req, res) => {
  const result = await verifyPayment(req.params.txRef);
  res.json(result);
});

app.get('/api/payments', async (req, res) => {
  const payments = await db.listPayments();
  res.json({ payments });
});

// ---------- Documents (paid feature) ----------
app.post('/api/documents/generate', async (req, res) => {
  const { userId, conversationId, docType } = req.body;
  if (!userId || !docType) return res.status(400).json({ error: 'userId and docType are required' });

  // Require a successful payment for this conversation before generating.
  const payments = await db.listPayments();
  const hasPaid = payments.some(
    (p) => p.userId === userId && p.type === 'document' && p.status === 'success'
  );
  if (!hasPaid) {
    return res.status(402).json({ error: 'Payment required before document generation.' });
  }

  const history = conversationId ? await db.listMessages(conversationId) : [];
  const context = history.map((m) => `${m.role}: ${m.content}`).join('\n');

  const content = await runDocumentAgent({ docType, context, conversationId });
  const doc = await db.createDocument({ userId, conversationId, docType, content });
  res.json({ document: doc });
});

app.get('/api/documents/user/:userId', async (req, res) => {
  const docs = await db.listDocumentsByUser(req.params.userId);
  res.json({ documents: docs });
});

// ---------- Admin / judge-facing dashboard data ----------
app.get('/api/admin/overview', async (req, res) => {
  const users = await db.listUsers();
  const conversations = await db.listAllConversations();
  const agentLogs = await db.listAgentLogs(500);
  const revenue = await db.revenueSummary();
  const payments = await db.listPayments();

  res.json({
    totalUsers: users.length,
    totalConversations: conversations.length,
    conversationsByDomain: {
      legal: conversations.filter((c) => c.domain === 'legal').length,
      medical: conversations.filter((c) => c.domain === 'medical').length,
      unclassified: conversations.filter((c) => c.domain === 'unclassified').length,
    },
    escalatedCount: conversations.filter((c) => c.status === 'escalated').length,
    totalAgentExecutions: agentLogs.length,
    agentExecutionsByType: {
      triage: agentLogs.filter((l) => l.agentType === 'triage').length,
      legal: agentLogs.filter((l) => l.agentType === 'legal').length,
      medical: agentLogs.filter((l) => l.agentType === 'medical').length,
      translation: agentLogs.filter((l) => l.agentType === 'translation').length,
      document: agentLogs.filter((l) => l.agentType === 'document').length,
    },
    revenue,
    paymentCount: payments.length,
    geminiLive,
    paymentProvider: providerName,
    paymentLive,
  });
});

app.get('/api/admin/agent-logs', async (req, res) => {
  const logs = await db.listAgentLogs(200);
  res.json({ logs });
});

app.get('/api/admin/conversations', async (req, res) => {
  const conversations = await db.listAllConversations();
  res.json({ conversations });
});

// ---------- Boot ----------
db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`Mshauri backend running on port ${PORT}`);
    console.log(`Gemini live: ${geminiLive ? 'YES' : 'NO (offline stub mode)'}`);
    console.log(`Payment provider: ${providerName} — ${paymentLive ? 'LIVE' : 'simulation mode'}`);
  });
});

module.exports = app;
