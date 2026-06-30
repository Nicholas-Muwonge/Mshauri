import { useState } from 'react';
import { api } from '../api';

export default function PaymentModal({ user, conversationId, onClose, onSuccess }) {
  const [type, setType] = useState('per_question');
  const [phone, setPhone] = useState(user.phone || '');
  const [status, setStatus] = useState('idle'); // idle | processing | success | error
  const [message, setMessage] = useState('');

  async function handlePay() {
    setStatus('processing');
    try {
      const result = await api.initiatePayment(user.id, conversationId, type, phone);
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      // Simulation mode resolves immediately
      setStatus('success');
      setMessage(result.message || 'Payment successful.');
      setTimeout(() => onSuccess(), 1200);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Payment failed. Please try again.');
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        {status !== 'success' && (
          <>
            <h2 className="modal-title">Continue the conversation</h2>
            <p className="modal-sub">Choose how you'd like to pay — both options use Mobile Money.</p>

            <div className="pay-options">
              <label className={`pay-option ${type === 'per_question' ? 'pay-option-active' : ''}`}>
                <input type="radio" name="type" checked={type === 'per_question'} onChange={() => setType('per_question')} />
                <div>
                  <strong>Pay per question</strong>
                  <span>UGX 5,000 for this question</span>
                </div>
              </label>
              <label className={`pay-option ${type === 'subscription' ? 'pay-option-active' : ''}`}>
                <input type="radio" name="type" checked={type === 'subscription'} onChange={() => setType('subscription')} />
                <div>
                  <strong>Monthly unlimited</strong>
                  <span>UGX 30,000 / month</span>
                </div>
              </label>
            </div>

            <label className="field-label" htmlFor="pay-phone">Mobile Money number</label>
            <input
              id="pay-phone"
              type="tel"
              className="field-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+256 700 000 000"
            />

            {status === 'error' && <p className="form-error">{message}</p>}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={onClose} disabled={status === 'processing'}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handlePay} disabled={status === 'processing' || !phone.trim()}>
                {status === 'processing' ? 'Processing...' : 'Pay with Mobile Money'}
              </button>
            </div>
          </>
        )}

        {status === 'success' && (
          <div className="pay-success">
            <i className="ti ti-circle-check" aria-hidden="true"></i>
            <h2 className="modal-title">Payment received</h2>
            <p className="modal-sub">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
