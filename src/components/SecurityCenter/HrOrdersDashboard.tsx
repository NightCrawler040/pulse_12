import React, { useState, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { apiService } from '../../services/api';
import { Download, Trash2, FileSpreadsheet, Archive, RotateCcw, HardDriveDownload, CheckCircle2, Search } from 'lucide-react';
import './SecurityCenter.css';

const STATUS_OPTIONS = ['Ожидает', 'В процессе', 'Установлен', 'Удален', 'Отключен', 'Не требуется', 'Ошибка'];

const isDoneStatus = (st?: string) => {
  const s = (st || '').toLowerCase();
  return s.includes('установлен') || s.includes('отключен') || s.includes('удален') || s.includes('не требуется');
};

export const HrOrdersDashboard: React.FC = () => {
  const { hrOrders, updateHrOrder, deleteHrOrder, activeWorkspaceId } = useTaskContext();
  const [subTab, setSubTab] = useState<'active' | 'archive'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const workspaceOrders = useMemo(() => {
    return (hrOrders || []).filter(o => !activeWorkspaceId || !o.workspaceId || o.workspaceId === activeWorkspaceId);
  }, [hrOrders, activeWorkspaceId]);

  const activeOrders = useMemo(() => workspaceOrders.filter(o => !o.isArchived), [workspaceOrders]);
  const archivedOrders = useMemo(() => workspaceOrders.filter(o => o.isArchived), [workspaceOrders]);

  const displayedOrders = useMemo(() => {
    const base = subTab === 'active' ? activeOrders : archivedOrders;
    return base.filter(o => {
      if (typeFilter !== 'all' && o.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (o.fullName || '').toLowerCase().includes(q);
        const matchPos = (o.newPosition || o.oldPosition || '').toLowerCase().includes(q);
        const matchPc = (o.pcName || '').toLowerCase().includes(q);
        if (!matchName && !matchPos && !matchPc) return false;
      }
      return true;
    });
  }, [subTab, activeOrders, archivedOrders, typeFilter, searchQuery]);

  const handleFieldChange = (orderId: string, field: string, value: string) => {
    updateHrOrder(orderId, { [field]: value } as any);
  };

  const handleMarkAllDone = (order: any) => {
    const targetStatus = order.type === 'Расторжение' ? 'Удален' : 'Установлен';
    updateHrOrder(order.id, {
      ad: targetStatus,
      kaspersky: targetStatus,
      dlp: targetStatus,
      staffcop: targetStatus,
      cisco: targetStatus
    });
  };

  const handleToggleArchive = (order: any) => {
    const nextArchived = !order.isArchived;
    updateHrOrder(order.id, {
      isArchived: nextArchived,
      archivedAt: nextArchived ? new Date().toISOString() : undefined
    });
  };

  const exportToCsv = () => {
    const headers = ['ФИО', 'Тип приказа', 'Дата', 'Старая должность', 'Новая должность', 'Имя ПК', 'Active Directory', 'Kaspersky', 'DLP DG', 'Staffcop', 'Cisco Duo', 'Статус архива'];
    const rows = displayedOrders.map(o => [
      o.fullName,
      o.type,
      o.date,
      o.oldPosition || '',
      o.newPosition || '',
      o.pcName || '',
      o.ad || 'Ожидает',
      o.kaspersky || 'Ожидает',
      o.dlp || 'Ожидает',
      o.staffcop || 'Ожидает',
      o.cisco || 'Ожидает',
      o.isArchived ? 'В архиве' : 'В работе'
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hr_jml_orders_${subTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateServerBackupAndDownload = async () => {
    try {
      const res: any = await apiService.post('/api/settings/backups/create', { type: 'hr_jml' });
      const payload = {
        backupType: 'hr_jml_registry',
        exportedAt: new Date().toISOString(),
        serverSnapshot: res?.filename || null,
        totalOrders: workspaceOrders.length,
        activeCount: activeOrders.length,
        archivedCount: archivedOrders.length,
        hr_orders: workspaceOrders
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hr_jml_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setBackupMessage(`✅ Снапшот JML сохранён на сервере (${res?.filename || 'OK'}) и выгружен на ПК!`);
      setTimeout(() => setBackupMessage(null), 5000);
    } catch (e: any) {
      alert('Ошибка создания бэкапа: ' + (e.message || 'Неизвестная ошибка'));
    }
  };

  const getStatusSelectStyle = (status?: string): React.CSSProperties => {
    const s = (status || 'Ожидает').toLowerCase();
    if (s.includes('установлен') || s.includes('отключен') || s.includes('удален') || s.includes('не требуется')) {
      return { background: 'rgba(16, 185, 129, 0.16)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)', fontWeight: 600 };
    }
    if (s.includes('ошибка')) {
      return { background: 'rgba(239, 68, 68, 0.16)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', fontWeight: 600 };
    }
    if (s.includes('в процессе')) {
      return { background: 'rgba(245, 158, 11, 0.16)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)', fontWeight: 600 };
    }
    return { background: 'rgba(100, 116, 139, 0.15)', color: 'hsl(var(--text-secondary))', borderColor: 'rgba(100, 116, 139, 0.3)' };
  };

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Top Header & Subtabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>📋 Единый реестр HR Приказов (JML Контур ИБ)</h2>
          <div style={{ display: 'flex', background: 'hsl(var(--bg-secondary))', border: '1px solid hsl(var(--border-color))', borderRadius: '8px', overflow: 'hidden' }}>
            <button
              onClick={() => setSubTab('active')}
              style={{
                padding: '6px 14px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.84rem',
                background: subTab === 'active' ? '#f59e0b' : 'transparent',
                color: subTab === 'active' ? '#fff' : 'hsl(var(--text-secondary))'
              }}
            >
              🔥 В работе ({activeOrders.length})
            </button>
            <button
              onClick={() => setSubTab('archive')}
              style={{
                padding: '6px 14px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.84rem',
                background: subTab === 'archive' ? '#64748b' : 'transparent',
                color: subTab === 'archive' ? '#fff' : 'hsl(var(--text-secondary))',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Archive size={14} /> Архив JML ({archivedOrders.length})
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}
            onClick={handleCreateServerBackupAndDownload}
            title="Создать резервную копию всех HR приказов на сервере и скачать JSON-архив"
          >
            <HardDriveDownload size={16} /> Создать Бэкап JML (JSON)
          </button>
          <button
            className="btn-secondary"
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={exportToCsv}
          >
            <FileSpreadsheet size={16} /> Выгрузить в CSV / Excel
          </button>
        </div>
      </div>

      {backupMessage && (
        <div style={{ padding: '10px 16px', marginBottom: '14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', fontWeight: 600, fontSize: '0.88rem' }}>
          {backupMessage}
        </div>
      )}

      {/* Search & Filter Row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Поиск по ФИО сотрудника, должности или имени ПК..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px', minHeight: '36px' }}
          />
        </div>
        <select
          className="input-field"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{ maxWidth: '200px', minHeight: '36px' }}
        >
          <option value="all">Все типы приказов</option>
          <option value="Прием">🟢 Прием</option>
          <option value="Перевод">🔵 Перевод</option>
          <option value="Декрет">🟡 Декрет / Отпуск</option>
          <option value="Расторжение">🔴 Расторжение (Увольнение)</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', background: 'hsl(var(--bg-card))', borderRadius: '12px', border: '1px solid hsl(var(--border-color))' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid hsl(var(--border-color))', textAlign: 'left', background: 'rgba(0,0,0,0.2)' }}>
              <th style={{ padding: '12px 14px' }}>ФИО Сотрудника</th>
              <th style={{ padding: '12px 12px' }}>Приказ / Дата</th>
              <th style={{ padding: '12px 12px' }}>Должность</th>
              <th style={{ padding: '12px 10px' }}>Имя ПК</th>
              <th style={{ padding: '12px 10px' }}>Active Directory</th>
              <th style={{ padding: '12px 10px' }}>Kaspersky</th>
              <th style={{ padding: '12px 10px' }}>DLP DG</th>
              <th style={{ padding: '12px 10px' }}>Staffcop</th>
              <th style={{ padding: '12px 10px' }}>Cisco Duo</th>
              <th style={{ padding: '12px 10px' }}>PDF</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {displayedOrders.map(order => {
              const allSystemsDone =
                isDoneStatus(order.ad) &&
                isDoneStatus(order.kaspersky) &&
                isDoneStatus(order.dlp) &&
                isDoneStatus(order.staffcop) &&
                isDoneStatus(order.cisco);

              return (
                <tr key={order.id} style={{ borderBottom: '1px solid hsl(var(--border-color))', background: allSystemsDone ? 'rgba(16, 185, 129, 0.04)' : undefined }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                    <div>{order.fullName}</div>
                    {allSystemsDone && (
                      <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>✓ Все 5 систем отработаны</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <span className="sc-badge badge-neutral" style={{ marginBottom: '4px', display: 'inline-block' }}>{order.type}</span>
                    <br />
                    <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-secondary))' }}>{order.date}</span>
                  </td>
                  <td style={{ padding: '12px 12px', fontSize: '0.8rem', maxWidth: '220px' }}>
                    {order.oldPosition && <div style={{ color: '#ef4444' }}>− {order.oldPosition}</div>}
                    {order.newPosition && <div style={{ color: '#10b981' }}>+ {order.newPosition}</div>}
                    {order.period && <div style={{ color: '#f59e0b' }}>⏳ {order.period}</div>}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="ПК-..."
                      defaultValue={order.pcName || ''}
                      onBlur={e => {
                        if (e.target.value !== (order.pcName || '')) {
                          handleFieldChange(order.id, 'pcName', e.target.value);
                        }
                      }}
                      style={{ padding: '4px 8px', minHeight: '30px', width: '110px', fontSize: '0.82rem' }}
                    />
                  </td>

                  {(['ad', 'kaspersky', 'dlp', 'staffcop', 'cisco'] as const).map(sysKey => {
                    const currentVal = (order as any)[sysKey] || 'Ожидает';
                    return (
                      <td key={sysKey} style={{ padding: '8px 8px' }}>
                        <select
                          className="input-field"
                          value={currentVal}
                          onChange={e => handleFieldChange(order.id, sysKey, e.target.value)}
                          style={{
                            padding: '4px 8px',
                            minHeight: '30px',
                            fontSize: '0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            ...getStatusSelectStyle(currentVal)
                          }}
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt} value={opt} style={{ background: '#0f172a', color: '#e2e8f0' }}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}

                  <td style={{ padding: '12px 10px' }}>
                    {order.pdfUrl ? (
                      <a href={order.pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}>
                        <Download size={15} /> PDF
                      </a>
                    ) : (
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {!allSystemsDone && !order.isArchived && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px 8px', minHeight: 'auto', fontSize: '0.76rem', color: '#10b981', borderColor: 'rgba(16,185,129,0.35)' }}
                          onClick={() => handleMarkAllDone(order)}
                          title="Отметить все 5 систем выполненными"
                        >
                          <CheckCircle2 size={14} /> Все ОК
                        </button>
                      )}
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 8px', minHeight: 'auto', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleToggleArchive(order)}
                        title={order.isArchived ? 'Вернуть из архива в работу' : 'Перенести отработанный приказ в Архив JML'}
                      >
                        {order.isArchived ? <RotateCcw size={13} /> : <Archive size={13} />}
                        {order.isArchived ? 'Вернуть' : 'В архив'}
                      </button>
                      <button
                        className="btn-danger"
                        style={{ padding: '4px 8px', minHeight: 'auto', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => { if (window.confirm(`Удалить приказ по сотруднику "${order.fullName}"?`)) deleteHrOrder(order.id); }}
                        title="Удалить приказ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {displayedOrders.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-secondary))' }}>
                  {subTab === 'active'
                    ? 'Нет активных приказов JML по выбранным фильтрам'
                    : 'В архиве пока нет отработанных приказов JML'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
