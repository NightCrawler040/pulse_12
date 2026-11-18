import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Mail,
  FileText,
  Bug,
  Users,
  Database,
  Flame,
  Cpu,
  Lock,
  BarChart3,
  Plus,
  Link2,
  Save,
  RotateCcw,
  Trash2,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Info,
  Edit3,
  X
} from 'lucide-react';

export interface ArchNode {
  id: string;
  title: string;
  subtitle: string;
  category: 'source' | 'scanner' | 'identity' | 'core' | 'storage' | 'enforcement' | 'reporting' | string;
  icon: string;
  color: string;
  ipOrHost: string;
  owner: string;
  x: number;
  y: number;
  description: string;
  controls: string[];
}

export interface ArchEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

interface ArchData {
  title: string;
  updatedAt?: string;
  nodes: ArchNode[];
  edges: ArchEdge[];
}

const NODE_WIDTH = 280;
const NODE_HEIGHT = 118;

const ICON_OPTIONS = [
  { id: 'shield', label: '🛡️ Щит ИБ / Ядро' },
  { id: 'flame', label: '🔥 Межсетевой экран (NGFW)' },
  { id: 'cpu', label: '🧬 EDR / Песочница (KATA)' },
  { id: 'bug', label: '🐞 Сканер уязвимостей (SAST/DAST)' },
  { id: 'lock', label: '🔐 Контроль доступов / DLP' },
  { id: 'mail', label: '📧 Почтовый шлюз / CERT' },
  { id: 'file', label: '📄 Документы / Приказы JML' },
  { id: 'users', label: '👥 Каталог Active Directory' },
  { id: 'database', label: '🗄️ СУБД / Бэкапы' },
  { id: 'chart', label: '📊 Аудит / Отчетность / SIEM' }
];

const CATEGORY_LABELS: Record<string, string> = {
  source: '📥 Входящий источник данных',
  scanner: '🔍 Сканер защищенности / Мониторинг',
  identity: '🔐 Управление идентификацией (IAM / AD)',
  core: '⚡ Ядро оркестрации (SOAR / SecOps)',
  storage: '🗄️ Хранилище и Резервное копирование',
  enforcement: '🛡️ Исполнительный узел защиты (Enforcement)',
  reporting: '📊 Отчетность и Аудит ИБ'
};

export const DkbArchitectureMap: React.FC = () => {
  const { isManagerOrAdmin } = useAuth();
  const [arch, setArch] = useState<ArchData>({
    title: 'Интерактивная карта архитектуры и потоков данных ДКБ',
    nodes: [],
    edges: []
  });
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-pulse-core');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dragging state
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Create/Edit Modal
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<ArchNode | null>(null);
  const [nodeForm, setNodeForm] = useState<ArchNode>({
    id: '',
    title: '',
    subtitle: '',
    category: 'enforcement',
    icon: 'shield',
    color: '#3b82f6',
    ipOrHost: '',
    owner: 'ДКБ',
    x: 420,
    y: 220,
    description: '',
    controls: []
  });
  const [controlsText, setControlsText] = useState('');

  // Edge Create Modal
  const [isEdgeModalOpen, setIsEdgeModalOpen] = useState(false);
  const [edgeFrom, setEdgeFrom] = useState('');
  const [edgeTo, setEdgeTo] = useState('');
  const [edgeLabel, setEdgeLabel] = useState('');

  const loadArchitecture = async () => {
    try {
      setLoading(true);
      const res: any = await apiService.get('/api/settings/architecture');
      if (res?.architecture) {
        setArch(res.architecture);
        if (res.architecture.nodes?.length > 0 && !selectedNodeId) {
          setSelectedNodeId(res.architecture.nodes[0].id);
        }
      }
      if (res?.stats) setStats(res.stats);
    } catch (e) {
      console.error('Failed to load architecture', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchitecture();
  }, []);

  const saveArchitecture = async (nextArch: ArchData, customMsg?: string) => {
    try {
      setSaving(true);
      const res: any = await apiService.post('/api/settings/architecture', { architecture: nextArch });
      if (res?.architecture) {
        setArch(res.architecture);
      }
      setStatusMsg(customMsg || '✅ Схема архитектуры ДКБ успешно сохранена!');
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (e: any) {
      alert('Ошибка сохранения схемы: ' + (e.message || 'Неизвестная ошибка'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = async () => {
    if (!window.confirm('Восстановить эталонную схему ДКБ по умолчанию?')) return;
    try {
      setSaving(true);
      const res: any = await apiService.post('/api/settings/architecture', { resetToDefault: true });
      if (res?.architecture) {
        setArch(res.architecture);
        setSelectedNodeId('node-pulse-core');
      }
      setStatusMsg('✅ Восстановлена эталонная схема ДКБ');
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (e: any) {
      alert(e.message || 'Ошибка сброса');
    } finally {
      setSaving(false);
    }
  };

  const renderNodeIcon = (iconName: string, color: string) => {
    const props = { size: 22, style: { color } };
    switch (iconName) {
      case 'mail': return <Mail {...props} />;
      case 'file': return <FileText {...props} />;
      case 'bug': return <Bug {...props} />;
      case 'users': return <Users {...props} />;
      case 'database': return <Database {...props} />;
      case 'flame': return <Flame {...props} />;
      case 'cpu': return <Cpu {...props} />;
      case 'lock': return <Lock {...props} />;
      case 'chart': return <BarChart3 {...props} />;
      default: return <Shield {...props} />;
    }
  };

  const getLiveMetricBadge = (nodeId: string) => {
    switch (nodeId) {
      case 'node-fortigate':
        return `🔒 Заблокировано IP: ${stats.bannedIpsCount || 0}`;
      case 'node-kata':
        return `🧬 Хэшей IoC в базе: ${stats.kataHashesCount || 0}`;
      case 'node-derscanner':
        return `🐞 Найдено уязвимостей: ${stats.findingsCount || 0}`;
      case 'node-hr-pdf':
      case 'node-jml-contour':
        return `📋 Приказов JML: ${stats.hrOrdersCount || 0}`;
      case 'node-ad':
        return `👥 Сотрудников в штате: ${stats.usersCount || 0}`;
      case 'node-pulse-core':
        return `🏢 Пространств: ${stats.workspacesCount || 1} • Задач: ${stats.tasksCount || 0}`;
      case 'node-postgres':
        return `💾 PostgreSQL 16 Online`;
      default:
        return null;
    }
  };

  // Dragging handlers
  const handleMouseDownNode = (e: React.MouseEvent, node: ArchNode) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    if (!isManagerOrAdmin) return;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggingNodeId(node.id);
    setDragOffset({
      x: e.clientX - rect.left + canvasRef.current.scrollLeft - node.x,
      y: e.clientY - rect.top + canvasRef.current.scrollTop - node.y
    });
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (!draggingNodeId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(16, Math.min(1450, e.clientX - rect.left + canvasRef.current.scrollLeft - dragOffset.x));
    const newY = Math.max(16, Math.min(920, e.clientY - rect.top + canvasRef.current.scrollTop - dragOffset.y));
    setArch(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === draggingNodeId ? { ...n, x: Math.round(newX), y: Math.round(newY) } : n)
    }));
  };

  const handleMouseUpCanvas = () => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
    }
  };

  // Add / Edit Node Modal handlers
  const openAddNodeModal = () => {
    setEditingNode(null);
    setNodeForm({
      id: `node-${Date.now()}`,
      title: '',
      subtitle: '',
      category: 'enforcement',
      icon: 'shield',
      color: '#3b82f6',
      ipOrHost: '',
      owner: 'Департамент Кибербезопасности',
      x: 480,
      y: 200,
      description: '',
      controls: []
    });
    setControlsText('Аутентификация по токену\nЖурналирование всех событий\nКонтроль целостности данных');
    setIsNodeModalOpen(true);
  };

  const openEditNodeModal = (node: ArchNode) => {
    setEditingNode(node);
    setNodeForm({ ...node });
    setControlsText((node.controls || []).join('\n'));
    setIsNodeModalOpen(true);
  };

  const handleSaveNodeForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeForm.title.trim()) return;
    const parsedControls = controlsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const updatedNode: ArchNode = {
      ...nodeForm,
      controls: parsedControls
    };

    const nextNodes = editingNode
      ? arch.nodes.map(n => n.id === editingNode.id ? updatedNode : n)
      : [...arch.nodes, updatedNode];

    const nextArch = { ...arch, nodes: nextNodes };
    setArch(nextArch);
    setSelectedNodeId(updatedNode.id);
    setIsNodeModalOpen(false);
    saveArchitecture(nextArch, editingNode ? '✅ Узел системы обновлен' : '✅ Новая система добавлена на схему ДКБ');
  };

  const handleDeleteNode = (nodeId: string) => {
    const target = arch.nodes.find(n => n.id === nodeId);
    if (!target) return;
    if (!window.confirm(`Удалить узел «${target.title}» и связанные с ним стрелки со схемы?`)) return;
    const nextArch: ArchData = {
      ...arch,
      nodes: arch.nodes.filter(n => n.id !== nodeId),
      edges: arch.edges.filter(e => e.from !== nodeId && e.to !== nodeId)
    };
    setArch(nextArch);
    setSelectedNodeId(nextArch.nodes[0]?.id || null);
    saveArchitecture(nextArch, '🗑️ Узел удален со схемы');
  };

  const openAddEdgeModal = () => {
    setEdgeFrom(selectedNodeId || arch.nodes[0]?.id || '');
    setEdgeTo(arch.nodes.find(n => n.id !== selectedNodeId)?.id || arch.nodes[0]?.id || '');
    setEdgeLabel('HTTPS / REST API');
    setIsEdgeModalOpen(true);
  };

  const handleSaveEdgeForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!edgeFrom || !edgeTo || edgeFrom === edgeTo) {
      alert('Выберите два разных узла для соединения');
      return;
    }
    const newEdge: ArchEdge = {
      id: `edge-${Date.now()}`,
      from: edgeFrom,
      to: edgeTo,
      label: edgeLabel.trim() || 'Поток данных'
    };
    const nextArch = {
      ...arch,
      edges: [...arch.edges, newEdge]
    };
    setArch(nextArch);
    setIsEdgeModalOpen(false);
    saveArchitecture(nextArch, '🔗 Добавлена новая связь между системами');
  };

  const handleDeleteEdge = (edgeId: string) => {
    const nextArch = {
      ...arch,
      edges: arch.edges.filter(e => e.id !== edgeId)
    };
    setArch(nextArch);
    saveArchitecture(nextArch, '🗑️ Связь удалена');
  };

  const selectedNode = arch.nodes.find(n => n.id === selectedNodeId) || null;

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>Загрузка интерактивной карты архитектуры ДКБ...</div>;
  }

  return (
    <div
      style={
        isFullscreen
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 9000,
              background: '#070b14',
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }
          : {
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }
      }
    >
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'hsl(var(--bg-secondary))',
          border: '1px solid hsl(var(--border-color))',
          borderRadius: '12px',
          padding: '16px 20px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem' }}>🗺️</span>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
              {arch.title || 'Интерактивная схема взаимодействия систем ДКБ'}
            </h1>
            <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.16)', color: '#10b981', padding: '3px 10px', borderRadius: '999px', fontWeight: 700, border: '1px solid rgba(16,185,129,0.35)' }}>
              LIVE AUDIT MODE
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'hsl(var(--text-secondary))' }}>
            Нажмите на любой узел системы для просмотра паспорта ИБ, протоколов взаимодействия и мер защиты. Перетаскивайте блоки мышью для настройки расположения.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isManagerOrAdmin && (
            <>
              <button
                className="btn-primary"
                onClick={openAddNodeModal}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.84rem' }}
              >
                <Plus size={15} /> Добавить систему
              </button>
              <button
                className="btn-secondary"
                onClick={openAddEdgeModal}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.84rem' }}
              >
                <Link2 size={15} /> Связать потоком
              </button>
              <button
                className="btn-secondary"
                onClick={() => saveArchitecture(arch, '✅ Расположение узлов сохранено!')}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.84rem', borderColor: 'rgba(16,185,129,0.4)', color: '#10b981' }}
              >
                <Save size={15} /> {saving ? 'Сохранение...' : 'Сохранить раскладку'}
              </button>
              <button
                className="btn-secondary"
                onClick={handleResetDefault}
                title="Сбросить к эталонной схеме ДКБ"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.84rem' }}
              >
                <RotateCcw size={15} /> Эталон
              </button>
            </>
          )}
          <button
            className="btn-secondary"
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.84rem' }}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {isFullscreen ? 'Выйти из полного экрана' : 'Режим презентации'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div style={{ padding: '10px 16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', fontWeight: 600, fontSize: '0.88rem' }}>
          {statusMsg}
        </div>
      )}

      {/* Main Split Layout: Interactive Canvas + Passport Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '1fr 380px' : '1fr', gap: '16px', alignItems: 'start' }}>
        {/* Interactive Canvas */}
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMoveCanvas}
          onMouseUp={handleMouseUpCanvas}
          onMouseLeave={handleMouseUpCanvas}
          style={{
            position: 'relative',
            width: '100%',
            height: isFullscreen ? 'calc(100vh - 140px)' : '790px',
            overflow: 'auto',
            background: 'radial-gradient(circle at 50% 50%, #0f172a 0%, #070b14 100%)',
            backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            border: '1px solid #1e293b',
            borderRadius: '14px',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6)',
            userSelect: 'none'
          }}
        >
          <div style={{ position: 'relative', width: '1320px', height: '820px' }}>
            {/* Column Headers on Canvas */}
            <div style={{ position: 'absolute', top: '18px', left: '60px', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              📥 1. Контур источников и детекции
            </div>
            <div style={{ position: 'absolute', top: '18px', left: '500px', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              ⚡ 2. Ядро оркестрации и хранения ДКБ
            </div>
            <div style={{ position: 'absolute', top: '18px', left: '950px', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              🛡️ 3. Контур блокировки и исполнения (SOAR / JML)
            </div>

            {/* SVG Edges Layer */}
            <svg
              width="1320"
              height="820"
              style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 }}
            >
              <defs>
                <marker id="arch-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                  <polygon points="0 0, 10 4, 0 8" fill="#6366f1" />
                </marker>
                <marker id="arch-arrow-active" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                  <polygon points="0 0, 10 4, 0 8" fill="#38bdf8" />
                </marker>
              </defs>

              {arch.edges.map(edge => {
                const fromNode = arch.nodes.find(n => n.id === edge.from);
                const toNode = arch.nodes.find(n => n.id === edge.to);
                if (!fromNode || !toNode) return null;

                const isHighlighted = selectedNodeId === fromNode.id || selectedNodeId === toNode.id;

                // Determine start and end coordinates smoothly
                let x1 = fromNode.x + NODE_WIDTH;
                let y1 = fromNode.y + NODE_HEIGHT / 2;
                let x2 = toNode.x;
                let y2 = toNode.y + NODE_HEIGHT / 2;

                // If nodes are stacked vertically in the same column
                if (Math.abs(fromNode.x - toNode.x) < 120) {
                  x1 = fromNode.x + NODE_WIDTH / 2;
                  x2 = toNode.x + NODE_WIDTH / 2;
                  if (fromNode.y < toNode.y) {
                    y1 = fromNode.y + NODE_HEIGHT;
                    y2 = toNode.y;
                  } else {
                    y1 = fromNode.y;
                    y2 = toNode.y + NODE_HEIGHT;
                  }
                } else if (fromNode.x > toNode.x) {
                  x1 = fromNode.x;
                  x2 = toNode.x + NODE_WIDTH;
                }

                const dx = Math.abs(x2 - x1) * 0.45;
                const pathD =
                  Math.abs(fromNode.x - toNode.x) < 120
                    ? `M ${x1} ${y1} L ${x2} ${y2}`
                    : `M ${x1} ${y1} C ${x1 + (x2 > x1 ? dx : -dx)} ${y1}, ${x2 - (x2 > x1 ? dx : -dx)} ${y2}, ${x2} ${y2}`;

                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                return (
                  <g key={edge.id}>
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isHighlighted ? '#38bdf8' : '#475569'}
                      strokeWidth={isHighlighted ? 2.6 : 1.8}
                      strokeDasharray={isHighlighted ? '6 4' : undefined}
                      markerEnd={isHighlighted ? 'url(#arch-arrow-active)' : 'url(#arch-arrow)'}
                    />
                    {edge.label && (
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x={-edge.label.length * 3.4 - 8}
                          y={-11}
                          width={edge.label.length * 6.8 + 16}
                          height={20}
                          rx={6}
                          fill="#0f172a"
                          stroke={isHighlighted ? '#38bdf8' : '#334155'}
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={3}
                          textAnchor="middle"
                          fill={isHighlighted ? '#e0f2fe' : '#94a3b8'}
                          fontSize="10.5"
                          fontWeight={600}
                        >
                          {edge.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Nodes Layer */}
            {arch.nodes.map(node => {
              const isSelected = selectedNodeId === node.id;
              const liveBadge = getLiveMetricBadge(node.id);
              return (
                <div
                  key={node.id}
                  onMouseDown={e => handleMouseDownNode(e, node)}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${NODE_WIDTH}px`,
                    minHeight: `${NODE_HEIGHT}px`,
                    background: isSelected
                      ? 'linear-gradient(145deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98))'
                      : 'rgba(15, 23, 42, 0.92)',
                    border: isSelected ? `2px solid ${node.color}` : '1px solid #334155',
                    borderLeft: `5px solid ${node.color}`,
                    borderRadius: '12px',
                    padding: '12px 14px',
                    cursor: isManagerOrAdmin ? 'grab' : 'pointer',
                    zIndex: isSelected ? 10 : 2,
                    boxShadow: isSelected
                      ? `0 0 24px ${node.color}40, 0 12px 24px rgba(0,0,0,0.5)`
                      : '0 8px 20px rgba(0,0,0,0.4)',
                    transition: draggingNodeId === node.id ? 'none' : 'box-shadow 0.2s, border-color 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: `${node.color}20`,
                        border: `1px solid ${node.color}50`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {renderNodeIcon(node.icon, node.color)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f8fafc', lineHeight: 1.25 }}>
                        {node.title}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {node.subtitle}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {node.ipOrHost || 'Корпоративный контур'}
                    </span>
                    {liveBadge && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '999px',
                          background: `${node.color}22`,
                          color: node.color,
                          flexShrink: 0
                        }}
                      >
                        {liveBadge}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side Inspector: Security Passport of Selected System */}
        {selectedNode && (
          <div
            style={{
              background: 'hsl(var(--bg-secondary))',
              border: '1px solid hsl(var(--border-color))',
              borderTop: `4px solid ${selectedNode.color}`,
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'sticky',
              top: '20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: `${selectedNode.color}20`,
                    border: `1px solid ${selectedNode.color}50`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {renderNodeIcon(selectedNode.icon, selectedNode.color)}
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: selectedNode.color, textTransform: 'uppercase' }}>
                    {CATEGORY_LABELS[selectedNode.category] || 'Узел архитектуры'}
                  </div>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', color: 'hsl(var(--text-primary))' }}>
                    {selectedNode.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-secondary))', cursor: 'pointer' }}
                title="Скрыть панель"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: 'hsl(var(--text-secondary))' }}>Сетевой контур / Протокол: </span>
                <strong style={{ fontFamily: 'monospace', color: 'hsl(var(--text-primary))' }}>{selectedNode.ipOrHost || 'Не указан'}</strong>
              </div>
              <div>
                <span style={{ color: 'hsl(var(--text-secondary))' }}>Ответственное подразделение: </span>
                <strong style={{ color: 'hsl(var(--text-primary))' }}>{selectedNode.owner || 'ДКБ'}</strong>
              </div>
              {getLiveMetricBadge(selectedNode.id) && (
                <div>
                  <span style={{ color: 'hsl(var(--text-secondary))' }}>Показатель в реальном времени: </span>
                  <strong style={{ color: selectedNode.color }}>{getLiveMetricBadge(selectedNode.id)}</strong>
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={14} /> Назначение и логика работы (Для аудита)
              </div>
              <p style={{ margin: 0, fontSize: '0.86rem', lineHeight: 1.55, color: 'hsl(var(--text-primary))' }}>
                {selectedNode.description || 'Описание не заполнено.'}
              </p>
            </div>

            {Array.isArray(selectedNode.controls) && selectedNode.controls.length > 0 && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} style={{ color: '#10b981' }} /> Реализованные контрольные меры ИБ
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedNode.controls.map((ctrl, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: '0.82rem',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        borderLeft: '3px solid #10b981',
                        color: 'hsl(var(--text-primary))'
                      }}
                    >
                      ✓ {ctrl}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connected data flows */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: '8px' }}>
                🔗 Связанные потоки данных
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {arch.edges
                  .filter(e => e.from === selectedNode.id || e.to === selectedNode.id)
                  .map(edge => {
                    const isOutgoing = edge.from === selectedNode.id;
                    const peer = arch.nodes.find(n => n.id === (isOutgoing ? edge.to : edge.from));
                    return (
                      <div
                        key={edge.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: 'rgba(255,255,255,0.04)',
                          fontSize: '0.78rem'
                        }}
                      >
                        <div>
                          <span style={{ color: isOutgoing ? '#38bdf8' : '#a855f7', fontWeight: 700 }}>
                            {isOutgoing ? '→ В ' : '← Из '}
                          </span>
                          <strong>{peer?.title || edge.to}</strong>
                          <div style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.74rem' }}>{edge.label}</div>
                        </div>
                        {isManagerOrAdmin && (
                          <button
                            onClick={() => handleDeleteEdge(edge.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                            title="Удалить связь"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {isManagerOrAdmin && (
              <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid hsl(var(--border-color))' }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.82rem' }}
                  onClick={() => openEditNodeModal(selectedNode)}
                >
                  <Edit3 size={14} /> Редактировать описание
                </button>
                <button
                  className="btn-danger"
                  style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  title="Удалить узел со схемы"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Node */}
      {isNodeModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNodeModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingNode ? '✏️ Редактировать узел системы ДКБ' : '➕ Добавить систему на карту ДКБ'}</h2>
              <button className="close-button" onClick={() => setIsNodeModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveNodeForm} className="modal-body form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Название системы / комплекса ИБ *</label>
                <input
                  required
                  type="text"
                  className="input-field"
                  value={nodeForm.title}
                  onChange={e => setNodeForm({ ...nodeForm, title: e.target.value })}
                  placeholder="Например: SIEM QRadar / Kaspersky KSC / PAM"
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Краткий подзаголовок (роль системы)</label>
                <input
                  type="text"
                  className="input-field"
                  value={nodeForm.subtitle}
                  onChange={e => setNodeForm({ ...nodeForm, subtitle: e.target.value })}
                  placeholder="Например: Корреляция событий ИБ и инцидентов"
                />
              </div>
              <div className="form-group">
                <label>Контур / Категория</label>
                <select
                  className="input-field"
                  value={nodeForm.category}
                  onChange={e => setNodeForm({ ...nodeForm, category: e.target.value })}
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Иконка и Цвет акцента</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="input-field"
                    style={{ flex: 1 }}
                    value={nodeForm.icon}
                    onChange={e => setNodeForm({ ...nodeForm, icon: e.target.value })}
                  >
                    {ICON_OPTIONS.map(ic => (
                      <option key={ic.id} value={ic.id}>{ic.label}</option>
                    ))}
                  </select>
                  <input
                    type="color"
                    value={nodeForm.color}
                    onChange={e => setNodeForm({ ...nodeForm, color: e.target.value })}
                    style={{ width: '44px', height: '38px', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>IP / Протокол / Интерфейс</label>
                <input
                  type="text"
                  className="input-field"
                  value={nodeForm.ipOrHost}
                  onChange={e => setNodeForm({ ...nodeForm, ipOrHost: e.target.value })}
                  placeholder="Например: Syslog 514 / REST API 443"
                />
              </div>
              <div className="form-group">
                <label>Ответственное подразделение</label>
                <input
                  type="text"
                  className="input-field"
                  value={nodeForm.owner}
                  onChange={e => setNodeForm({ ...nodeForm, owner: e.target.value })}
                  placeholder="Например: Отдел мониторинга ИБ (SOC)"
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Подробное описание логики работы (для демонстрации аудиторам)</label>
                <textarea
                  rows={3}
                  className="input-field"
                  value={nodeForm.description}
                  onChange={e => setNodeForm({ ...nodeForm, description: e.target.value })}
                  placeholder="Опишите, какие данные система получает, как обрабатывает и куда передает..."
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Контрольные меры безопасности (по одной на строку)</label>
                <textarea
                  rows={3}
                  className="input-field"
                  value={controlsText}
                  onChange={e => setControlsText(e.target.value)}
                  placeholder="Шифрование канала TLS 1.3&#10;Ролевая модель доступа&#10;Ежедневное резервное копирование"
                />
              </div>
              <div className="modal-actions" style={{ gridColumn: '1 / -1', marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsNodeModalOpen(false)}>Отмена</button>
                <button type="submit" className="btn-primary">Сохранить узел</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Edge */}
      {isEdgeModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEdgeModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔗 Связать системы потоком данных</h2>
              <button className="close-button" onClick={() => setIsEdgeModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveEdgeForm} className="modal-body form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Источник (Откуда идет поток)</label>
                <select className="input-field" value={edgeFrom} onChange={e => setEdgeFrom(e.target.value)}>
                  {arch.nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Получатель (Куда поступают данные)</label>
                <select className="input-field" value={edgeTo} onChange={e => setEdgeTo(e.target.value)}>
                  {arch.nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Подпись протокола / передаваемых данных *</label>
                <input
                  required
                  type="text"
                  className="input-field"
                  value={edgeLabel}
                  onChange={e => setEdgeLabel(e.target.value)}
                  placeholder="Например: HTTPS Webhook: Блокировка IP"
                />
              </div>
              <div className="modal-actions" style={{ gridColumn: '1 / -1', marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsEdgeModalOpen(false)}>Отмена</button>
                <button type="submit" className="btn-primary">Создать связь</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
