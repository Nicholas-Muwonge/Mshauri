import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import './Documents.css';

export default function Documents() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('mshauri_user');
    if (!stored) {
      navigate('/start');
      return;
    }
    const u = JSON.parse(stored);
    setUser(u);
    api.getUserDocuments(u.id).then(({ documents }) => {
      setDocuments(documents);
      setLoading(false);
    });
  }, [navigate]);

  return (
    <div className="docs-wrap">
      <header className="docs-header">
        <button className="chat-back" onClick={() => navigate(-1)} aria-label="Back">
          <i className="ti ti-arrow-left" aria-hidden="true"></i>
        </button>
        <h1 className="docs-title">My documents</h1>
      </header>

      <main className="docs-body">
        {loading && <p className="docs-empty-text">Loading...</p>}

        {!loading && documents.length === 0 && (
          <div className="docs-empty">
            <i className="ti ti-file-off" aria-hidden="true"></i>
            <h2>No documents yet</h2>
            <p>
              When you ask Mshauri to draft something — a demand letter, a tenancy notice, a referral —
              it will appear here for you to download.
            </p>
          </div>
        )}

        {documents.map((doc) => (
          <div className="doc-card" key={doc.id}>
            <div className="doc-card-head">
              <strong>{doc.docType}</strong>
              <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="doc-preview">{doc.content.slice(0, 220)}...</p>
          </div>
        ))}
      </main>
    </div>
  );
}
