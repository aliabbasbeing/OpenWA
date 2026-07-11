import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { campaignApi, type CampaignMessage, type Campaign } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import './CampaignMessages.css';

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type StatusFilter = 'all' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export function CampaignMessages() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { addToast } = useToast();
  const navigate = useNavigate();
  useDocumentTitle(t('campaigns.messages.title'));

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const limit = 25;

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [campaignData, msgResponse] = await Promise.all([
        campaignApi.get(id),
        campaignApi.getMessages(id, {
          status: statusFilter === 'all' ? undefined : statusFilter,
          page,
          limit,
        }),
      ]);
      setCampaign(campaignData);
      setMessages(msgResponse.messages);
      setTotal(msgResponse.total);
      setTotalPages(msgResponse.totalPages);
    } catch {
      addToast({ type: 'error', title: t('campaigns.toasts.error') });
    } finally {
      setLoading(false);
    }
  }, [id, statusFilter, page, limit, t, addToast]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Auto-refresh when campaign is running
  useEffect(() => {
    if (!id || !campaign || campaign.status !== 'running') return;
    const interval = setInterval(async () => {
      try {
        const msgResponse = await campaignApi.getMessages(id, {
          status: statusFilter === 'all' ? undefined : statusFilter,
          page,
          limit,
        });
        setMessages(msgResponse.messages);
        setTotal(msgResponse.total);
        setTotalPages(msgResponse.totalPages);
        // Refresh campaign for counts
        const c = await campaignApi.get(id);
        setCampaign(c);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [id, campaign?.status, statusFilter, page]);

  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setPage(1);
  };

  const counts = {
    all: campaign ? campaign.sentCount + campaign.failedCount + campaign.deliveredCount + campaign.readCount : 0,
    pending: campaign ? campaign.totalContacts - campaign.sentCount - campaign.failedCount : 0,
    sent: campaign?.sentCount ?? 0,
    delivered: campaign?.deliveredCount ?? 0,
    read: campaign?.readCount ?? 0,
    failed: campaign?.failedCount ?? 0,
  };

  if (loading) return <div className="loading-state"><Loader2 className="animate-spin" size={32} /></div>;
  if (!campaign) return null;

  return (
    <div className="campaign-messages-page">
      <div className="messages-header">
        <button className="btn-back" onClick={() => navigate(`/campaigns/${id}`)}><ArrowLeft size={16} /></button>
        <div className="messages-header-info">
          <h2>{t('campaigns.messages.title')}</h2>
          <span className={`status-badge status-${campaign.status}`}>{campaign.status}</span>
        </div>
        <div className="messages-header-actions">
          <button className="btn-secondary" onClick={() => navigate(`/campaigns/${id}`)}>
            {t('campaigns.messages.viewCampaign')} <ExternalLink size={14} />
          </button>
        </div>
      </div>

      <div className="messages-summary">
        {(['all', 'sent', 'delivered', 'read', 'failed'] as const).map(key => (
          <div
            key={key}
            className={`summary-card card-${key}${statusFilter === key ? ' active' : ''}`}
            onClick={() => handleFilterChange(key)}
          >
            <span className="card-label">
              {key === 'all' ? t('campaigns.messages.all') : t(`campaigns.messages.${key}`)}
            </span>
            <span className="card-value">{counts[key]}</span>
          </div>
        ))}
      </div>

      <div className="messages-filter-tabs">
        {(['all', 'pending', 'sent', 'delivered', 'read', 'failed'] as const).map(key => (
          <button
            key={key}
            className={`filter-tab${statusFilter === key ? ' active' : ''}`}
            onClick={() => handleFilterChange(key)}
          >
            {key === 'all' ? t('campaigns.messages.all') : t(`campaigns.messages.${key}`)}
            {counts[key] > 0 && <span className="tab-count">{counts[key]}</span>}
          </button>
        ))}
      </div>

      {messages.length === 0 ? (
        <div className="messages-empty">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3>{t('campaigns.messages.noMessages')}</h3>
          <p>{t('campaigns.messages.noMessagesDesc')}</p>
          <button className="btn-secondary" onClick={() => navigate(`/campaigns/${id}`)}>
            <ArrowLeft size={14} /> {t('campaigns.messages.backToCampaign')}
          </button>
        </div>
      ) : (
        <div className="messages-table-wrapper">
          <table className="messages-table">
            <thead>
              <tr>
                <th className="cell-index">#</th>
                <th>{t('campaigns.messages.contact')}</th>
                <th>{t('campaigns.messages.message')}</th>
                <th>{t('campaigns.messages.status')}</th>
                <th>{t('campaigns.messages.sentAt')}</th>
                <th>{t('campaigns.messages.deliveredAt')}</th>
                <th>{t('campaigns.messages.readAt')}</th>
              </tr>
            </thead>
            <tbody>
              {messages.map(msg => (
                <tr key={msg.id}>
                  <td className="cell-index">{msg.messageIndex}</td>
                  <td className="cell-contact">
                    <div className="contact-number">{msg.contactNumber}</div>
                    {msg.contactName && <div className="contact-name">{msg.contactName}</div>}
                  </td>
                  <td className="cell-message">
                    <div
                      className={`message-preview-text${expandedId === msg.id ? ' expanded' : ''}`}
                      onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
                    >
                      {expandedId === msg.id ? msg.renderedMessage : msg.renderedMessage}
                    </div>
                    <button className="expand-toggle" onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}>
                      {expandedId === msg.id ? t('common.collapse') : t('common.expand')}
                    </button>
                    {msg.errorMessage && <div className="cell-error">{msg.errorMessage}</div>}
                  </td>
                  <td className="cell-status">
                    <span className={`msg-status-badge msg-status-${msg.status}`}>{msg.status}</span>
                  </td>
                  <td className="cell-time">{formatTimestamp(msg.sentAt)}</td>
                  <td className="cell-time">{formatTimestamp(msg.deliveredAt)}</td>
                  <td className="cell-time">{formatTimestamp(msg.readAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="messages-pagination">
              <span className="pagination-info">
                {t('campaigns.messages.pageOf', { current: page, total: totalPages })}
              </span>
              <div className="pagination-controls">
                <button
                  className="btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  {t('common.previous')}
                </button>
                <button
                  className="btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CampaignMessages;
