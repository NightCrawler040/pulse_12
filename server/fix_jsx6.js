import fs from 'fs';

let code = fs.readFileSync('src/components/SecurityCenter/SecurityCenter.tsx', 'utf8');

code = code.replace(
  /\) : systemTab === "fortigate" \? <FortigateTable \/> : \(\r?\n/,
  ') : systemTab === "fortigate" ? <FortigateTable /> : (<>\n'
);

code = code.replace(
  /        \)}\r?\n      <\/div>\r?\n      \)}\r?\n/g,
  '        )}\n      </div>\n      </>\n      )}\n'
);

fs.writeFileSync('src/components/SecurityCenter/SecurityCenter.tsx', code);
console.log('Fixed CRLF syntax');
