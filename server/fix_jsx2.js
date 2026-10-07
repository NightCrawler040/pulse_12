import fs from 'fs';

let code = fs.readFileSync('src/components/SecurityCenter/SecurityCenter.tsx', 'utf8');

// The file currently has a syntax error because of two siblings inside the ternary:
// ) : systemTab === "fortigate" ? <FortigateTable /> : (
// <div style={{ display: 'flex' ...
// <div className="findings-list">

// Let's replace the start of the ternary block:
code = code.replace(
  /) : systemTab === "fortigate" \? <FortigateTable \/> : \(\s+<div style={{ display: 'flex'/g,
  ') : systemTab === "fortigate" ? <FortigateTable /> : (<>\n      <div style={{ display: \'flex\''
);

// Now let's fix the end of the ternary block.
// Currently it is:
//       </div>
//       )}
// Let's find the closing of findings-list and add </> before )}
code = code.replace(
  /      <\/div>\n      \)}\n/g,
  '      </div>\n      </>\n      )}\n'
);

// Wait, the previous fix_jsx.js might have already added </> and )} somewhere.
// Let's just do a clean replace using regex.
// First remove any stray `</>` and `)}` that shouldn't be there.
// Actually, it's safer to just overwrite the file from git history before all fixes, and apply them cleanly!

fs.writeFileSync('src/components/SecurityCenter/SecurityCenter.tsx', code);
