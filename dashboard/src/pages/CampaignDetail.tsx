import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Play, Pause, XCircle, Loader2, Megaphone, Settings, Save, X } from 'lucide-react';
import { campaignApi, type Campaign, type CampaignProgress, type CampaignSettings } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import './Campaigns.css';

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { addToast } = useToast();
  const navigate = useNavigate();
  useDocumentTitle(t('campaigns.detail.title'));

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSettings, setEditSettings] = useState<Partial<CampaignSettings>>({});
  const [saving, setSaving] = useState(false);

  const fetchCampaign = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await campaignApi.get(id);
      setCampaign(data);
      const prog = await campaignApi.getProgress(id);
      setProgress(prog);
    } catch {
      addToast({ type: 'error', title: t('campaigns.toasts.error') });
    } finally {
      setLoading(false);
    }
  }, [id, t, addToast]);

  useEffect(() => { void fetchCampaign(); }, [fetchCampaign]);

  useEffect(() => {
    if (!id || !campaign || campaign.status !== 'running') return;
    const interval = setInterval(async () => {
      try {
        const prog = await campaignApi.getProgress(id);
        setProgress(prog);
        if (prog.status === 'completed' || prog.status === 'failed' || prog.status === 'cancelled') {
          await fetchCampaign();
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, campaign?.status, fetchCampaign]);

  useEffect(() => {
    if (campaign) setEditSettings({ ...campaign.settings });
  }, [campaign]);

  const handleAction = async (action: 'start' | 'pause' | 'resume' | 'cancel') => {
    if (!id) return;
    setActionLoading(true);
    try {
      if (action === 'start') await campaignApi.start(id);
      else if (action === 'pause') await campaignApi.pause(id);
      else if (action === 'resume') await campaignApi.resume(id);
      else if (action === 'cancel') await campaignApi.cancel(id);
      addToast({ type: 'success', title: t(`campaigns.toasts.${action === 'start' ? 'started' : action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'cancelled'}`) });
      await fetchCampaign();
    } catch {
      addToast({ type: 'error', title: t('campaigns.toasts.error') });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await campaignApi.update(id, { settings: editSettings });
      addToast({ type: 'success', title: 'Settings updated' });
      setEditing(false);
      await fetchCampaign();
    } catch {
      addToast({ type: 'error', title: t('campaigns.toasts.error') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-state"><Loader2 className="animate-spin" size={32} /></div>;
  if (!campaign) return null;

  const canEdit = campaign.status === 'running' || campaign.status === 'paused' || campaign.status === 'draft';

  return (
    <div className="campaign-detail-page">
      <div className="detail-header">
        <button className="btn-back" onClick={() => navigate('/campaigns')}><ArrowLeft size={16} /></button>
        <div className="detail-header-info">
          <h2>{campaign.name}</h2>
          <span className={`status-badge status-${campaign.status}`}>{campaign.status}</span>
        </div>
        <div className="detail-header-actions">
          {canEdit && (
            editing
              ? <><button className="btn-action" disabled={saving} onClick={() => void handleSaveSettings()}><Save size={16} /> {t('common.save')}</button><button className="btn-secondary" onClick={() => { setEditing(false); setEditSettings({ ...campaign.settings }); }}><X size={16} /> {t('common.cancel')}</button></>
              : <button className="btn-action" onClick={() => setEditing(true)}><Settings size={16} /> Edit Settings</button>
          )}
          {campaign.status === 'draft' && <button className="btn-action" disabled={actionLoading} onClick={() => void handleAction('start')}><Play size={16} /> {t('campaigns.actions.start')}</button>}
          {campaign.status === 'running' && <button className="btn-action" disabled={actionLoading} onClick={() => void handleAction('pause')}><Pause size={16} /> {t('campaigns.actions.pause')}</button>}
          {campaign.status === 'paused' && <button className="btn-action" disabled={actionLoading} onClick={() => void handleAction('resume')}><Play size={16} /> {t('campaigns.actions.resume')}</button>}
          {(campaign.status === 'running' || campaign.status === 'paused' || campaign.status === 'queued') && <button className="btn-action btn-danger" disabled={actionLoading} onClick={() => void handleAction('cancel')}><XCircle size={16} /> {t('campaigns.actions.cancel')}</button>}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <h3><Megaphone size={16} /> {t('campaigns.detail.progress')}</h3>
          {progress ? (
            <div className="progress-detail">
              <div className="progress-bar-large">
                <div className="progress-fill" style={{ width: `${progress.percentComplete}%` }} />
              </div>
              <p className="progress-label">
                {t('campaigns.detail.progressBar', { sent: progress.sentCount, total: progress.totalContacts, percent: progress.percentComplete })}
              </p>
              <div className="progress-stats">
                <div><span className="stat-label">{t('campaigns.columns.sent')}</span> <span className="stat-value">{progress.sentCount}</span></div>
                <div><span className="stat-label">{t('campaigns.columns.failed')}</span> <span className="stat-value">{progress.failedCount}</span></div>
                <div><span className="stat-label">Delivered</span> <span className="stat-value">{progress.deliveredCount}</span></div>
                <div><span className="stat-label">Read</span> <span className="stat-value">{progress.readCount}</span></div>
              </div>
            </div>
          ) : (
            <p>{t('campaigns.detail.noMessages')}</p>
          )}
        </div>

        <div className="detail-card">
          <h3>{t('campaigns.detail.settings')}</h3>
          {editing ? (
            <div className="settings-edit">
              <div className="setting-row">
                <label>{t('campaigns.create.delayMinLabel')}</label>
                <input type="number" value={editSettings.delayMin ?? 30} onChange={e => setEditSettings(s => ({ ...s, delayMin: +e.target.value }))} min={5} />
              </div>
              <div className="setting-row">
                <label>{t('campaigns.create.delayMaxLabel')}</label>
                <input type="number" value={editSettings.delayMax ?? 90} onChange={e => setEditSettings(s => ({ ...s, delayMax: +e.target.value }))} min={5} />
              </div>
              <div className="setting-row">
                <label>{t('campaigns.create.dailyLimitLabel')}</label>
                <input type="number" value={editSettings.dailyLimit ?? 500} onChange={e => setEditSettings(s => ({ ...s, dailyLimit: +e.target.value }))} min={1} />
              </div>
              <div className="setting-row">
                <label>{t('campaigns.create.hourlyLimitLabel')}</label>
                <input type="number" value={editSettings.hourlyLimit ?? 50} onChange={e => setEditSettings(s => ({ ...s, hourlyLimit: +e.target.value }))} min={1} />
              </div>
              <div className="setting-row">
                <label>{t('campaigns.detail.timeWindow')}</label>
                <div className="time-range">
                  <input type="time" value={editSettings.timeWindowStart ?? '09:00'} onChange={e => setEditSettings(s => ({ ...s, timeWindowStart: e.target.value }))} />
                  <span>-</span>
                  <input type="time" value={editSettings.timeWindowEnd ?? '18:00'} onChange={e => setEditSettings(s => ({ ...s, timeWindowEnd: e.target.value }))} />
                </div>
              </div>
              <div className="checkbox-rows">
                <label><input type="checkbox" checked={editSettings.respectBusinessHours ?? false} onChange={e => setEditSettings(s => ({ ...s, respectBusinessHours: e.target.checked }))} /> {t('campaigns.create.respectHoursLabel')}</label>
                <label><input type="checkbox" checked={editSettings.skipWeekends ?? false} onChange={e => setEditSettings(s => ({ ...s, skipWeekends: e.target.checked }))} /> {t('campaigns.create.skipWeekendsLabel')}</label>
                <label><input type="checkbox" checked={editSettings.warmupEnabled ?? false} onChange={e => setEditSettings(s => ({ ...s, warmupEnabled: e.target.checked }))} /> {t('campaigns.create.warmupLabel')}</label>
                <label><input type="checkbox" checked={editSettings.randomizeOrder ?? false} onChange={e => setEditSettings(s => ({ ...s, randomizeOrder: e.target.checked }))} /> {t('campaigns.create.randomizeLabel')}</label>
              </div>
            </div>
          ) : (
            <dl className="settings-list">
              <dt>{t('campaigns.detail.delay')}</dt>
              <dd>{t('campaigns.detail.delayRange', { min: campaign.settings.delayMin, max: campaign.settings.delayMax })}</dd>
              <dt>{t('campaigns.detail.dailyLimit')}</dt>
              <dd>{campaign.settings.dailyLimit}</dd>
              <dt>{t('campaigns.detail.hourlyLimit')}</dt>
              <dd>{campaign.settings.hourlyLimit}</dd>
              <dt>{t('campaigns.detail.timeWindow')}</dt>
              <dd>{campaign.settings.timeWindowStart} - {campaign.settings.timeWindowEnd}</dd>
              <dt>{t('campaigns.detail.businessHours')}</dt>
              <dd>{campaign.settings.respectBusinessHours ? '✓' : '—'}</dd>
              <dt>{t('campaigns.detail.weekends')}</dt>
              <dd>{campaign.settings.skipWeekends ? '✓' : '—'}</dd>
              <dt>{t('campaigns.detail.warmup')}</dt>
              <dd>{campaign.settings.warmupEnabled ? '✓' : '—'}</dd>
              <dt>{t('campaigns.detail.randomize')}</dt>
              <dd>{campaign.settings.randomizeOrder ? '✓' : '—'}</dd>
            </dl>
          )}
        </div>

        <div className="detail-card">
          <h3>{t('campaigns.detail.messageVariations')}</h3>
          <div className="message-preview">
            {campaign.messageVariations.length > 0 ? (
              campaign.messageVariations.map((msg, i) => (
                <div key={i} className="message-variation">
                  <span className="variation-label">#{i + 1}</span>
                  <pre>{msg}</pre>
                </div>
              ))
            ) : (
              <div className="message-variation">
                <span className="variation-label">#1</span>
                <pre>{campaign.messageTemplate}</pre>
              </div>
            )}
          </div>
        </div>

        <div className="detail-card">
          <h3>{t('campaigns.detail.contacts')}</h3>
          <p>{campaign.totalContacts} contacts ({campaign.contactSource === 'contact_list' ? 'from list' : 'manual'})</p>
          {campaign.manualContacts.length > 0 && (
            <div className="contact-list-preview">
              {campaign.manualContacts.slice(0, 10).map((num, i) => <div key={i}>{num}</div>)}
              {campaign.manualContacts.length > 10 && <div className="more">...and {campaign.manualContacts.length - 10} more</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
