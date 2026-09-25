import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Parses HR Order PDF buffer and extracts JML data
 * @param {Buffer} buffer - The PDF file buffer
 * @returns {Object|null} - The extracted order data or null if not an HR order
 */
export const parseHrOrderPDF = async (buffer) => {
  try {
    const data = await pdfParse(buffer);
    const text = data.text;
    
    // Check if it's an HR Order by looking for "ПРИКАЗЫВАЮ" and "Строго конфиденциально"
    if (!text.includes('ПРИКАЗЫВАЮ') || !text.includes('Строго конфиденциально')) {
      return null;
    }

    let result = {
      type: 'Unknown',
      fullName: '',
      date: '',
      oldPosition: '',
      newPosition: '',
      department: '',
      period: ''
    };

    // 1. Прием (Hiring)
    if (text.match(/О приеме на работу/i)) {
      result.type = 'Прием';
      const dateMatch = text.match(/Принять на работу\s+(\d{2}\.\d{2}\.\d{4})\s*г\.:/i);
      if (dateMatch) result.date = dateMatch[1];
      
      const nameMatch = text.match(/Принять на работу[\s\S]*?г\.:\s*([^\n]+)\s*на должность:/i);
      if (nameMatch) result.fullName = nameMatch[1].trim();

      const posMatch = text.match(/на должность:\s*([^\n]+)\s*и установить:/i);
      if (posMatch) result.newPosition = posMatch[1].trim();
      return result;
    }

    // 2. Расторжение (Termination)
    if (text.match(/О расторжении трудового договора/i)) {
      result.type = 'Расторжение';
      const dateMatch = text.match(/Расторгнуть\s+(\d{2}\.\d{2}\.\d{4})\s*года/i);
      if (dateMatch) result.date = dateMatch[1];

      const nameMatch = text.match(/с работником:\s*([^,\n]+)/i);
      if (nameMatch) result.fullName = nameMatch[1].trim();

      const posMatch = text.match(/наименование должности:\s*([^,\n]+)/i);
      if (posMatch) result.oldPosition = posMatch[1].trim();

      const depMatch = text.match(/структурное подразделение:\s*([^,\n]+)/i);
      if (depMatch) result.department = depMatch[1].trim();
      return result;
    }

    // 3. Отпуск по беременности (Maternity)
    if (text.match(/О предоставлении отпуска по беременности и родам/i)) {
      result.type = 'Декрет';
      
      const nameMatch = text.match(/Сотрудник:\s*([^\n]+)/i);
      if (nameMatch) result.fullName = nameMatch[1].trim();

      const posMatch = text.match(/Должность:\s*([^\n]+)/i);
      if (posMatch) result.oldPosition = posMatch[1].trim();

      const depMatch = text.match(/Структурное подразделение:\s*([^\n]+)/i);
      if (depMatch) result.department = depMatch[1].trim();

      const dateMatch = text.match(/с\s+(\d{2}\.\d{2}\.\d{4})\s*по\s+(\d{2}\.\d{2}\.\d{4})/i);
      if (dateMatch) {
        result.period = `с ${dateMatch[1]} по ${dateMatch[2]}`;
        result.date = dateMatch[1];
      }
      return result;
    }

    // 4. Перевод (Transfer)
    if (text.match(/О переводе работника/i) || text.match(/Перевести\s+\d{2}\.\d{2}\.\d{4}/i)) {
      result.type = 'Перевод';
      const dateMatch = text.match(/Перевести\s+(\d{2}\.\d{2}\.\d{4})\s*г\./i);
      if (dateMatch) result.date = dateMatch[1];

      const nameMatch = text.match(/работника:\s*([^,\n]+)/i);
      if (nameMatch) result.fullName = nameMatch[1].trim();

      const oldPosMatch = text.match(/должность\s*\(прежняя\):\s*([^,\n]+)/i);
      if (oldPosMatch) result.oldPosition = oldPosMatch[1].trim();

      const newPosMatch = text.match(/на должность\s*\(новая\):\s*([^,\n]+)/i);
      if (newPosMatch) result.newPosition = newPosMatch[1].trim();

      return result;
    }

    return null;
  } catch (error) {
    console.error('[HR Parser] Error parsing PDF:', error.message);
    return null;
  }
};
