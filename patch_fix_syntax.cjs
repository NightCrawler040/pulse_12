const fs = require('fs');
let code = fs.readFileSync('src/components/SecurityCenter/SecurityCenter.tsx', 'utf8');

code = code.replace(/\{ Modal for Promoting Finding to Task \}/, "");

fs.writeFileSync('src/components/SecurityCenter/SecurityCenter.tsx', code);
