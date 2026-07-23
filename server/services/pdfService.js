import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripHtml = (html) => {
  if (!html) return '';
  return String(html).replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
};

export const generateSprintPdf = ({ dbData, sprintId, targetUserId, stream }) => {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 50, left: 40, right: 40 },
    bufferPages: true
  });

  doc.pipe(stream);

  // Регистрация шрифтов с поддержкой кириллицы
  const fontRegular = path.join(__dirname, '../fonts/arial.ttf');
  const fontBold = path.join(__dirname, '../fonts/arialbd.ttf');

  const regFont = fs.existsSync(fontRegular) ? fontRegular : 'Helvetica';
  const boldFont = fs.existsSync(fontBold) ? fontBold : 'Helvetica-Bold';

  doc.registerFont('CyrillicRegular', regFont);
  doc.registerFont('CyrillicBold', boldFont);

  const isAll = sprintId === 'all' || !sprintId;
  const currentSprint = isAll ? null : (dbData.sprints || []).find(s => s.id === sprintId);
  const sprintTitle = currentSprint ? currentSprint.name : 'Сводный отчёт по всем спринтам';
  
  let allTasks = isAll 
    ? (dbData.tasks || []) 
    : (dbData.tasks || []).filter(t => t.sprintId === sprintId);

  let targetUsers = dbData.users || [];
  
  if (targetUserId) {
    targetUsers = targetUsers.filter(u => u.id === targetUserId);
    if (targetUsers.length === 0) {
      doc.font('CyrillicRegular').fontSize(12).text('Сотрудник не найден.');
      doc.end();
      return;
    }
  } else {
    targetUsers = targetUsers.filter(u => u.id !== 'usr-1' && u.login?.toLowerCase() !== 'admin');
  }

  // Вспомогательная функция для рисования заголовка страницы
  const drawPageHeader = (title, subtitle) => {
    doc.rect(40, 40, doc.page.width - 80, 70).fill('#1e293b');
    doc.font('CyrillicBold').fontSize(16).fillColor('#ffffff').text(title, 55, 53);
    doc.font('CyrillicRegular').fontSize(11).fillColor('#94a3b8').text(subtitle, 55, 75);

    const dateStr = new Date().toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    doc.fontSize(9).fillColor('#cbd5e1').text(`Сформировано: ${dateStr}`, 40, 75, { align: 'right', width: doc.page.width - 95 });
    doc.y = 130;
  };

  const getTasksForUser = (u) => {
    return allTasks.filter(t => {
      const assignId = String(t.assigneeId || t.assignee || '');
      const matchesUser = assignId === u.id || (u.login && assignId.toLowerCase() === u.login.toLowerCase());
      const matchesGroup = t.assigneeGroupId && (dbData.groups || []).some(g => g.id === t.assigneeGroupId && g.memberIds?.includes(u.id));
      return matchesUser || matchesGroup || (Array.isArray(t.assigneeIds) && t.assigneeIds.includes(u.id));
    });
  };

  const drawKpiCards = (tasks, startY) => {
    const totalTasks = tasks.length || 0;
    const doneTasks = tasks.filter(t => t.status === 'done');
    const inProg = tasks.filter(t => t.status === 'in-progress' || t.status === 'review');
    const todo = tasks.filter(t => t.status === 'todo');
    
    const completionRate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;
    const totalSP = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const doneSP = doneTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const totalLogged = tasks.reduce((sum, t) => sum + (t.loggedHours || 0), 0);

    const cards = [
      { title: 'Выполнено задач', value: `${doneTasks.length} из ${totalTasks}`, sub: `${completionRate}% успешно`, color: '#10b981' },
      { title: 'Story Points', value: `${doneSP} / ${totalSP} SP`, sub: 'Освоенный объём', color: '#3b82f6' },
      { title: 'Трудозатраты', value: `${totalLogged} / ${totalEstimated} ч`, sub: 'Списанные часы', color: '#8b5cf6' },
      { title: 'В работе / Проверке', value: `${inProg.length} задач`, sub: `Ожидают: ${todo.length}`, color: '#f59e0b' }
    ];

    const cardWidth = (doc.page.width - 80 - 30) / 4;
    let startX = 40;
    
    cards.forEach((card, idx) => {
      const x = startX + idx * (cardWidth + 10);
      doc.rect(x, startY, cardWidth, 65).fill('#f8fafc');
      doc.rect(x, startY, 4, 65).fill(card.color);

      doc.font('CyrillicRegular').fontSize(9).fillColor('#64748b').text(card.title, x + 10, startY + 10, { width: cardWidth - 15 });
      doc.font('CyrillicBold').fontSize(13).fillColor('#0f172a').text(card.value, x + 10, startY + 26, { width: cardWidth - 15 });
      doc.font('CyrillicRegular').fontSize(8).fillColor(card.color).text(card.sub, x + 10, startY + 46, { width: cardWidth - 15 });
    });
    return startY + 85;
  };

  const statusMap = { 'todo': 'К выполнению', 'in-progress': 'В работе', 'review': 'На проверке', 'done': 'Выполнено' };
  const priorityMap = { 'urgent': 'Срочный (!)', 'high': 'Высокий', 'medium': 'Средний', 'low': 'Низкий' };

  // ==========================================
  // 1. СВОДНЫЙ ОТЧЕТ (Только если нет targetUserId)
  // ==========================================
  if (!targetUserId) {
    drawPageHeader('PULSE 12 CORPORATE TASK TRACKER', `Сводный отчёт: ${sprintTitle}`);
    
    doc.font('CyrillicBold').fontSize(13).fillColor('#0f172a').text('Ключевые показатели эффективности (KPI)', 40, doc.y);
    doc.y = drawKpiCards(allTasks, doc.y + 15);

    doc.font('CyrillicBold').fontSize(13).fillColor('#0f172a').text('Рейтинг и загрузка сотрудников компании', 40, doc.y);
    doc.y += 12;

    const empHeaders = ['Сотрудник / Логин', 'Отдел', 'Выполнено', 'В процессе', 'SP', 'Часы'];
    const empColWidths = [160, 120, 60, 60, 50, 50];

    const drawEmpRow = (row, y, isHeader = false) => {
      let currX = 40;
      doc.rect(40, y, doc.page.width - 80, 24).fill(isHeader ? '#f1f5f9' : '#ffffff');
      if (!isHeader) doc.moveTo(40, y + 24).lineTo(doc.page.width - 40, y + 24).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      
      row.forEach((cell, i) => {
        const cleanStr = String(cell || '').replace(/[\u1000-\uFFFF]/g, '').trim();
        doc.font(isHeader ? 'CyrillicBold' : 'CyrillicRegular')
           .fontSize(isHeader ? 9 : 8)
           .fillColor(isHeader ? '#334155' : '#1e293b')
           .text(cleanStr, currX + 5, y + 7, { width: empColWidths[i] - 10, height: 12, ellipsis: true });
        currX += empColWidths[i];
      });
    };

    drawEmpRow(empHeaders, doc.y, true);
    doc.y += 24;

    targetUsers.forEach(u => {
      if (doc.y > doc.page.height - 70) {
        doc.addPage();
        doc.y = 40;
        drawEmpRow(empHeaders, doc.y, true);
        doc.y += 24;
      }

      const uTasks = getTasksForUser(u);
      const uDone = uTasks.filter(t => t.status === 'done').length;
      const uInProg = uTasks.filter(t => t.status === 'in-progress' || t.status === 'review').length;
      const uSP = uTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const uHours = uTasks.reduce((sum, t) => sum + (t.loggedHours || 0), 0);

      const rowData = [u.name || u.login || 'Сотрудник', u.department || 'IT / Разработка', String(uDone), String(uInProg), `${uSP}`, `${uHours}`];
      drawEmpRow(rowData, doc.y, false);
      doc.y += 24;
    });
  }

  // ==========================================
  // 2. ДЕТАЛЬНЫЕ СТРАНИЦЫ СОТРУДНИКОВ
  // ==========================================
  targetUsers.forEach((u, index) => {
    const userTasks = getTasksForUser(u);
    // Если формируем общий отчет и у сотрудника нет задач, пропускаем его, чтобы не плодить пустые страницы
    if (!targetUserId && userTasks.length === 0) return;

    if (!targetUserId || (targetUserId && index > 0)) {
      doc.addPage();
    }
    
    drawPageHeader('ПЕРСОНАЛЬНЫЙ ОТЧЕТ СОТРУДНИКА', `Сотрудник: ${u.name || u.login} | ${u.department || 'Отдел'} | ${sprintTitle}`);
    
    doc.font('CyrillicBold').fontSize(13).fillColor('#0f172a').text('Личные показатели (KPI)', 40, doc.y);
    doc.y = drawKpiCards(userTasks, doc.y + 15);

    doc.font('CyrillicBold').fontSize(13).fillColor('#0f172a').text('Детальный реестр задач', 40, doc.y);
    doc.y += 12;

    const taskHeaders = ['Название и Описание', 'Статус', 'Приоритет', 'Оценка'];
    const taskColWidths = [270, 90, 80, 60]; // Total 500

    const drawTaskHeader = (y) => {
      let currX = 40;
      doc.rect(40, y, doc.page.width - 80, 20).fill('#f1f5f9');
      taskHeaders.forEach((cell, i) => {
        doc.font('CyrillicBold').fontSize(9).fillColor('#334155').text(cell, currX + 5, y + 5, { width: taskColWidths[i] - 10 });
        currX += taskColWidths[i];
      });
      return y + 20;
    };

    doc.y = drawTaskHeader(doc.y);

    userTasks.forEach(t => {
      // Рассчитываем высоту строки на основе длины описания
      const title = String(t.title || 'Без названия').replace(/[\u1000-\uFFFF]/g, '');
      const desc = stripHtml(t.description || 'Описание отсутствует').replace(/[\u1000-\uFFFF]/g, '');
      
      const titleHeight = doc.font('CyrillicBold').fontSize(9).heightOfString(title, { width: taskColWidths[0] - 10 });
      const descHeight = doc.font('CyrillicRegular').fontSize(8).heightOfString(desc, { width: taskColWidths[0] - 10 });
      const rowHeight = Math.max(40, titleHeight + descHeight + 15);

      if (doc.y + rowHeight > doc.page.height - 70) {
        doc.addPage();
        doc.y = 40;
        doc.y = drawTaskHeader(doc.y);
      }

      const y = doc.y;
      doc.rect(40, y, doc.page.width - 80, rowHeight).fill('#ffffff');
      doc.moveTo(40, y + rowHeight).lineTo(doc.page.width - 40, y + rowHeight).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

      let currX = 40;
      
      // Колонка 1: Название и Описание
      doc.font('CyrillicBold').fontSize(9).fillColor('#1e293b').text(title, currX + 5, y + 5, { width: taskColWidths[0] - 10 });
      doc.font('CyrillicRegular').fontSize(8).fillColor('#64748b').text(desc, currX + 5, y + 5 + titleHeight + 2, { width: taskColWidths[0] - 10 });
      currX += taskColWidths[0];

      // Колонка 2: Статус
      const statusText = statusMap[t.status] || t.status || 'todo';
      const statusColor = t.status === 'done' ? '#10b981' : (t.status === 'in-progress' ? '#3b82f6' : '#f59e0b');
      doc.font('CyrillicBold').fontSize(8.5).fillColor(statusColor).text(statusText, currX + 5, y + 5, { width: taskColWidths[1] - 10 });
      currX += taskColWidths[1];

      // Колонка 3: Приоритет
      const prioText = priorityMap[t.priority] || t.priority || 'medium';
      const prioColor = t.priority === 'urgent' ? '#ef4444' : (t.priority === 'high' ? '#f97316' : '#64748b');
      doc.font('CyrillicBold').fontSize(8.5).fillColor(prioColor).text(prioText, currX + 5, y + 5, { width: taskColWidths[2] - 10 });
      currX += taskColWidths[2];

      // Колонка 4: Оценка
      doc.font('CyrillicRegular').fontSize(8.5).fillColor('#1e293b').text(`${t.storyPoints || 0} SP / ${t.loggedHours || 0}ч`, currX + 5, y + 5, { width: taskColWidths[3] - 10 });

      doc.y += rowHeight;
    });

    if (userTasks.length === 0 && targetUserId) {
      doc.font('CyrillicRegular').fontSize(10).fillColor('#94a3b8').text('Нет задач в данном спринте.', 45, doc.y + 10);
      doc.y += 30;
    }
  });

  // ==========================================
  // 3. НУМЕРАЦИЯ СТРАНИЦ
  // ==========================================
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
