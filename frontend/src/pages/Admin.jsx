import { useState, useEffect } from 'react';
import { api } from '../api';
import './Admin.css';

export default function Admin() {
  const [overview, setOverview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    try {
      const [ov, lg] = await Promise.all([api.adminOverview(), api.adminAgentLogs()]);
      setOverview(ov);
      setLogs(lg.logs);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !overview) {
    return <div className="admin-loading">Loading dashboard...</div>;
  }

  return (
    <div className="admin-wrap">
      <header className="admin-header">
        <div>
          <span className="admin-wordmark">Mshauri</span>
          <span className="admin-subtitle">Operations dashboard</span>
        </div>
        <div className="admin-status-row">
          <StatusPill label="Gemini" live={overview.geminiLive} />
          <StatusPill label={providerLabel(overview.paymentProvider)} live={overview.paymentLive} />
        </div>
      </header>

      <nav className="admin-tabs">
        <button className={tab === 'overview' ? 'tab-active' : ''} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={tab === 'agents' ? 'tab-active' : ''} onClick={() => setTab('agents')}>
          Agent execution log
        </button>
      </nav>

      {tab === 'overview' && (
        <main className="admin-grid">
          <div className="metric-card metric-highlight">
            <span className="metric-label">Total revenue</span>
            <span className="metric-value">UGX {overview.revenue.totalUgx.toLocaleString()}</span>
            <span className="metric-sub">≈ ${overview.revenue.totalUsd} USD · {overview.revenue.count} payments</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Users served</span>
            <span className="metric-value">{overview.totalUsers}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Conversations</span>
            <span className="metric-value">{overview.totalConversations}</span>
            <span className="metric-sub">
              {overview.conversationsByDomain.legal} legal · {overview.conversationsByDomain.medical} medical
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">AI agent executions</span>
            <span className="metric-value">{overview.totalAgentExecutions}</span>
            <span className="metric-sub">100% of conversations handled by AI first</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Escalated to human</span>
            <span className="metric-value">{overview.escalatedCount}</span>
            <span className="metric-sub">Complex/urgent cases only</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Revenue by type</span>
            <div className="breakdown">
              <div className="breakdown-row">
                <span>Per-question</span>
                <span>UGX {overview.revenue.byType.per_question.toLocaleString()}</span>
              </div>
              <div className="breakdown-row">
                <span>Subscription</span>
                <span>UGX {overview.revenue.byType.subscription.toLocaleString()}</span>
              </div>
              <div className="breakdown-row">
                <span>Documents</span>
                <span>UGX {overview.revenue.byType.document.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="metric-card metric-wide">
            <span className="metric-label">Agent execution breakdown</span>
            <div className="agent-bars">
              {Object.entries(overview.agentExecutionsByType).map(([k, v]) => (
                <AgentBar key={k} label={k} value={v} max={overview.totalAgentExecutions || 1} />
              ))}
            </div>
          </div>
        </main>
      )}

      {tab === 'agents' && (
        <main className="admin-logs">
          <p className="logs-intro">
            Live feed of every AI agent execution — model used, latency, input, and output. This is the
            evidence trail showing AI runs the core of this business continuously.
          </p>
          {logs.length === 0 && <p className="docs-empty-text">No agent executions yet.</p>}
          {logs.map((log) => (
            <div className="log-card" key={log.id}>
              <div className="log-card-head">
                <span className={`log-tag log-tag-${log.agentType}`}>{log.agentType}</span>
                <span className="log-model">{log.model}</span>
                {log.latencyMs != null && <span className="log-latency">{log.latencyMs}ms</span>}
                <span className="log-time">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
              <p className="log-input"><strong>Input:</strong> {truncate(log.input, 160)}</p>
              <p className="log-output"><strong>Output:</strong> {truncate(log.output, 220)}</p>
            </div>
          ))}
        </main>
      )}
    </div>
  );
}

function StatusPill({ label, live }) {
  return (
    <span className={`status-pill ${live ? 'status-live' : 'status-offline'}`}>
      <span className="status-dot"></span>
      {label}: {live ? 'Live' : 'Offline mode'}
    </span>
  );
}

function AgentBar({ label, value, max }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="agent-bar-row">
      <span className="agent-bar-label">{label}</span>
      <div className="agent-bar-track">
        <div className="agent-bar-fill" style={{ width: `${pct}%` }}></div>
      </div>
      <span className="agent-bar-value">{value}</span>
    </div>
  );
}

function providerLabel(provider) {
  if (provider === 'mtn_momo_direct') return 'MTN MoMo';
  if (provider === 'flutterwave') return 'Flutterwave';
  return 'Payments';
}

function truncate(text, n) {
  if (!text) return '';
  const str = typeof text === 'string' ? text : JSON.stringify(text);
  return str.length > n ? str.slice(0, n) + '...' : str;
}
