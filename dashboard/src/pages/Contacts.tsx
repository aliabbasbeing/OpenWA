import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Upload, Loader2, Trash2, Eye, Download, Smartphone, X } from 'lucide-react';
import { contactListApi, sessionApi, type ContactList, type Session } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/PageHeader';
import './Contacts.css';

export function Contacts() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  useDocumentTitle(t('contacts.title'));

  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [addNumbers, setAddNumbers] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showExtract, setShowExtract] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [extractSessionId, setExtractSessionId] = useState('');
  const [extractName, setExtractName] = useState('');
  const [extracting, setExtracting] = useState(false);

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true);
      const data = await contactListApi.list();
      setLists(data);
    } catch {
      addToast({ type: 'error', title: t('contacts.toasts.error') });
    } finally {
      setLoading(false);
    }
  }, [t, addToast]);

  useEffect(() => { void fetchLists(); }, [fetchLists]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const list = await contactListApi.create({ name: newName, description: newDesc });
      addToast({ type: 'success', title: t('contacts.toasts.created') });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setLists(prev => [...prev, list]);
      setSelectedList(list);
      setShowAddContacts(true);
    } catch {
      addToast({ type: 'error', title: t('contacts.toasts.error') });
    } finally {
      setCreating(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedList) return;
    try {
      const updated = await contactListApi.importCsv(selectedList.id, file);
      addToast({ type: 'success', title: t('contacts.toasts.imported') });
      setLists(prev => prev.map(l => l.id === updated.id ? updated : l));
      setSelectedList(updated);
    } catch {
      addToast({ type: 'error', title: t('contacts.toasts.error') });
    }
  };

  const handleAddContacts = async () => {
    if (!selectedList || !addNumbers.trim()) return;
    const contacts = addNumbers.split('\n').map(n => n.trim()).filter(Boolean).map(number => ({ number }));
    try {
      const updated = await contactListApi.addContacts(selectedList.id, contacts);
      addToast({ type: 'success', title: t('contacts.toasts.contactsAdded') });
      setLists(prev => prev.map(l => l.id === updated.id ? updated : l));
      setSelectedList(updated);
      setShowAddContacts(false);
      setAddNumbers('');
    } catch {
      addToast({ type: 'error', title: t('contacts.toasts.error') });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await contactListApi.delete(id);
      addToast({ type: 'success', title: t('contacts.toasts.deleted') });
      setLists(prev => prev.filter(l => l.id !== id));
      if (selectedList?.id === id) setSelectedList(null);
    } catch {
      addToast({ type: 'error', title: t('contacts.toasts.error') });
    }
  };

  const openExtractModal = async () => {
    setShowExtract(true);
    try {
      const data = await sessionApi.list();
      setSessions(data);
    } catch { /* ignore */ }
  };

  const handleExtract = async () => {
    if (!extractSessionId) return;
    setExtracting(true);
    try {
      const list = await contactListApi.extractFromSession(
        extractSessionId,
        extractName || undefined,
      );
      addToast({ type: 'success', title: t('contacts.toasts.extracted', { count: list.contactCount }) });
      setLists(prev => [...prev, list]);
      setSelectedList(list);
      setShowExtract(false);
      setExtractSessionId('');
      setExtractName('');
    } catch (err: any) {
      const msg = err?.message?.includes('not started')
        ? t('contacts.toasts.sessionNotReady')
        : t('contacts.toasts.extractError');
      addToast({ type: 'error', title: msg });
    } finally {
      setExtracting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedList) return;
    try {
      await contactListApi.exportCsv(selectedList.id);
      addToast({ type: 'success', title: t('contacts.toasts.exported') });
    } catch {
      addToast({ type: 'error', title: t('contacts.toasts.error') });
    }
  };

  return (
    <div className="contacts-page">
      <PageHeader
        title={t('contacts.title')}
        subtitle={t('contacts.subtitle')}
        actions={
          <>
            <button className="btn-action" onClick={() => void openExtractModal()}>
              <Smartphone size={16} /> {t('contacts.actions.extractFromWa')}
            </button>
            <button className="btn-action" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> {t('contacts.actions.create')}
            </button>
          </>
        }
      />

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{t('contacts.create.title')}</h3>
            <label>{t('contacts.create.nameLabel')}</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('contacts.create.namePlaceholder')} />
            <label>{t('contacts.create.descriptionLabel')}</label>
            <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder={t('contacts.create.descriptionPlaceholder')} />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>{t('common.cancel')}</button>
              <button className="btn-action" disabled={creating || !newName.trim()} onClick={() => void handleCreate()}>
                {creating ? <Loader2 className="animate-spin" size={16} /> : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddContacts && selectedList && (
        <div className="modal-overlay" onClick={() => setShowAddContacts(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{t('contacts.detail.addTitle')}</h3>
            <textarea
              value={addNumbers}
              onChange={e => setAddNumbers(e.target.value)}
              placeholder={t('contacts.detail.addPlaceholder')}
              rows={10}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddContacts(false)}>{t('common.cancel')}</button>
              <button className="btn-action" disabled={!addNumbers.trim()} onClick={() => void handleAddContacts()}>{t('contacts.actions.addContacts')}</button>
            </div>
          </div>
        </div>
      )}

      {showExtract && (
        <div className="modal-overlay" onClick={() => setShowExtract(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>{t('contacts.extract.title')}</h3>
              <button className="btn-icon" onClick={() => setShowExtract(false)}><X size={16} /></button>
            </div>
            <p className="modal-hint">{t('contacts.extract.hint')}</p>
            <label>{t('contacts.extract.sessionLabel')}</label>
            <select value={extractSessionId} onChange={e => setExtractSessionId(e.target.value)}>
              <option value="">{t('contacts.extract.sessionPlaceholder')}</option>
              {sessions.filter(s => s.status === 'ready').map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
              ))}
            </select>
            <label>{t('contacts.extract.nameLabel')}</label>
            <input type="text" value={extractName} onChange={e => setExtractName(e.target.value)} placeholder={t('contacts.extract.namePlaceholder')} />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowExtract(false)}>{t('common.cancel')}</button>
              <button className="btn-action" disabled={extracting || !extractSessionId} onClick={() => void handleExtract()}>
                {extracting ? <Loader2 className="animate-spin" size={16} /> : t('contacts.extract.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} accept=".csv" style={{ display: 'none' }} onChange={e => void handleImport(e)} />

      {loading ? (
        <div className="loading-state"><Loader2 className="animate-spin" size={32} /></div>
      ) : lists.length === 0 ? (
        <div className="empty-state">
          <Users size={48} className="empty-icon" />
          <h3>{t('contacts.empty.title')}</h3>
          <p>{t('contacts.empty.description')}</p>
          <div className="empty-actions">
            <button className="btn-action" onClick={() => void openExtractModal()}>
              <Smartphone size={16} /> {t('contacts.actions.extractFromWa')}
            </button>
            <button className="btn-action" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> {t('contacts.actions.create')}
            </button>
          </div>
        </div>
      ) : (
        <div className="contacts-layout">
          <div className="contacts-sidebar">
            {lists.map(list => (
              <div
                key={list.id}
                className={`contact-list-item ${selectedList?.id === list.id ? 'selected' : ''}`}
                onClick={() => setSelectedList(list)}
              >
                <div className="list-info">
                  <strong>{list.name}</strong>
                  <span>{list.contactCount} contacts</span>
                </div>
                <button className="btn-icon btn-danger" onClick={e => { e.stopPropagation(); void handleDelete(list.id); }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="contacts-content">
            {selectedList ? (
              <>
                <div className="contacts-toolbar">
                  <h3>{selectedList.name}</h3>
                  <div className="toolbar-actions">
                    <button className="btn-action" onClick={() => setShowAddContacts(true)}><Plus size={16} /> {t('contacts.actions.addContacts')}</button>
                    <button className="btn-action" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> {t('contacts.actions.import')}</button>
                    <button className="btn-action" onClick={() => void handleExportCsv()}><Download size={16} /> {t('contacts.actions.exportCsv')}</button>
                  </div>
                </div>
                <div className="contacts-table">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('contacts.detail.numberColumn')}</th>
                        <th>{t('contacts.detail.nameColumn')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedList.contacts.map((c, i) => (
                        <tr key={i}>
                          <td>{c.number}</td>
                          <td>{c.name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="empty-state"><Eye size={48} className="empty-icon" /><p>{t('contacts.empty.selectList')}</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
