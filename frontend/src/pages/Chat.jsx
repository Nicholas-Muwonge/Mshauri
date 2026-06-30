import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import PaymentModal from '../components/PaymentModal';
import './Chat.css';
import '../components/PaymentModal.css';

const FREE_MESSAGE_LIMIT = 1;

export default function Chat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const bottomRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem('mshauri_user');
    if (!stored) {
      navigate('/start');
      return;
    }
    setUser(JSON.parse(stored));
  }, [navigate]);

  useEffect(() => {
    if (!conversationId) return;
    api.getMessages(conversationId).then(({ messages }) => {
      setMessages(messages);
      setUserMessageCount(messages.filter((m) => m.role === 'user').length);
    });
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || sending || !user) return;

    if (userMessageCount >= FREE_MESSAGE_LIMIT) {
      setShowPayment(true);
      return;
    }

    const userMsg = { id: `tmp-${Date.now()}`, role: 'user', content: input, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    const sentText = input;
    setInput('');
    setSending(true);

    try {
      const { message, escalateToHuman } = await api.sendChat(conversationId, user.id, sentText);
      setMessages((prev) => [...prev, message]);
      setUserMessageCount((c) => c + 1);
      setEscalated(escalateToHuman);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'agent', content: 'Something went wrong reaching the agent. Please try again.', createdAt: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handlePaymentSuccess() {
    setShowPayment(false);
  }

  if (!user) return null;

  return (
    <div className="chat-wrap">
      <header className="chat-header">
        <button className="chat-back" onClick={() => navigate('/')} aria-label="Back to home">
          <i className="ti ti-arrow-left" aria-hidden="true"></i>
        </button>
        <span className="chat-wordmark">Mshauri</span>
        <button className="chat-docs-link" onClick={() => navigate('/documents')}>
          My documents
        </button>
      </header>

      {escalated && (
        <div className="escalation-banner">
          <i className="ti ti-alert-triangle" aria-hidden="true"></i>
          A human reviewer has been notified about this conversation and will follow up with you directly.
        </div>
      )}

      <main className="chat-body">
        {messages.length === 0 && (
          <div className="chat-empty">
            <h2>What can we help you with?</h2>
            <p>Ask a legal or health question in plain language — there's no wrong way to ask.</p>
            <div className="chat-suggestions">
              <button onClick={() => setInput('My landlord wants to evict me without notice, is that legal?')}>
                Landlord eviction without notice
              </button>
              <button onClick={() => setInput('How do I register a small business in Uganda?')}>
                Registering a small business
              </button>
              <button onClick={() => setInput('I have had a fever and headache for 3 days')}>
                Fever for several days
              </button>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`bubble-row bubble-row-${m.role}`}>
            <div className={`bubble bubble-${m.role}`}>
              {m.agentType && m.role === 'agent' && (
                <span className="bubble-tag">{labelForAgent(m.agentType)}</span>
              )}
              <p>{m.content}</p>
            </div>
          </div>
        ))}

        {sending && (
          <div className="bubble-row bubble-row-agent">
            <div className="bubble bubble-agent bubble-typing">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Type your question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="chat-input"
          disabled={sending}
        />
        <button type="submit" className="chat-send" disabled={sending || !input.trim()} aria-label="Send">
          <i className="ti ti-arrow-right" aria-hidden="true"></i>
        </button>
      </form>

      {userMessageCount >= FREE_MESSAGE_LIMIT && (
        <p className="chat-paywall-hint">
          Your free question has been used. Further questions are UGX 5,000 each, or UGX 30,000/month unlimited.
        </p>
      )}

      {showPayment && (
        <PaymentModal
          user={user}
          conversationId={conversationId}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

function labelForAgent(type) {
  switch (type) {
    case 'legal': return 'Legal guidance';
    case 'medical': return 'Health guidance';
    case 'triage': return 'Mshauri';
    case 'translation': return 'Mshauri';
    default: return 'Mshauri';
  }
}
