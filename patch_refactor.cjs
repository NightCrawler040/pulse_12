const fs = require('fs');

let code = fs.readFileSync('server/index.js', 'utf8');

// Add imports
code = code.replace(/import \{ getDbData, setDbData, setIo \} from '\.\/store\.js';/, "import { getDbData, setDbData, setIo, getSanitizedDbData, getSanitizedDbDataForUser } from './store.js';");

// Remove const getSanitizedDbData = () => { ... };
// We need to match the entire function. It's tricky with regex. Let's use string manipulation.

const start1 = code.indexOf('const getSanitizedDbDataForUser = (user) => {');
const end1 = code.indexOf('const getSanitizedDbData = () => {');
if (start1 !== -1 && end1 !== -1) {
  // getSanitizedDbData is right after getSanitizedDbDataForUser
  // let's find the end of getSanitizedDbData
  const authStart = code.indexOf('const requireAuth = async (req, res, next) => {');
  if (authStart !== -1) {
    code = code.substring(0, start1) + code.substring(authStart);
  }
}

fs.writeFileSync('server/index.js', code);
