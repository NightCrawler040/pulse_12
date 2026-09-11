const fs = require('fs');
let p = 'src/components/Sidebar/Sidebar.tsx';
let c = fs.readFileSync(p, 'utf8');

const switcherReplacement = `      <div className="sidebar-brand">
        <Activity size={24} className="logo-icon" />
        <span>Pulse</span>
      </div>

      {currentUser && workspaces.length > 0 && activeWorkspaceId && (
        <div style={{ padding: '0 12px 16px 12px', display: isCollapsed ? 'none' : 'block' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', marginBottom: '4px', paddingLeft: '4px', fontWeight: 600 }}>Пространство</div>
          <select 
            value={activeWorkspaceId}
            onChange={(e) => setActiveWorkspaceId(e.target.value)}
            style={{ 
              width: '100%', 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: 'hsl(var(--text-primary))', 
              padding: '6px 8px', 
              borderRadius: '4px',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          >
            {workspaces
              .filter(ws => isAdmin || (currentUser.workspaceIds && currentUser.workspaceIds.includes(ws.id)))
              .map(ws => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
        </div>
      )}`;

c = c.replace(/<div className="sidebar-brand">[\s\S]*?<span>Pulse<\/span>\s*<\/div>/, switcherReplacement);
fs.writeFileSync(p, c);
