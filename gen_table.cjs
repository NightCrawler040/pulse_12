const fs = require('fs');

let c = fs.readFileSync('temp_full.tsx', 'utf8');

// The file has Cyrillic. We need to preserve it.

let imports = \`import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { Plus, Trash2 } from 'lucide-react';\`;

// Extract state
const stateStart = c.indexOf('const [bannedIps, setBannedIps] = useState<any[]>([]);');
const stateEnd = c.indexOf('const fetchSettings = async () => {');
let state = c.substring(stateStart, stateEnd);
// fix newIndicatorGroup to default to 'Не задано' etc. Actually, I don't need to change it, just extract.

// Extract fetch logic. I'll write it manually but avoiding Cyrillic or using unicode escapes if needed.
// Actually, Node string literals with utf8 from readFileSync are fully safe. I can just build a new string and write it!

let newCode = \`\${imports}

export const FortigateTable: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
\${state}
  const fetchBannedIps = async () => {
    try {
      const bannedRes: any = await apiService.get('/api/fortigate/banned-ips');
      if (bannedRes.success) {
        setBannedIps(bannedRes.bannedIps);
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
\`;

// Extract handleUnban and handleAddIndicator
const unbanStart = c.indexOf('const handleUnban = async (ip: string) => {');
const addStart = c.indexOf('const handleAddIndicator = async (e: React.FormEvent) => {');
const addEnd = c.indexOf('if (loading) return <div>');

let handlers = c.substring(unbanStart, addEnd);

newCode += handlers;

newCode += \`
  if (loading) return <div style={{padding: '20px'}}>Загрузка...</div>;
  const totalPages = Math.ceil(bannedIps.length / itemsPerPage);
  const paginatedIps = bannedIps.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="admin-tab-content fade-in">
\`;

const tableStart = c.indexOf('<div style={{ display: \'flex\', justifyContent: \'space-between\', alignItems: \'center\', marginBottom: \'20px\' }}>');
const tableEnd = c.lastIndexOf('</div>'); 
// Actually it's easier to just take from `<div style={{ display: 'flex'` down to the end of the return statement.
let renderPart = c.substring(tableStart, c.lastIndexOf('</div>\n    </div>\n  );\n};'));

newCode += renderPart + '\\n    </div>\\n  );\\n};\\n';

fs.writeFileSync('src/components/SecurityCenter/FortigateTable.tsx', newCode, 'utf8');
console.log('FortigateTable.tsx generated safely!');
