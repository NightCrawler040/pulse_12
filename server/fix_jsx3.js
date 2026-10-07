import fs from 'fs';

let code = fs.readFileSync('src/components/SecurityCenter/SecurityCenter.tsx', 'utf8');

code = code.split(') : systemTab === "fortigate" ? <FortigateTable /> : (').join(') : systemTab === "fortigate" ? <FortigateTable /> : (<>');

// Now find the end.
// We need to insert `</>` before the LAST `)}` of that ternary.
// Let's just find `        )}\n      </div>\n      )}`
code = code.split('        )}\n      </div>\n      )}').join('        )}\n      </div>\n      </>\n      )}');

fs.writeFileSync('src/components/SecurityCenter/SecurityCenter.tsx', code);
