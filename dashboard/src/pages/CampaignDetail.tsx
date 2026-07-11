import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Play, Pause, XCircle, Loader2, Megaphone, Settings, Save, X, Copy, ChevronRight, MessageSquare } from 'lucide-react';
import { campaignApi, type Campaign, type CampaignProgress, type CampaignSettings } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import './Campaigns.css';

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function highlightVariables(template: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, '<span class="variable-highlight">{{$1}}</span>');
}

function sampleRender(template: string): string {
  const samples: Record<string, string> = {
    name: 'John',
    number: '+1 555-1234',
    phone: '+1 555-1234',
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return samples[key] ?? `[${key}]`;
  });
}

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

  const handleDuplicate = async () => {
    if (!id) return;
    try {
      const newCampaign = await campaignApi.duplicate(id);
      addToast({ type: 'success', title: t('campaigns.duplicate.successTitle'), message: t('campaigns.duplicate.success') });
      navigate(`/campaigns/${newCampaign.id}`);
    } catch {
      addToast({ type: 'error', title: t('campaigns.duplicate.errorTitle'), message: t('campaigns.duplicate.error') });
    }
  };

  const stats = useMemo(() => {
    const p = progress ?? campaign;
    if (!p) return null;
    const total = (p as CampaignProgress).totalContacts ?? (campaign?.totalContacts ?? 0);
    const sent = (p as CampaignProgress).sentCount ?? campaign?.sentCount ?? 0;
    const failed = (p as CampaignProgress).failedCount ?? campaign?.failedCount ?? 0;
    const delivered = (p as CampaignProgress).deliveredCount ?? campaign?.deliveredCount ?? 0;
    const read = (p as CampaignProgress).readCount ?? campaign?.readCount ?? 0;
    const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;
    return { total, sent, failed, delivered, read, pct };
  }, [progress, campaign]);

  const timelineSteps = useMemo(() => {
    if (!campaign) return [];
    const s = campaign.status;
    const created = campaign.createdAt ?? null;
    const started = campaign.startedAt ?? null;
    const completed = campaign.completedAt ?? null;

    const steps: Array<{ key: string; label: string; timestamp: string | null; state: 'past' | 'current' | 'future' | 'error' }> = [];

    steps.push({ key: 'created', label: 'Created', timestamp: created, state: 'past' });

    if (s === 'draft' || s === 'queued') {
      steps.push({ key: 'started', label: 'Started', timestamp: null, state: s === 'queued' ? 'current' : 'future' });
      steps.push({ key: 'completed', label: 'Completed', timestamp: null, state: 'future' });
    } else if (s === 'running') {
      steps.push({ key: 'started', label: 'Started', timestamp: started, state: 'current' });
      steps.push({ key: 'completed', label: 'Completed', timestamp: null, state: 'future' });
    } else if (s === 'paused') {
      steps.push({ key: 'started', label: 'Started', timestamp: started, state: 'past' });
      steps.push({ key: 'paused', label: 'Paused', timestamp: null, state: 'current' });
      steps.push({ key: 'completed', label: 'Completed', timestamp: null, state: 'future' });
    } else if (s === 'completed') {
      steps.push({ key: 'started', label: 'Started', timestamp: started, state: 'past' });
      steps.push({ key: 'completed', label: 'Completed', timestamp: completed, state: 'current' });
    } else if (s === 'failed') {
      steps.push({ key: 'started', label: 'Started', timestamp: started, state: 'past' });
      steps.push({ key: 'failed', label: 'Failed', timestamp: completed, state: 'error' });
    } else if (s === 'cancelled') {
      steps.push({ key: 'started', label: 'Started', timestamp: started, state: 'past' });
      steps.push({ key: 'cancelled', label: 'Cancelled', timestamp: completed, state: 'error' });
    }

    return steps;
  }, [campaign]);

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
          {campaign.sentCount > 0 && (
            <button className="btn-secondary" onClick={() => navigate(`/campaigns/${id}/messages`)}><MessageSquare size={16} /> {t('campaigns.messages.viewMessages')}</button>
          )}
          <button className="btn-secondary" onClick={() => void handleDuplicate()}><Copy size={16} /> {t('campaigns.actions.duplicate')}</button>
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

      {timelineSteps.length > 0 && (
        <div className="status-timeline">
          {timelineSteps.map((step, i) => (
            <div key={step.key} className="timeline-step">
              {i > 0 && <div className={`timeline-connector ${step.state === 'past' || (timelineSteps[i - 1]?.state === 'past' && step.state !== 'future') ? 'past' : ''}`} />}
              <div className="timeline-dot-wrapper">
                <div className={`timeline-dot ${step.state}`} />
                <span className={`timeline-label ${step.state === 'current' || step.state === 'past' ? 'active' : ''}`}>{step.label}</span>
                {step.timestamp && <span className="timeline-timestamp">{formatTime(step.timestamp)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-card full-width">
          <h3><Megaphone size={16} /> {t('campaigns.detail.progress')}</h3>
          {progress && stats ? (
            <div className="progress-detail">
              <div className="progress-bar-large">
                <div className="progress-fill" style={{ width: `${progress.percentComplete}%` }} />
              </div>
              <p className="progress-label">
                {t('campaigns.detail.progressBar', { sent: progress.sentCount, total: progress.totalContacts, percent: progress.percentComplete })}
              </p>

              <div className="stat-boxes-grid">
                <div className="stat-box sent">
                  <div className="stat-box-label">{t('campaigns.columns.sent')}</div>
                  <div className="stat-box-value">{stats.sent}</div>
                  <div className="stat-box-pct">{stats.pct(stats.sent)}% of total</div>
                </div>
                <div className="stat-box failed">
                  <div className="stat-box-label">{t('campaigns.columns.failed')}</div>
                  <div className="stat-box-value">{stats.failed}</div>
                  <div className="stat-box-pct">{stats.pct(stats.failed)}% of total</div>
                </div>
                <div className="stat-box delivered">
                  <div className="stat-box-label">Delivered</div>
                  <div className="stat-box-value">{stats.delivered}</div>
                  <div className="stat-box-pct">{stats.pct(stats.delivered)}% of total</div>
                </div>
                <div className="stat-box read">
                  <div className="stat-box-label">Read</div>
                  <div className="stat-box-value">{stats.read}</div>
                  <div className="stat-box-pct">{stats.pct(stats.read)}% of total</div>
                </div>
              </div>

              <div className="delivery-funnel">
                <div className="funnel-step sent">
                  <span className="funnel-step-label">Sent</span>
                  <span className="funnel-step-count">{stats.sent}</span>
                  <span className="funnel-step-pct">{stats.pct(stats.sent)}%</span>
                  <div className="funnel-step-bar"><div className="funnel-step-fill" style={{ width: `${stats.pct(stats.sent)}%` }} /></div>
                </div>
                <div className="funnel-arrow"><ChevronRight size={18} /></div>
                <div className="funnel-step delivered">
                  <span className="funnel-step-label">Delivered</span>
                  <span className="funnel-step-count">{stats.delivered}</span>
                  <span className="funnel-step-pct">{stats.pct(stats.delivered)}%</span>
                  <div className="funnel-step-bar"><div className="funnel-step-fill" style={{ width: `${stats.pct(stats.delivered)}%` }} /></div>
                </div>
                <div className="funnel-arrow"><ChevronRight size={18} /></div>
                <div className="funnel-step read">
                  <span className="funnel-step-label">Read</span>
                  <span className="funnel-step-count">{stats.read}</span>
                  <span className="funnel-step-pct">{stats.pct(stats.read)}%</span>
                  <div className="funnel-step-bar"><div className="funnel-step-fill" style={{ width: `${stats.pct(stats.read)}%` }} /></div>
                </div>
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
                  <pre dangerouslySetInnerHTML={{ __html: highlightVariables(msg) }} />
                </div>
              ))
            ) : (
              <div className="message-variation">
                <span className="variation-label">#1</span>
                <pre dangerouslySetInnerHTML={{ __html: highlightVariables(campaign.messageTemplate) }} />
              </div>
            )}
          </div>
          <div className="message-render-preview">
            <div className="preview-title">Sample Render</div>
            <div
              className="preview-content"
              dangerouslySetInnerHTML={{ __html: highlightVariables(sampleRender(campaign.messageVariations.length > 0 ? campaign.messageVariations[0] : campaign.messageTemplate)) }}
            />
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

export default CampaignDetail;
