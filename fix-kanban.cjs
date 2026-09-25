const fs = require('fs');
let code = fs.readFileSync('src/components/KanbanBoard/KanbanBoard.tsx', 'utf8');

code = code.replace(/\{isAdmin\s*&&\s*\([\s]*<button[\s]*className="btn-secondary"[\s]*onClick=\{\(\)\s*=>\s*setFilters\(prev\s*=>\s*\(\{\s*\.\.\.prev,\s*myTasksOnly:\s*!prev\.myTasksOnly\s*\}\)\)\}/g,
`{isManagerOrAdmin && (
              <button
                className="btn-secondary"
                onClick={() => setFilters(prev => ({ ...prev, myTasksOnly: !prev.myTasksOnly }))}`);

fs.writeFileSync('src/components/KanbanBoard/KanbanBoard.tsx', code);
