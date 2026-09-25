import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { Download, Save, Trash2, FileSpreadsheet } from 'lucide-react';
import './SecurityCenter.css'; // Reuse styles

export const HrOrdersDashboard: React.FC = () => {
  const { hrOrders, updateHrOrder, deleteHrOrder } = useTaskContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const handleEdit = (order: any) => {
    setEditingId(order.id);
    setEditForm({ ...order });
  };

  const handleSave = () => {
    if (editingId) {
      updateHrOrder(editingId, editForm);
      setEditingId(null);
    }
  };

  const exportToCsv = () => {
    const headers = ['ФИО', 'Тип', 'Дата', 'Старая должность', 'Новая должность', 'ПК', 'Kaspersky', 'DLP', 'Staffcop', 'Cisco Duo'];
    const rows = hrOrders.map(o => [
      o.fullName, o.type, o.date, o.oldPosition || '', o.newPosition || '', o.pcName || '', o.kaspersky || '', o.dlp || '', o.staffcop || '', o.cisco || ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hr_orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('установлен') || s.includes('отключен') || s.includes('удален')) return 'badge-success';
    if (s.includes('ошибка')) return 'badge-danger';
    if (s.includes('в процессе')) return 'badge-warning';
    return 'badge-neutral';
  };

  const statusOptions = ['Ожидает', 'В процессе', 'Установлен', 'Удален', 'Отключен', 'Ошибка'];

  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Управление HR Приказами (JML)</h2>
          <button className="btn-secondary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={exportToCsv}>
            <FileSpreadsheet size={16} /> Выгрузить в CSV
          </button>
        <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
          Всего приказов: {hrOrders.length}
        </span>
      </div>

      <div style={{ overflowX: 'auto', background: 'hsl(var(--bg-card))', borderRadius: '12px', border: '1px solid hsl(var(--border-color))' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid hsl(var(--border-color))', textAlign: 'left', background: 'rgba(0,0,0,0.2)' }}>
              <th style={{ padding: '12px 16px' }}>ФИО</th>
              <th style={{ padding: '12px 16px' }}>Приказ / Дата</th>
              <th style={{ padding: '12px 16px' }}>Должность (старая/новая)</th>
              <th style={{ padding: '12px 16px' }}>Имя ПК</th>
              <th style={{ padding: '12px 16px' }}>Kaspersky</th>
              <th style={{ padding: '12px 16px' }}>DLP DG</th>
              <th style={{ padding: '12px 16px' }}>Staffcop</th>
              <th style={{ padding: '12px 16px' }}>Cisco Duo</th>
              <th style={{ padding: '12px 16px' }}>Документ</th>
              <th style={{ padding: '12px 16px' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {hrOrders.map(order => (
              <tr key={order.id} style={{ borderBottom: '1px solid hsl(var(--border-color))' }}>
                <td style={{ padding: '12px 16px', fontWeight: '500' }}>{order.fullName}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="sc-badge badge-neutral" style={{ marginBottom: '4px', display: 'inline-block' }}>{order.type}</span>
                  <br />
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>{order.date}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '0.8rem' }}>
                  {order.oldPosition && <div style={{ color: '#ef4444' }}>- {order.oldPosition}</div>}
                  {order.newPosition && <div style={{ color: '#10b981' }}>+ {order.newPosition}</div>}
                  {order.period && <div style={{ color: '#f59e0b' }}>⏳ {order.period}</div>}
                </td>
                
                {editingId === order.id ? (
                  <>
                    <td style={{ padding: '8px' }}><input type="text" className="input-field" value={editForm.pcName || ''} onChange={e => setEditForm({...editForm, pcName: e.target.value})} style={{ padding: '4px 8px', minHeight: 'auto' }} /></td>
                    <td style={{ padding: '8px' }}><select className="input-field" value={editForm.kaspersky} onChange={e => setEditForm({...editForm, kaspersky: e.target.value})} style={{ padding: '4px 8px', minHeight: 'auto' }}>{statusOptions.map(o => <option key={o}>{o}</option>)}</select></td>
                    <td style={{ padding: '8px' }}><select className="input-field" value={editForm.dlp} onChange={e => setEditForm({...editForm, dlp: e.target.value})} style={{ padding: '4px 8px', minHeight: 'auto' }}>{statusOptions.map(o => <option key={o}>{o}</option>)}</select></td>
                    <td style={{ padding: '8px' }}><select className="input-field" value={editForm.staffcop} onChange={e => setEditForm({...editForm, staffcop: e.target.value})} style={{ padding: '4px 8px', minHeight: 'auto' }}>{statusOptions.map(o => <option key={o}>{o}</option>)}</select></td>
                    <td style={{ padding: '8px' }}><select className="input-field" value={editForm.cisco} onChange={e => setEditForm({...editForm, cisco: e.target.value})} style={{ padding: '4px 8px', minHeight: 'auto' }}>{statusOptions.map(o => <option key={o}>{o}</option>)}</select></td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '12px 16px' }}>{order.pcName || '-'}</td>
                    <td style={{ padding: '12px 16px' }}><span className={`sc-badge ${getStatusBadge(order.kaspersky)}`}>{order.kaspersky}</span></td>
                    <td style={{ padding: '12px 16px' }}><span className={`sc-badge ${getStatusBadge(order.dlp)}`}>{order.dlp}</span></td>
                    <td style={{ padding: '12px 16px' }}><span className={`sc-badge ${getStatusBadge(order.staffcop)}`}>{order.staffcop}</span></td>
                    <td style={{ padding: '12px 16px' }}><span className={`sc-badge ${getStatusBadge(order.cisco)}`}>{order.cisco}</span></td>
                  </>
                )}

                <td style={{ padding: '12px 16px' }}>
                  {order.pdfUrl ? (
                    <a href={order.pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                      <Download size={16} /> PDF
                    </a>
                  ) : (
                    <span style={{ color: 'hsl(var(--text-secondary))' }}>-</span>
                  )}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {editingId === order.id ? (
                    <button className="btn-primary" style={{ padding: '4px 12px', minHeight: 'auto' }} onClick={handleSave}>
                      <Save size={14} /> Сохранить
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-secondary" style={{ padding: '4px 12px', minHeight: 'auto' }} onClick={() => handleEdit(order)}>
                      Изменить
                    </button>
                    <button className="btn-danger" style={{ padding: '4px 8px', minHeight: 'auto', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer' }} onClick={() => { if (window.confirm('Удалить приказ?')) deleteHrOrder(order.id) }} title="Удалить">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  )}
                </td>
              </tr>
            ))}
            {hrOrders.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-secondary))' }}>
                  Нет активных приказов JML
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
