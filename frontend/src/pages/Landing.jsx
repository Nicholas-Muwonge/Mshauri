import { useNavigate } from 'react-router-dom';
import './Landing.css';

const SAMPLE_QUESTIONS = [
  { q: 'My landlord wants to evict me with no notice. Is that legal?', tag: 'Legal · Tenancy' },
  { q: "I've had a fever and headache for 3 days, should I worry?", tag: 'Health · Triage' },
  { q: 'How do I register a small business in Uganda?', tag: 'Legal · Business' },
  { q: 'My employer has not paid me in 2 months, what can I do?', tag: 'Legal · Employment' },
  { q: 'My child has a rash that is spreading, is this serious?', tag: 'Health · Triage' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="landing-wordmark">Mshauri</span>
        <button className="nav-link-btn" onClick={() => navigate('/admin')}>
          For investors & judges
        </button>
      </header>

      <section className="landing-hero">
        <div className="hero-copy">
          <p className="hero-eyebrow">Legal and health guidance, in minutes</p>
          <h1 className="hero-title">
            Ask the question you<br />couldn't afford to ask.
          </h1>
          <p className="hero-sub">
            Mshauri puts AI-powered legal and medical guidance within reach of every Ugandan —
            in plain language, in your language, for the price of a boda ride.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => navigate('/start')}>
              Ask your first question free
            </button>
            <span className="hero-price">UGX 5,000 per question after that · no appointment needed</span>
          </div>
        </div>

        <div className="hero-feed" aria-hidden="true">
          <div className="feed-label">Real questions, answered today</div>
          {SAMPLE_QUESTIONS.map((item, i) => (
            <div className="feed-card" key={i} style={{ animationDelay: `${i * 0.15}s` }}>
              <p className="feed-q">{item.q}</p>
              <span className="feed-tag">{item.tag}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-how">
        <h2 className="section-heading">How it works</h2>
        <div className="how-grid">
          <div className="how-step">
            <span className="how-num">01</span>
            <h3>Ask</h3>
            <p>Type your question in English, Luganda, or Swahili — no forms, no jargon.</p>
          </div>
          <div className="how-step">
            <span className="how-num">02</span>
            <h3>Get guided</h3>
            <p>AI trained on Ugandan law and health practice answers in plain language, in seconds.</p>
          </div>
          <div className="how-step">
            <span className="how-num">03</span>
            <h3>Escalate if needed</h3>
            <p>Complex or urgent cases are flagged to a real licensed professional for follow-up.</p>
          </div>
        </div>
      </section>

      <section className="landing-trust">
        <div className="trust-item">
          <strong>Built for Uganda</strong>
          <span>Grounded in Ugandan statutes, courts, and health facilities — not generic advice.</span>
        </div>
        <div className="trust-item">
          <strong>Pay with Mobile Money</strong>
          <span>MTN MoMo and Airtel Money accepted. No bank account or card required.</span>
        </div>
        <div className="trust-item">
          <strong>Human backup, always</strong>
          <span>Anything serious is reviewed by a real advocate or clinician — never AI alone on the hard cases.</span>
        </div>
      </section>

      <footer className="landing-footer">
        <span>Mshauri · Built for the XPRIZE Gemini Hackathon · Kampala, Uganda</span>
      </footer>
    </div>
  );
}
