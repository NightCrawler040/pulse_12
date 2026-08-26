const fs = require('fs');
let c = fs.readFileSync('server/services/imapService.js', 'utf8');

const regexStart = /const checkUnread = async \(\) => \{\r?\n\s*try \{\r?\n\s*const searchOptions = \{ seen: false \};/;
const replaceStart = `let isProcessing = false;\n    const checkUnread = async () => {\n      if (isProcessing) return;\n      isProcessing = true;\n      try {\n        const searchOptions = { seen: false };`;

if (regexStart.test(c)) {
  c = c.replace(regexStart, replaceStart);
  
  const regexEnd = /\}\s*catch\s*\(e\)\s*\{\s*console\.error\([^)]+\);\s*\}\s*\};\s*try\s*\{/;
  const match = c.match(regexEnd);
  if (match) {
    const replacement = match[0].replace('}', '} finally { isProcessing = false; }');
    c = c.replace(match[0], replacement);
    fs.writeFileSync('server/services/imapService.js', c);
    console.log("Added isProcessing lock!");
  } else {
    console.log("Could not find catch block end");
  }
} else {
  console.log("Could not find checkUnread start");
}
