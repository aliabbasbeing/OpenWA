import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldBan, Plus, Upload, Loader2, Trash2, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import { blacklistApi, sessionApi, type BlacklistEntry, type Session } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/PageHeader';
import './Blacklist.css';

export function Blacklist() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  useDocumentTitle(t('blacklist.title'));

  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [addNumber, setAddNumber] = useState('');
  const [addReason, setAddReason] = useState('');
  const [addSession, setAddSession] = useState('');
  const [importNumbers, setImportNumbers] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [checkResult, setCheckResult] = useState<{ isBlacklisted: boolean; entry?: BlacklistEntry } | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const data = await blacklistApi.list();
      setEntries(data);
    } catch {
      addToast({ type: 'error', title: t('blacklist.toasts.error') });
    } finally {
      setLoading(false);
    }
  }, [t, addToast]);

  const fetchSessions = useCallback(async () => {
    try { setSessions(await sessionApi.list()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { void fetchEntries(); void fetchSessions(); }, [fetchEntries, fetchSessions]);

  const handleAdd = async () => {
    if (!addNumber.trim()) return;
    try {
      const entry = await blacklistApi.add({ number: addNumber, reason: addReason || undefined, sessionId: addSession || undefined });
      addToast({ type: 'success', title: t('blacklist.toasts.added') });
      setEntries(prev => [...prev, entry]);
      setShowAdd(false);
      setAddNumber('');
      setAddReason('');
      setAddSession('');
    } catch {
      addToast({ type: 'error', title: t('blacklist.toasts.error') });
    }
  };

  const handleImport = async () => {
    const nums = importNumbers.split('\n').map(n => n.trim()).filter(Boolean);
    if (nums.length === 0) return;
    try {
      const result = await blacklistApi.import(nums, addReason || undefined, addSession || undefined);
      addToast({ type: 'success', title: t('blacklist.toasts.imported') + ` (${result.imported} imported, ${result.skipped} skipped)` });
      setShowImport(false);
      setImportNumbers('');
      void fetchEntries();
    } catch {
      addToast({ type: 'error', title: t('blacklist.toasts.error') });
    }
  };

  const handleCheck = async () => {
    if (!checkNumber.trim()) return;
    try {
      const result = await blacklistApi.check(checkNumber);
      setCheckResult(result);
    } catch {
      addToast({ type: 'error', title: t('blacklist.toasts.error') });
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await blacklistApi.remove(id);
      addToast({ type: 'success', title: t('blacklist.toasts.removed') });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {
      addToast({ type: 'error', title: t('blacklist.toasts.error') });
    }
  };

  const getSessionName = (sessionId?: string | null) => {
    if (!sessionId) return t('blacklist.sessionScope.global');
    return sessions.find(s => s.id === sessionId)?.name ?? sessionId.slice(0, 8);
  };

  return (
    <div className="blacklist-page">
      <PageHeader
        title={t('blacklist.title')}
        subtitle={t('blacklist.subtitle')}
        actions={
          <div className="header-actions">
            <button className="btn-action" onClick={() => setShowAdd(true)}><Plus size={16} /> {t('blacklist.actions.add')}</button>
            <button className="btn-action" onClick={() => setShowImport(true)}><Upload size={16} /> {t('blacklist.actions.import')}</button>
            <button className="btn-action" onClick={() => setShowCheck(true)}><Search size={16} /> {t('blacklist.actions.check')}</button>
          </div>
        }
      />

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{t('blacklist.add.title')}</h3>
            <label>{t('blacklist.add.numberLabel')}</label>
            <input type="text" value={addNumber} onChange={e => setAddNumber(e.target.value)} placeholder={t('blacklist.add.numberPlaceholder')} />
            <label>{t('blacklist.add.reasonLabel')}</label>
            <input type="text" value={addReason} onChange={e => setAddReason(e.target.value)} placeholder={t('blacklist.add.reasonPlaceholder')} />
            <label>{t('blacklist.add.sessionLabel')}</label>
            <select value={addSession} onChange={e => setAddSession(e.target.value)}>
              <option value="">{t('blacklist.sessionScope.global')}</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>{t('common.cancel')}</button>
              <button className="btn-action" disabled={!addNumber.trim()} onClick={() => void handleAdd()}>{t('blacklist.actions.add')}</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{t('blacklist.import.title')}</h3>
            <textarea
              value={importNumbers}
              onChange={e => setImportNumbers(e.target.value)}
              placeholder={t('blacklist.import.placeholder')}
              rows={10}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowImport(false)}>{t('common.cancel')}</button>
              <button className="btn-action" disabled={!importNumbers.trim()} onClick={() => void handleImport()}>{t('blacklist.actions.import')}</button>
            </div>
          </div>
        </div>
      )}

      {showCheck && (
        <div className="modal-overlay" onClick={() => { setShowCheck(false); setCheckResult(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{t('blacklist.check.title')}</h3>
            <input type="text" value={checkNumber} onChange={e => { setCheckNumber(e.target.value); setCheckResult(null); }} placeholder={t('blacklist.check.placeholder')} />
            {checkResult && (
              <div className={`check-result ${checkResult.isBlacklisted ? 'blocked' : 'allowed'}`}>
                {checkResult.isBlacklisted ? <><AlertTriangle size={20} /> {t('blacklist.check.resultBlocked')}</> : <><CheckCircle size={20} /> {t('blacklist.check.resultAllowed')}</>}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowCheck(false); setCheckResult(null); }}>{t('common.cancel')}</button>
              <button className="btn-action" disabled={!checkNumber.trim()} onClick={() => void handleCheck()}>{t('blacklist.actions.check')}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state"><Loader2 className="animate-spin" size={32} /></div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <ShieldBan size={48} className="empty-icon" />
          <h3>{t('blacklist.empty.title')}</h3>
          <p>{t('blacklist.empty.description')}</p>
        </div>
      ) : (
        <div className="blacklist-table">
          <table>
            <thead>
              <tr>
                <th>{t('blacklist.columns.number')}</th>
                <th>{t('blacklist.columns.reason')}</th>
                <th>{t('blacklist.columns.session')}</th>
                <th>{t('blacklist.columns.added')}</th>
                <th>{t('blacklist.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td><code>{e.number}</code></td>
                  <td>{e.reason || '—'}</td>
                  <td>{getSessionName(e.sessionId)}</td>
                  <td>{new Date(e.createdAt).toLocaleDateString()}</td>
                  <td><button className="btn-icon btn-danger" onClick={() => void handleRemove(e.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
