const fs = require('fs');

let code = fs.readFileSync('server/index.js', 'utf8');

// Add imports
code = code.replace(/import \{ getDbData, setDbData, setIo \} from '\.\/store\.js';/, "import { getDbData, setDbData, setIo, getSanitizedDbData, getSanitizedDbDataForUser } from './store.js';");

// Remove const getSanitizedDbData = () => { ... }
code = code.replace(/const getSanitizedDbDataForUser = \(user\) => \{[\s\S]*?const getSanitizedDbData = \(\) => \{[\s\S]*?return \{[\s\S]*?workspaces: dbData\.workspaces,[\s\S]*?\};[\s\S]*?\};\n/, "");

// Re-apply Bug #5 fix (since we reverted index.js to before it)
code = code.replace(/socket\.emit\('init-data', getSanitizedDbData\(\)\);/, 
  "// Removed init-data on raw connection (Bug #5). Will send after user-online.");

fs.writeFileSync('server/index.js', code);
