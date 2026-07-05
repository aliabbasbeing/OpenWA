import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone, Plus, Play, Pause, Loader2, Eye, Search, Filter, XCircle } from 'lucide-react';
import { campaignApi, sessionApi, type Campaign, type Session } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/PageHeader';
import { useNavigate } from 'react-router-dom';
import './Campaigns.css';

const STATUS_COLORS: Record<string, string> = {
  draft: 'status-draft',
  queued: 'status-queued',
  running: 'status-running',
  paused: 'status-paused',
  completed: 'status-completed',
  failed: 'status-failed',
  cancelled: 'status-cancelled',
};

export function Campaigns() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const navigate = useNavigate();
  useDocumentTitle(t('campaigns.title'));

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const data = await campaignApi.list();
      setCampaigns(data);
    } catch {
      addToast({ type: 'error', title: t('campaigns.toasts.error') });
    } finally {
      setLoading(false);
    }
  }, [t, addToast]);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await sessionApi.list();
      setSessions(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void fetchCampaigns();
    void fetchSessions();
  }, [fetchCampaigns, fetchSessions]);

  const handleAction = async (id: string, action: 'start' | 'pause' | 'resume' | 'cancel') => {
    setActionLoading(id);
    try {
      if (action === 'start') await campaignApi.start(id);
      else if (action === 'pause') await campaignApi.pause(id);
      else if (action === 'resume') await campaignApi.resume(id);
      else if (action === 'cancel') await campaignApi.cancel(id);
      addToast({ type: 'success', title: t(`campaigns.toasts.${action === 'start' ? 'started' : action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'cancelled'}`) });
      await fetchCampaigns();
    } catch {
      addToast({ type: 'error', title: t('campaigns.toasts.error') });
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = campaigns.filter(c => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  const getSessionName = (sessionId: string) => sessions.find(s => s.id === sessionId)?.name ?? sessionId.slice(0, 8);

  return (
    <div className="campaigns-page">
      <PageHeader
        title={t('campaigns.title')}
        subtitle={t('campaigns.subtitle')}
        actions={<button className="btn-action" onClick={() => navigate('/campaigns/new')}><Plus size={16} /> {t('campaigns.actions.create')}</button>}
      />
      <div className="campaigns-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="filter-box">
          <Filter size={16} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">{t('campaigns.filter.all')}</option>
            <option value="draft">{t('campaigns.filter.draft')}</option>
            <option value="running">{t('campaigns.filter.running')}</option>
            <option value="paused">{t('campaigns.filter.paused')}</option>
            <option value="completed">{t('campaigns.filter.completed')}</option>
            <option value="failed">{t('campaigns.filter.failed')}</option>
            <option value="cancelled">{t('campaigns.filter.cancelled')}</option>
          </select>
        </div>
      </div>
      {loading ? (
        <div className="loading-state"><Loader2 className="animate-spin" size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Megaphone size={48} className="empty-icon" />
          <h3>{t('campaigns.empty.title')}</h3>
          <p>{t('campaigns.empty.description')}</p>
          <button className="btn-action" onClick={() => navigate('/campaigns/new')}><Plus size={16} /> {t('campaigns.actions.create')}</button>
        </div>
      ) : (
        <div className="campaigns-table">
          <table>
            <thead>
              <tr>
                <th>{t('campaigns.columns.name')}</th>
                <th>{t('campaigns.columns.status')}</th>
                <th>{t('campaigns.columns.session')}</th>
                <th>{t('campaigns.columns.progress')}</th>
                <th>{t('campaigns.columns.sent')}</th>
                <th>{t('campaigns.columns.failed')}</th>
                <th>{t('campaigns.columns.created')}</th>
                <th>{t('campaigns.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td><span className={`status-badge ${STATUS_COLORS[c.status]}`}>{t(`campaigns.filter.${c.status}`)}</span></td>
                  <td>{getSessionName(c.sessionId)}</td>
                  <td>
                    <div className="progress-bar-wrapper">
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${c.percentComplete}%` }} /></div>
                      <span className="progress-text">{c.percentComplete}%</span>
                    </div>
                  </td>
                  <td>{c.sentCount}</td>
                  <td>{c.failedCount}</td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="actions-cell">
                    <button className="btn-icon" title={t('campaigns.actions.view')} onClick={() => navigate(`/campaigns/${c.id}`)}><Eye size={16} /></button>
                    {c.status === 'draft' && (
                      <button className="btn-icon btn-success" disabled={actionLoading === c.id} title={t('campaigns.actions.start')} onClick={() => void handleAction(c.id, 'start')}>
                        {actionLoading === c.id ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                      </button>
                    )}
                    {c.status === 'running' && (
                      <button className="btn-icon btn-warning" disabled={actionLoading === c.id} title={t('campaigns.actions.pause')} onClick={() => void handleAction(c.id, 'pause')}>
                        {actionLoading === c.id ? <Loader2 className="animate-spin" size={16} /> : <Pause size={16} />}
                      </button>
                    )}
                    {c.status === 'paused' && (
                      <button className="btn-icon btn-success" disabled={actionLoading === c.id} title={t('campaigns.actions.resume')} onClick={() => void handleAction(c.id, 'resume')}>
                        {actionLoading === c.id ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                      </button>
                    )}
                    {(c.status === 'running' || c.status === 'paused' || c.status === 'queued') && (
                      <button className="btn-icon btn-danger" disabled={actionLoading === c.id} title={t('campaigns.actions.cancel')} onClick={() => void handleAction(c.id, 'cancel')}>
                        {actionLoading === c.id ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
