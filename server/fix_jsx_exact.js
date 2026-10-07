import fs from 'fs';

let code = fs.readFileSync('src/components/SecurityCenter/SecurityCenter.tsx', 'utf8');

// 1. Fix the opening fragment
code = code.replace(
  `) : systemTab === "fortigate" ? <FortigateTable /> : (
      
      <div style={{ display: 'flex'`,
  `) : systemTab === "fortigate" ? <FortigateTable /> : (
      <>
      <div style={{ display: 'flex'`
);

// 2. Remove the broken closing fragment added by previous mistakes
code = code.replace(
  /      <\/div>\n      \)}\n\n      \n          <\/>\n        \)}\n      \n\n      {\/\* Modal for Promoting Finding to Task \*\//g,
  `      </div>\n      )}`
);

// 3. Add the proper closing fragment at the end of the findings-list div
code = code.replace(
  /        \)}\n      <\/div>\n      \)}/g,
  `        )}\n      </div>\n      </>\n      )}`
);

fs.writeFileSync('src/components/SecurityCenter/SecurityCenter.tsx', code);
console.log('Fixed syntax exactly.');
