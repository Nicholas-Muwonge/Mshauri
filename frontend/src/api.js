const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  status: () => request('/status'),

  createUser: (phone, name, language) =>
    request('/users', { method: 'POST', body: JSON.stringify({ phone, name, language }) }),

  createConversation: (userId) =>
    request('/conversations', { method: 'POST', body: JSON.stringify({ userId }) }),

  getMessages: (conversationId) => request(`/conversations/${conversationId}/messages`),

  sendChat: (conversationId, userId, message) =>
    request('/chat', { method: 'POST', body: JSON.stringify({ conversationId, userId, message }) }),

  initiatePayment: (userId, conversationId, type, phone, email) =>
    request('/payments/initiate', {
      method: 'POST',
      body: JSON.stringify({ userId, conversationId, type, phone, email }),
    }),

  generateDocument: (userId, conversationId, docType) =>
    request('/documents/generate', {
      method: 'POST',
      body: JSON.stringify({ userId, conversationId, docType }),
    }),

  getUserDocuments: (userId) => request(`/documents/user/${userId}`),

  adminOverview: () => request('/admin/overview'),
  adminAgentLogs: () => request('/admin/agent-logs'),
  adminConversations: () => request('/admin/conversations'),
};
