import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import './Onboarding.css';

export default function Onboarding() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { user } = await api.createUser(phone.trim(), name.trim() || null, language);
      const { conversation } = await api.createConversation(user.id);
      localStorage.setItem('mshauri_user', JSON.stringify(user));
      navigate(`/chat/${conversation.id}`);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="onboard-wrap">
      <div className="onboard-card">
        <p className="onboard-eyebrow">Step 1 of 1</p>
        <h1 className="onboard-title">Tell us where to reach you</h1>
        <p className="onboard-sub">
          We'll use this to save your conversation and send your answer. Your number is never shared.
        </p>

        <form onSubmit={handleSubmit} className="onboard-form">
          <label className="field-label" htmlFor="phone">Phone number</label>
          <input
            id="phone"
            type="tel"
            placeholder="+256 700 000 000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="field-input"
            autoFocus
          />

          <label className="field-label" htmlFor="name">Name (optional)</label>
          <input
            id="name"
            type="text"
            placeholder="What should we call you?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input"
          />

          <label className="field-label">Preferred language</label>
          <div className="lang-row">
            {[
              { code: 'en', label: 'English' },
              { code: 'lg', label: 'Luganda' },
              { code: 'sw', label: 'Swahili' },
            ].map((l) => (
              <button
                type="button"
                key={l.code}
                className={`lang-pill ${language === l.code ? 'lang-pill-active' : ''}`}
                onClick={() => setLanguage(l.code)}
              >
                {l.label}
              </button>
            ))}
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary onboard-submit" disabled={loading}>
            {loading ? 'Starting...' : 'Start my conversation'}
          </button>
        </form>
      </div>
    </div>
  );
}
