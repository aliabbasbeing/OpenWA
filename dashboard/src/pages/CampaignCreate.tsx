import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Plus, Trash2, Loader2, Megaphone } from 'lucide-react';
import { campaignApi, contactListApi, sessionApi, type Session, type ContactList } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import './Campaigns.css';

export function CampaignCreate() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const navigate = useNavigate();
  useDocumentTitle(t('campaigns.create.title'));

  const [step, setStep] = useState(1);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [messageVariations, setMessageVariations] = useState<string[]>([]);
  const [contactSource, setContactSource] = useState<'manual' | 'contact_list'>('manual');
  const [contactListId, setContactListId] = useState('');
  const [manualContacts, setManualContacts] = useState('');
  const [dailyLimit, setDailyLimit] = useState(100);
  const [hourlyLimit, setHourlyLimit] = useState(20);
  const [delayMin, setDelayMin] = useState(30);
  const [delayMax, setDelayMax] = useState(90);
  const [timeWindowStart, setTimeWindowStart] = useState('09:00');
  const [timeWindowEnd, setTimeWindowEnd] = useState('18:00');
  const [respectBusinessHours, setRespectBusinessHours] = useState(true);
  const [skipWeekends, setSkipWeekends] = useState(false);
  const [warmupEnabled, setWarmupEnabled] = useState(false);
  const [randomizeOrder, setRandomizeOrder] = useState(false);

  useEffect(() => {
    void (async () => {
      try { setSessions(await sessionApi.list()); } catch { /* ignore */ }
      try { setContactLists(await contactListApi.list()); } catch { /* ignore */ }
    })();
  }, []);

  const addVariation = () => setMessageVariations(prev => [...prev, '']);
  const updateVariation = (index: number, value: string) => setMessageVariations(prev => prev.map((v, i) => i === index ? value : v));
  const removeVariation = (index: number) => setMessageVariations(prev => prev.filter((_, i) => i !== index));

  const readySessions = sessions.filter(s => s.status === 'ready');

  const handleSubmit = async (andStart = false) => {
    if (!name.trim() || !sessionId.trim() || !messageTemplate.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        name,
        sessionId,
        messageTemplate,
        messageVariations: messageVariations.filter(v => v.trim()),
        contactSource,
        contactListId: contactSource === 'contact_list' ? contactListId : undefined,
        manualContacts: contactSource === 'manual' ? manualContacts.split('\n').map(n => n.trim()).filter(Boolean) : [],
        settings: { dailyLimit, hourlyLimit, delayMin, delayMax, timeWindowStart, timeWindowEnd, respectBusinessHours, skipWeekends, warmupEnabled, randomizeOrder },
      };
      const campaign = await campaignApi.create(payload);
      if (andStart) await campaignApi.start(campaign.id);
      addToast({ type: 'success', title: t(`campaigns.toasts.${andStart ? 'started' : 'created'}`) });
      navigate('/campaigns');
    } catch {
      addToast({ type: 'error', title: t('campaigns.toasts.error') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="campaign-create-page">
      <div className="detail-header">
        <button className="btn-back" onClick={() => navigate('/campaigns')}><ArrowLeft size={16} /></button>
        <h2>{t('campaigns.create.title')}</h2>
      </div>

      <div className="wizard-steps">
        <div className={`wizard-step ${step >= 1 ? 'active' : ''}`}>{t('campaigns.create.step1')}</div>
        <div className={`wizard-step ${step >= 2 ? 'active' : ''}`}>{t('campaigns.create.step2')}</div>
        <div className={`wizard-step ${step >= 3 ? 'active' : ''}`}>{t('campaigns.create.step3')}</div>
        <div className={`wizard-step ${step >= 4 ? 'active' : ''}`}>{t('campaigns.create.step4')}</div>
      </div>

      <div className="wizard-content">
        {step === 1 && (
          <div className="wizard-panel">
            <label>{t('campaigns.create.nameLabel')}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('campaigns.create.namePlaceholder')} />
            <label>{t('campaigns.create.sessionLabel')}</label>
            <select value={sessionId} onChange={e => setSessionId(e.target.value)}>
              <option value="">{t('campaigns.create.sessionPlaceholder')}</option>
              {readySessions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>)}
            </select>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-panel">
            <label>{t('campaigns.create.messageLabel')}</label>
            <textarea
              value={messageTemplate}
              onChange={e => setMessageTemplate(e.target.value)}
              placeholder={t('campaigns.create.messagePlaceholder')}
              rows={6}
            />
            <p className="hint">{t('campaigns.create.variablesHint')}</p>
            <label>{t('campaigns.create.variationsLabel')}</label>
            {messageVariations.map((v, i) => (
              <div key={i} className="variation-row">
                <textarea value={v} onChange={e => updateVariation(i, e.target.value)} placeholder={`${t('campaigns.create.variationsPlaceholder')} #${i + 1}`} rows={3} />
                <button className="btn-icon btn-danger" onClick={() => removeVariation(i)}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="btn-secondary" onClick={addVariation}><Plus size={14} /> {t('campaigns.create.addVariation')}</button>
          </div>
        )}

        {step === 3 && (
          <div className="wizard-panel">
            <label>{t('campaigns.create.contactSourceLabel')}</label>
            <div className="radio-group">
              <label><input type="radio" value="manual" checked={contactSource === 'manual'} onChange={() => setContactSource('manual')} /> {t('campaigns.create.manualOption')}</label>
              <label><input type="radio" value="contact_list" checked={contactSource === 'contact_list'} onChange={() => setContactSource('contact_list')} /> {t('campaigns.create.contactListOption')}</label>
            </div>
            {contactSource === 'contact_list' ? (
              <>
                <label>{t('campaigns.create.contactListLabel')}</label>
                <select value={contactListId} onChange={e => setContactListId(e.target.value)}>
                  <option value="">--</option>
                  {contactLists.map(cl => <option key={cl.id} value={cl.id}>{cl.name} ({cl.contactCount})</option>)}
                </select>
              </>
            ) : (
              <>
                <label>{t('campaigns.columns.sent')} ({t('campaigns.create.manualPlaceholder')})</label>
                <textarea
                  value={manualContacts}
                  onChange={e => setManualContacts(e.target.value)}
                  placeholder={t('campaigns.create.manualPlaceholder')}
                  rows={10}
                />
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="wizard-panel">
            <div className="settings-grid">
              <div className="setting-item">
                <label>{t('campaigns.create.dailyLimitLabel')}</label>
                <input type="number" value={dailyLimit} onChange={e => setDailyLimit(+e.target.value)} min={1} />
              </div>
              <div className="setting-item">
                <label>{t('campaigns.create.hourlyLimitLabel')}</label>
                <input type="number" value={hourlyLimit} onChange={e => setHourlyLimit(+e.target.value)} min={1} />
              </div>
              <div className="setting-item">
                <label>{t('campaigns.create.delayMinLabel')}</label>
                <input type="number" value={delayMin} onChange={e => setDelayMin(+e.target.value)} min={5} />
              </div>
              <div className="setting-item">
                <label>{t('campaigns.create.delayMaxLabel')}</label>
                <input type="number" value={delayMax} onChange={e => setDelayMax(+e.target.value)} min={5} />
              </div>
              <div className="setting-item">
                <label>{t('campaigns.create.timeWindowLabel')}</label>
                <div className="time-range">
                  <input type="time" value={timeWindowStart} onChange={e => setTimeWindowStart(e.target.value)} />
                  <span>-</span>
                  <input type="time" value={timeWindowEnd} onChange={e => setTimeWindowEnd(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="checkbox-group">
              <label><input type="checkbox" checked={respectBusinessHours} onChange={e => setRespectBusinessHours(e.target.checked)} /> {t('campaigns.create.respectHoursLabel')}</label>
              <label><input type="checkbox" checked={skipWeekends} onChange={e => setSkipWeekends(e.target.checked)} /> {t('campaigns.create.skipWeekendsLabel')}</label>
              <label><input type="checkbox" checked={warmupEnabled} onChange={e => setWarmupEnabled(e.target.checked)} /> {t('campaigns.create.warmupLabel')}</label>
              <label><input type="checkbox" checked={randomizeOrder} onChange={e => setRandomizeOrder(e.target.checked)} /> {t('campaigns.create.randomizeLabel')}</label>
            </div>
          </div>
        )}
      </div>

      <div className="wizard-footer">
        {step > 1 && <button className="btn-secondary" onClick={() => setStep(s => s - 1)}><ArrowLeft size={16} /> {t('campaigns.create.back')}</button>}
        <div className="spacer" />
        {step < 4 ? (
          <button className="btn-action" onClick={() => setStep(s => s + 1)}>{t('campaigns.create.next')} <ArrowRight size={16} /></button>
        ) : (
          <div className="finish-actions">
            <button className="btn-action" disabled={submitting || !name.trim() || !sessionId.trim() || !messageTemplate.trim()} onClick={() => void handleSubmit(false)}>
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Megaphone size={16} />} {t('campaigns.create.create')}
            </button>
            <button className="btn-action btn-success" disabled={submitting || !name.trim() || !sessionId.trim() || !messageTemplate.trim()} onClick={() => void handleSubmit(true)}>
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Megaphone size={16} />} {t('campaigns.create.createAndStart')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
