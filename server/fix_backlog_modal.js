import fs from 'fs';

let code = fs.readFileSync('src/components/Backlog/Backlog.tsx', 'utf8');

code = code.replace(
  '<div className="modal-overlay" onClick={() => setIsSprintModalOpen(false)}>',
  `<div className="modal-overlay" onClick={() => setIsSprintModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>`
);

fs.writeFileSync('src/components/Backlog/Backlog.tsx', code);
console.log('Fixed Backlog Modal Overlay');
