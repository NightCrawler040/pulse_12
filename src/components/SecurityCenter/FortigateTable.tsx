import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { Plus, Trash2 } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';

export const FortigateTable: React.FC = () => {
  const { activeWorkspaceId } = useTaskContext();
  const [loading, setLoading] = useState(true);
  const [bannedIps, setBannedIps] = useState<any[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [newIndicatorIp, setNewIndicatorIp] = useState('');
  const [newIndicatorValidFrom, setNewIndicatorValidFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [newIndicatorValidTo, setNewIndicatorValidTo] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return date.toISOString().split('T')[0];
  });
  const [isAdding, setIsAdding] = useState(false);

  const fetchBannedIps = async () => {
    try {
      const res: any = await apiService.get('/api/fortigate/banned-ips');
      if (res.success) {
        setBannedIps(res.bannedIps);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBannedIps();
  }, []);

  const handleUnban = async (ip: string) => {
    if (!window.confirm("Удалить блокировку для IP " + ip + "?")) return;
    try {
      const res: any = await apiService.post('/api/fortigate/unban', { ip, workspaceId: activeWorkspaceId });
      if (res.success) {
        setBannedIps(prev => prev.filter(b => b.ip !== ip));
        setMessage({ text: "IP " + ip + " успешно разблокирован", type: 'success' });
      } else {
        setMessage({ text: res.error || "Ошибка", type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Ошибка", type: 'error' });
    }
  };

  const handleAddIndicator = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    try {
      const payload = {
        ip: newIndicatorIp,
        isPermanent: false,
        expiresAt: new Date(newIndicatorValidTo).getTime()
      };
      const res: any = await apiService.post('/api/fortigate/ban', { ...payload, workspaceId: activeWorkspaceId });
      if (res.success) {
        setBannedIps(prev => {
          const filtered = prev.filter(b => b.ip !== res.banRecord.ip);
          return [res.banRecord, ...filtered];
        });
        setIsAddModalOpen(false);
        setNewIndicatorIp('');
        setMessage({ text: "IP " + newIndicatorIp + " заблокирован", type: 'success' });
      } else {
        setMessage({ text: res.error || "Ошибка", type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Ошибка", type: 'error' });
    } finally {
      setIsAdding(false);
    }
  };

  if (loading) return <div>Загрузка...</div>;

  const totalPages = Math.ceil(bannedIps.length / itemsPerPage);
  const paginatedIps = bannedIps.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="admin-tab-content fade-in" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 className="admin-card-title" style={{ margin: 0 }}>Индикаторы компрометации (Заблокированные IP)</h3>
        <button 
          className="btn-primary" 
          style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus size={16} /> Добавить
        </button>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', marginBottom: '20px', borderRadius: '8px', background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: message.type === 'success' ? '#22c55e' : '#ef4444' }}>
          {message.text}
        </div>
      )}

      {bannedIps.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>Нет заблокированных IP.</p>
      ) : (
        <div className="table-responsive">
          <table className="admin-table" style={{ minWidth: '900px', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'hsl(var(--bg-secondary))' }}>
                <th>#</th>
                <th>Тип</th>
                <th>Значение</th>
                <th>Группа FortiGate</th>
                <th>Действует с</th>
                <th>Действует до</th>
                <th style={{ textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {paginatedIps.map((b: any, i: number) => (
                <tr key={b.ip}>
                  <td style={{ color: 'var(--text-secondary)' }}>{(currentPage - 1) * itemsPerPage + i + 1}</td>
                  <td>IP Адрес</td>
                  <td><span className="badge badge-error">{b.ip}</span></td>
                  <td>{b.fortigateGroup || b.group || 'По умолчанию'}</td>
                  <td>{new Date(b.validFrom || b.bannedAt).toLocaleString('ru-RU')}</td>
                  <td>{b.expiresAt ? new Date(b.expiresAt).toLocaleString('ru-RU') : 'Бессрочно'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      type="button"
                      title="Разблокировать"
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      onClick={() => handleUnban(b.ip)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '0 8px' }}>
              <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
                Показано {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, bannedIps.length)} из {bannedIps.length}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn-secondary" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{ padding: '4px 12px', fontSize: '0.9rem' }}
                >
                  Назад
                </button>
                <button 
                  className="btn-secondary" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  style={{ padding: '4px 12px', fontSize: '0.9rem' }}
                >
                  Вперед
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isAddModalOpen && (
        <div className="admin-modal-overlay" onClick={() => !isAdding && setIsAddModalOpen(false)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ width: '500px', padding: '24px' }}>
            <h3 style={{ marginBottom: '20px', color: 'hsl(var(--text-primary))' }}>Блокировка IP</h3>
            <form onSubmit={handleAddIndicator} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>IP Адрес</label>
                <input 
                  type="text" 
                  value={newIndicatorIp} 
                  onChange={e => setNewIndicatorIp(e.target.value)}
                  placeholder="192.168.1.100"
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid hsl(var(--border-color))', background: 'hsl(var(--bg-primary))', color: 'hsl(var(--text-primary))' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Действует с</label>
                  <input 
                    type="date" 
                    value={newIndicatorValidFrom} 
                    onChange={e => setNewIndicatorValidFrom(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid hsl(var(--border-color))', background: 'hsl(var(--bg-primary))', color: 'hsl(var(--text-primary))' }}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Действует до</label>
                  <input 
                    type="date" 
                    value={newIndicatorValidTo} 
                    onChange={e => setNewIndicatorValidTo(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid hsl(var(--border-color))', background: 'hsl(var(--bg-primary))', color: 'hsl(var(--text-primary))' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isAdding}
                >
                  Отмена
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isAdding || !newIndicatorIp}
                >
                  {isAdding ? 'Загрузка...' : 'Заблокировать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
