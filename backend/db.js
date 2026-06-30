// db.js — lightweight file-backed JSON database (pure JS, no native deps).
// Real persistence to disk: survives restarts, easy to inspect/export for judges.
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const file = path.join(__dirname, 'data', 'mshauri.json');
const adapter = new JSONFile(file);
const db = new Low(adapter, {
  users: [],
  conversations: [],
  messages: [],
  agentLogs: [],
  payments: [],
  documents: [],
});

async function init() {
  await db.read();
  db.data ||= { users: [], conversations: [], messages: [], agentLogs: [], payments: [], documents: [] };
  await db.write();
  return db;
}

// ---------- Users ----------
async function findOrCreateUser({ phone, name, language }) {
  await db.read();
  let user = db.data.users.find((u) => u.phone === phone);
  if (!user) {
    user = {
      id: uuidv4(),
      phone,
      name: name || null,
      language: language || 'en',
      createdAt: new Date().toISOString(),
      subscriptionActive: false,
      subscriptionExpiresAt: null,
    };
    db.data.users.push(user);
    await db.write();
  }
  return user;
}

async function getUserById(id) {
  await db.read();
  return db.data.users.find((u) => u.id === id) || null;
}

async function listUsers() {
  await db.read();
  return db.data.users;
}

// ---------- Conversations ----------
async function createConversation({ userId, domain }) {
  await db.read();
  const convo = {
    id: uuidv4(),
    userId,
    domain, // 'legal' | 'medical' | 'unclassified'
    status: 'open', // open | escalated | resolved | paid
    urgency: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.data.conversations.push(convo);
  await db.write();
  return convo;
}

async function updateConversation(id, patch) {
  await db.read();
  const convo = db.data.conversations.find((c) => c.id === id);
  if (!convo) return null;
  Object.assign(convo, patch, { updatedAt: new Date().toISOString() });
  await db.write();
  return convo;
}

async function getConversation(id) {
  await db.read();
  return db.data.conversations.find((c) => c.id === id) || null;
}

async function listConversationsByUser(userId) {
  await db.read();
  return db.data.conversations.filter((c) => c.userId === userId);
}

async function listAllConversations() {
  await db.read();
  return db.data.conversations;
}

// ---------- Messages ----------
async function addMessage({ conversationId, role, content, agentType }) {
  await db.read();
  const msg = {
    id: uuidv4(),
    conversationId,
    role, // 'user' | 'agent' | 'human'
    agentType: agentType || null, // 'triage' | 'legal' | 'medical' | 'translation' | 'document'
    content,
    createdAt: new Date().toISOString(),
  };
  db.data.messages.push(msg);
  await db.write();
  return msg;
}

async function listMessages(conversationId) {
  await db.read();
  return db.data.messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

// ---------- Agent execution logs (this is what proves AI runs the business) ----------
async function logAgentExecution({ agentType, input, output, conversationId, latencyMs, model }) {
  await db.read();
  const log = {
    id: uuidv4(),
    agentType,
    conversationId: conversationId || null,
    input: typeof input === 'string' ? input.slice(0, 2000) : input,
    output: typeof output === 'string' ? output.slice(0, 4000) : output,
    model: model || 'gemini-2.0-flash',
    latencyMs: latencyMs || null,
    createdAt: new Date().toISOString(),
  };
  db.data.agentLogs.push(log);
  await db.write();
  return log;
}

async function listAgentLogs(limit = 200) {
  await db.read();
  return db.data.agentLogs.slice(-limit).reverse();
}

// ---------- Payments ----------
async function createPayment({ userId, conversationId, amountUgx, type, provider, status }) {
  await db.read();
  const payment = {
    id: uuidv4(),
    userId,
    conversationId: conversationId || null,
    amountUgx,
    type, // 'per_question' | 'subscription' | 'document'
    provider: provider || 'flutterwave',
    status: status || 'pending', // pending | success | failed
    createdAt: new Date().toISOString(),
  };
  db.data.payments.push(payment);
  await db.write();
  return payment;
}

async function updatePaymentStatus(id, status) {
  await db.read();
  const payment = db.data.payments.find((p) => p.id === id);
  if (!payment) return null;
  payment.status = status;
  payment.updatedAt = new Date().toISOString();
  await db.write();
  return payment;
}

async function listPayments() {
  await db.read();
  return db.data.payments;
}

async function revenueSummary() {
  await db.read();
  const successful = db.data.payments.filter((p) => p.status === 'success');
  const totalUgx = successful.reduce((sum, p) => sum + p.amountUgx, 0);
  return {
    totalUgx,
    totalUsd: Math.round((totalUgx / 3800) * 100) / 100, // approx UGX/USD rate
    count: successful.length,
    byType: {
      per_question: successful.filter((p) => p.type === 'per_question').reduce((s, p) => s + p.amountUgx, 0),
      subscription: successful.filter((p) => p.type === 'subscription').reduce((s, p) => s + p.amountUgx, 0),
      document: successful.filter((p) => p.type === 'document').reduce((s, p) => s + p.amountUgx, 0),
    },
  };
}

// ---------- Documents (generated legal/medical letters) ----------
async function createDocument({ userId, conversationId, docType, content }) {
  await db.read();
  const doc = {
    id: uuidv4(),
    userId,
    conversationId,
    docType,
    content,
    createdAt: new Date().toISOString(),
  };
  db.data.documents.push(doc);
  await db.write();
  return doc;
}

async function listDocumentsByUser(userId) {
  await db.read();
  return db.data.documents.filter((d) => d.userId === userId);
}

module.exports = {
  init,
  findOrCreateUser,
  getUserById,
  listUsers,
  createConversation,
  updateConversation,
  getConversation,
  listConversationsByUser,
  listAllConversations,
  addMessage,
  listMessages,
  logAgentExecution,
  listAgentLogs,
  createPayment,
  updatePaymentStatus,
  listPayments,
  revenueSummary,
  createDocument,
  listDocumentsByUser,
};
