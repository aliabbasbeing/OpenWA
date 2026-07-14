import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, Loader2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { messageLogApi, type MessageLogEntry, type MessageLogStats } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import './MessageLogs.css';

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

type StatusFilter = 'all' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped' | 'pending';

export function MessageLogs() {
  useDocumentTitle('Message Logs');
  const { addToast } = useToast();

  const [logs, setLogs] = useState<MessageLogEntry[]>([]);
  const [stats, setStats] = useState<MessageLogStats | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [contactFilter, setContactFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const limit = 30;

  const fetchData = useCallback(async () => {
    try {
      const [logData, statsData] = await Promise.all([
        messageLogApi.list({
          page,
          limit,
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: searchQuery || undefined,
          contactNumber: contactFilter || undefined,
        }),
        messageLogApi.stats(),
      ]);
      setLogs(logData.data);
      setTotal(logData.total);
      setTotalPages(Math.ceil(logData.total / limit));
      setStats(statsData);
    } catch {
      addToast({ type: 'error', title: 'Failed to load message logs' });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchQuery, contactFilter, limit, addToast]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await messageLogApi.list({ limit: 10000, status: statusFilter === 'all' ? undefined : statusFilter });
      const headers = ['timestamp', 'direction', 'type', 'contact', 'name', 'status', 'message', 'error', 'campaign', 'session'];
      const escape = (v: unknown) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = data.data.map(l => [
        l.createdAt, l.direction, l.type, l.contactNumber, l.contactName || '',
        l.status, l.body, l.errorMessage || '', l.campaignName || '', l.sessionName || '',
      ].map(escape).join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `message-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const counts = stats ? {
    all: stats.total,
    sent: stats.sent,
    delivered: stats.delivered,
    read: stats.read,
    failed: stats.failed,
    skipped: stats.skipped,
    pending: stats.total - stats.sent - stats.delivered - stats.read - stats.failed - stats.skipped,
  } : { all: 0, sent: 0, delivered: 0, read: 0, failed: 0, skipped: 0, pending: 0 };

  if (loading) return <div className="loading-state"><Loader2 className="animate-spin" size={32} /></div>;

  return (
    <div className="message-logs-page">
      <div className="logs-header">
        <div className="logs-header-left">
          <MessageSquare size={24} />
          <h2>Message Logs</h2>
          <span className="logs-total">{total} total</span>
        </div>
        <div className="logs-header-right">
          <button className="btn-secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />} Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="logs-stats">
          {(['all', 'sent', 'delivered', 'read', 'failed', 'skipped'] as const).map(key => (
            <div
              key={key}
              className={`stat-card stat-${key}${statusFilter === key ? ' active' : ''}`}
              onClick={() => { setStatusFilter(key); setPage(1); }}
            >
              <span className="stat-label">{key === 'all' ? 'All' : key.charAt(0).toUpperCase() + key.slice(1)}</span>
              <span className="stat-value">{counts[key]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="logs-filters">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search message content..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
        <div className="search-box">
          <Filter size={16} />
          <input
            type="text"
            placeholder="Filter by phone number..."
            value={contactFilter}
            onChange={e => { setContactFilter(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Logs Table */}
      {logs.length === 0 ? (
        <div className="logs-empty">
          <MessageSquare size={48} />
          <h3>No message logs found</h3>
          <p>Messages will appear here once campaigns or direct messages are sent.</p>
        </div>
      ) : (
        <div className="logs-table-wrapper">
          <table className="logs-table">
            <thead>
              <tr>
                <th className="col-time">Time</th>
                <th className="col-direction">Dir</th>
                <th className="col-contact">Contact</th>
                <th className="col-message">Message</th>
                <th className="col-status">Status</th>
                <th className="col-campaign">Campaign</th>
                <th className="col-expand"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className={`row-${log.status}`}>
                  <td className="col-time">
                    <span className="time-text">{formatTimestamp(log.createdAt)}</span>
                  </td>
                  <td className="col-direction">
                    <span className={`dir-badge dir-${log.direction}`}>
                      {log.direction === 'outbound' ? '↑' : '↓'}
                    </span>
                  </td>
                  <td className="col-contact">
                    <div className="contact-number">{log.contactNumber}</div>
                    {log.contactName && <div className="contact-name">{log.contactName}</div>}
                  </td>
                  <td className="col-message">
                    <div className={`message-text${expandedId === log.id ? ' expanded' : ''}`}>
                      {log.body}
                    </div>
                    {log.errorMessage && <div className="error-text">{log.errorMessage}</div>}
                  </td>
                  <td className="col-status">
                    <span className={`status-badge status-${log.status}`}>{log.status}</span>
                  </td>
                  <td className="col-campaign">
                    {log.campaignName ? (
                      <span className="campaign-tag">{log.campaignName}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="col-expand">
                    <button
                      className="expand-btn"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      {expandedId === log.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Expanded Detail */}
          {expandedId && (() => {
            const log = logs.find(l => l.id === expandedId);
            if (!log) return null;
            return (
              <div className="log-detail">
                <div className="detail-row"><strong>Message ID:</strong> <code>{log.waMessageId || '—'}</code></div>
                <div className="detail-row"><strong>Session:</strong> {log.sessionName || log.sessionId}</div>
                <div className="detail-row"><strong>Chat ID:</strong> <code>{log.chatId}</code></div>
                <div className="detail-row"><strong>Type:</strong> {log.type}</div>
                <div className="detail-row"><strong>Full Message:</strong></div>
                <pre className="detail-message">{log.body}</pre>
                {log.errorMessage && (
                  <div className="detail-row error"><strong>Error:</strong> {log.errorMessage}</div>
                )}
              </div>
            );
          })()}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="logs-pagination">
              <span className="pagination-info">Page {page} of {totalPages}</span>
              <div className="pagination-controls">
                <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
                <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MessageLogs;
