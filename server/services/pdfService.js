import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateSprintPdf = ({ dbData, sprintId, stream }) => {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 50, left: 40, right: 40 },
    bufferPages: true
  });

  doc.pipe(stream);

  // 1. Регистрация шрифтов с поддержкой кириллицы
  const fontRegular = path.join(__dirname, '../fonts/arial.ttf');
  const fontBold = path.join(__dirname, '../fonts/arialbd.ttf');

  const regFont = fs.existsSync(fontRegular) ? fontRegular : 'Helvetica';
  const boldFont = fs.existsSync(fontBold) ? fontBold : 'Helvetica-Bold';

  doc.registerFont('CyrillicRegular', regFont);
  doc.registerFont('CyrillicBold', boldFont);

  // Фильтруем данные спринта
  const isAll = sprintId === 'all' || !sprintId;
  const currentSprint = isAll ? null : (dbData.sprints || []).find(s => s.id === sprintId);
  const sprintTitle = currentSprint ? currentSprint.name : 'Сводный отчёт по всем спринтам';
  
  const tasks = isAll 
    ? (dbData.tasks || []) 
    : (dbData.tasks || []).filter(t => t.sprintId === sprintId);

  const users = (dbData.users || []).filter(u => u.id !== 'usr-1' && u.login?.toLowerCase() !== 'admin');

  // Расчёт метрик
  const totalTasks = tasks.length || 0;
  const doneTasks = tasks.filter(t => t.status === 'done');
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
  const reviewTasks = tasks.filter(t => t.status === 'review');
  const todoTasks = tasks.filter(t => t.status === 'todo');

  const completionRate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;
  const totalSP = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const doneSP = doneTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  const totalLogged = tasks.reduce((sum, t) => sum + (t.loggedHours || 0), 0);

  // --- ШАПКА ОТЧЁТА ---
  doc.rect(40, 40, doc.page.width - 80, 70).fill('#1e293b');
  
  doc.font('CyrillicBold').fontSize(16).fillColor('#ffffff')
     .text('PULSE 12 CORPORATE TASK TRACKER', 55, 53);
  
  doc.font('CyrillicRegular').fontSize(11).fillColor('#94a3b8')
     .text(`Аналитический отчёт: ${sprintTitle}`, 55, 75);

  const dateStr = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  doc.fontSize(9).fillColor('#cbd5e1')
     .text(`Сформировано: ${dateStr}`, 40, 75, { align: 'right', width: doc.page.width - 95 });

  doc.y = 130;

  // --- СВОДНЫЕ ПОКАЗАТЕЛИ (KPI CARDS) ---
  doc.font('CyrillicBold').fontSize(13).fillColor('#0f172a').text('Ключевые показатели эффективности (KPI)', 40, doc.y);
  doc.y += 15;

  const cards = [
    { title: 'Выполнено задач', value: `${doneTasks.length} из ${totalTasks}`, sub: `${completionRate}% успешно`, color: '#10b981' },
    { title: 'Story Points', value: `${doneSP} / ${totalSP} SP`, sub: 'Освоенный объём', color: '#3b82f6' },
    { title: 'Трудозатраты', value: `${totalLogged} / ${totalEstimated} ч`, sub: 'Списанные часы', color: '#8b5cf6' },
    { title: 'В работе / Проверке', value: `${inProgressTasks.length + reviewTasks.length} задач`, sub: `Ожидают: ${todoTasks.length}`, color: '#f59e0b' }
  ];

  const cardWidth = (doc.page.width - 80 - 30) / 4;
  let startX = 40;
  const startY = doc.y;

  cards.forEach((card, idx) => {
    const x = startX + idx * (cardWidth + 10);
    doc.rect(x, startY, cardWidth, 65).fill('#f8fafc');
    doc.rect(x, startY, 4, 65).fill(card.color);

    doc.font('CyrillicRegular').fontSize(9).fillColor('#64748b').text(card.title, x + 10, startY + 10, { width: cardWidth - 15 });
    doc.font('CyrillicBold').fontSize(13).fillColor('#0f172a').text(card.value, x + 10, startY + 26, { width: cardWidth - 15 });
    doc.font('CyrillicRegular').fontSize(8).fillColor(card.color).text(card.sub, x + 10, startY + 46, { width: cardWidth - 15 });
  });

  doc.y = startY + 85;

  // --- ТАБЛИЦА ЗАГРУЗКИ СОТРУДНИКОВ ---
  doc.font('CyrillicBold').fontSize(13).fillColor('#0f172a').text('Рейтинг и загрузка сотрудников компании', 40, doc.y);
  doc.y += 12;

  const empHeaders = ['Сотрудник / Логин', 'Отдел', 'Выполнено', 'В процессе', 'Story Points', 'Часы'];
  const empColWidths = [150, 100, 65, 65, 70, 65];

  const drawRow = (row, y, isHeader = false) => {
    let currX = 40;
    doc.rect(40, y, doc.page.width - 80, 22).fill(isHeader ? '#f1f5f9' : '#ffffff');
    if (!isHeader) {
      doc.moveTo(40, y + 22).lineTo(doc.page.width - 40, y + 22).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    }
    
    row.forEach((cell, i) => {
      const cleanStr = String(cell || '').replace(/[\u1000-\uFFFF]/g, '').trim();
      doc.font(isHeader ? 'CyrillicBold' : 'CyrillicRegular')
         .fontSize(isHeader ? 9 : 8.5)
         .fillColor(isHeader ? '#334155' : '#1e293b')
         .text(cleanStr, currX + 5, y + 6, { width: empColWidths[i] - 10, ellipsis: true });
      currX += empColWidths[i];
    });
  };

  drawRow(empHeaders, doc.y, true);
  doc.y += 22;

  users.forEach(u => {
    if (doc.y > doc.page.height - 70) {
      doc.addPage();
      doc.y = 40;
      drawRow(empHeaders, doc.y, true);
      doc.y += 22;
    }

    const uTasks = tasks.filter(t => {
      const assignId = String(t.assigneeId || t.assignee || '');
      const matchesUser = assignId === u.id || (u.login && assignId.toLowerCase() === u.login.toLowerCase());
      const matchesGroup = t.assigneeGroupId && (dbData.groups || []).some(g => g.id === t.assigneeGroupId && g.memberIds?.includes(u.id));
      return matchesUser || matchesGroup || (Array.isArray(t.assigneeIds) && t.assigneeIds.includes(u.id));
    });
    const uDone = uTasks.filter(t => t.status === 'done').length;
    const uInProg = uTasks.filter(t => t.status === 'in-progress' || t.status === 'review').length;
    const uSP = uTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const uHours = uTasks.reduce((sum, t) => sum + (t.loggedHours || 0), 0);

    const rowData = [
      u.name || u.login || 'Сотрудник',
      u.department || 'IT / Разработка',
      String(uDone),
      String(uInProg),
      `${uSP} SP`,
      `${uHours} ч`
    ];
    drawRow(rowData, doc.y, false);
    doc.y += 22;
  });

  doc.y += 20;

  // --- РЕЕСТР КЛЮЧЕВЫХ ЗАДАЧ ---
  if (doc.y > doc.page.height - 100) {
    doc.addPage();
    doc.y = 40;
  }

  doc.font('CyrillicBold').fontSize(13).fillColor('#0f172a').text('Реестр задач спринта', 40, doc.y);
  doc.y += 12;

  const taskHeaders = ['Название задачи', 'Статус', 'Приоритет', 'Исполнитель', 'Оценка'];
  const taskColWidths = [200, 80, 75, 100, 60];

  const drawTaskRow = (row, y, isHeader = false) => {
    let currX = 40;
    doc.rect(40, y, doc.page.width - 80, 22).fill(isHeader ? '#f1f5f9' : '#ffffff');
    if (!isHeader) {
      doc.moveTo(40, y + 22).lineTo(doc.page.width - 40, y + 22).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    }
    row.forEach((cell, i) => {
      const cleanStr = String(cell || '').replace(/[\u1000-\uFFFF]/g, '').trim();
      doc.font(isHeader ? 'CyrillicBold' : 'CyrillicRegular')
         .fontSize(isHeader ? 9 : 8.5)
         .fillColor(isHeader ? '#334155' : '#1e293b')
         .text(cleanStr, currX + 5, y + 6, { width: taskColWidths[i] - 10, ellipsis: true });
      currX += taskColWidths[i];
    });
  };

  drawTaskRow(taskHeaders, doc.y, true);
  doc.y += 22;

  const statusMap = {
    'todo': 'К выполнению',
    'in-progress': 'В работе',
    'review': 'На проверке',
    'done': 'Выполнено'
  };

  const priorityMap = {
    'urgent': 'Срочный (!)',
    'high': 'Высокий',
    'medium': 'Средний',
    'low': 'Низкий'
  };

  tasks.slice(0, 100).forEach(t => {
    if (doc.y > doc.page.height - 70) {
      doc.addPage();
      doc.y = 40;
      drawTaskRow(taskHeaders, doc.y, true);
      doc.y += 22;
    }

    const assigneeObj = (dbData.users || []).find(u => u.id === (t.assigneeId || t.assignee));
    const assigneeName = assigneeObj ? (assigneeObj.name || assigneeObj.login) : 'Не назначен';

    const rowData = [
      t.title || 'Без названия',
      statusMap[t.status] || t.status || 'todo',
      priorityMap[t.priority] || t.priority || 'medium',
      assigneeName,
      `${t.storyPoints || 0} SP`
    ];
    drawTaskRow(rowData, doc.y, false);
    doc.y += 22;
  });

  // --- НУМЕРАЦИЯ СТРАНИЦ ---
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font('CyrillicRegular').fontSize(8).fillColor('#64748b');
    doc.text(
      `Страница ${i + 1} из ${range.count} • Сгенерировано автоматически в корпоративной системе Pulse 12`,
      40,
      doc.page.height - 35,
      { align: 'center', width: doc.page.width - 80 }
    );
  }

  doc.end();
};
