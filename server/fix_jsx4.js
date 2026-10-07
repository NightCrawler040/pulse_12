import fs from 'fs';

let code = fs.readFileSync('src/components/SecurityCenter/SecurityCenter.tsx', 'utf8');

// I know exactly what the file looks like.
// It has:
// ) : systemTab === "fortigate" ? <FortigateTable /> : (
// <div style={{ display: 'flex' ...
// ...
// </div>
// )}
//
// </>\n)}

// Let's just fix it by replacing the whole thing.
code = code.replace(
  /) : systemTab === "fortigate" \? <FortigateTable \/> : \(\r?\n\s*<div style={{ display: 'flex'/g,
  ') : systemTab === "fortigate" ? <FortigateTable /> : (<>\n      <div style={{ display: \'flex\''
);

code = code.replace(
  /        \)}\r?\n      <\/div>\r?\n      \)}\r?\n\r?\n      \r?\n          <\/>\r?\n        \)}\r?\n/g,
  '        )}\n      </div>\n      </>\n      )}\n'
);

// If the regex doesn't match, let's do something simpler:
if (!code.includes('<FortigateTable /> : (<>')) {
  let parts = code.split(') : systemTab === "fortigate" ? <FortigateTable /> : (');
  if (parts.length === 2) {
    code = parts[0] + ') : systemTab === "fortigate" ? <FortigateTable /> : (<>' + parts[1];
  }
}

let endPart = `        )}
      </div>
      )}

      
          </>
        )}`;
        
if (code.includes(endPart)) {
  code = code.split(endPart).join(`        )}
      </div>
      </>
      )}`);
} else {
  // Try alternative endings
  code = code.replace(
    /      <\/div>\r?\n      \)}\r?\n\r?\n      \r?\n          <\/>\r?\n        \)}/g,
    '      </div>\n      </>\n      )}'
  );
}


fs.writeFileSync('src/components/SecurityCenter/SecurityCenter.tsx', code);
