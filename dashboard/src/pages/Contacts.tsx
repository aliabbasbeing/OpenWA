import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Upload, Loader2, Trash2, Eye } from 'lucide-react';
import { contactListApi, type ContactList } from '../services/api';
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

  return (
    <div className="contacts-page">
      <PageHeader
        title={t('contacts.title')}
        subtitle={t('contacts.subtitle')}
        actions={<button className="btn-action" onClick={() => setShowCreate(true)}><Plus size={16} /> {t('contacts.actions.create')}</button>}
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

      <input type="file" ref={fileInputRef} accept=".csv" style={{ display: 'none' }} onChange={e => void handleImport(e)} />

      {loading ? (
        <div className="loading-state"><Loader2 className="animate-spin" size={32} /></div>
      ) : lists.length === 0 ? (
        <div className="empty-state">
          <Users size={48} className="empty-icon" />
          <h3>{t('contacts.empty.title')}</h3>
          <p>{t('contacts.empty.description')}</p>
          <button className="btn-action" onClick={() => setShowCreate(true)}><Plus size={16} /> {t('contacts.actions.create')}</button>
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
              <div className="empty-state"><Eye size={48} className="empty-icon" /><p>Select a list to view contacts</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
