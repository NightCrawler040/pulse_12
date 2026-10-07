import fs from 'fs';

let code = fs.readFileSync('src/components/SecurityCenter/SecurityCenter.tsx', 'utf8');

// The file currently has:
// ) : systemTab === "fortigate" ? <FortigateTable /> : (
//
// <div style={{ display: 'flex' ...

code = code.replace(
  ') : systemTab === "fortigate" ? <FortigateTable /> : (',
  ') : systemTab === "fortigate" ? <FortigateTable /> : (<>'
);

// The end of the file currently has:
/*
      </div>
      )}

      
          </>
        )}
*/

let oldEnd = `      </div>
      )}

      
          </>
        )}`;

let newEnd = `      </div>
      </>
      )}`;

if (code.includes(oldEnd)) {
  code = code.split(oldEnd).join(newEnd);
} else {
  // Try CRLF
  oldEnd = "      </div>\r\n      )}\r\n\r\n      \r\n          </>\r\n        )}";
  newEnd = "      </div>\r\n      </>\r\n      )}";
  code = code.split(oldEnd).join(newEnd);
}

fs.writeFileSync('src/components/SecurityCenter/SecurityCenter.tsx', code);
