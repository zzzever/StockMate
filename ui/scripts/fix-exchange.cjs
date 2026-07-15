const fs = require('fs');
const path = require('path');

const fp = path.resolve(__dirname, '..', '..', 'crates', 'api_tauri_commands', 'src', 'commands_v2.rs');
let c = fs.readFileSync(fp, 'utf8');

// Fix exchange field - replace broken code
const oldCode = `            exchange: if code.starts_with('6') || code.starts_with('9') { \"SH\" }\n                else if code.starts_with('0') || code.starts_with('3') || code.starts_with('2') { \"SZ\" }\n                else if code.starts_with('4') || code.starts_with('8') { \"BJ\" }\n                else { &i.exchange }.to_string(),`;

const newCode = `            exchange: {\n                let c = item.stock_code.as_str();\n                if c.starts_with('6') || c.starts_with('9') { \"SH\" }\n                else if c.starts_with('0') || c.starts_with('3') || c.starts_with('2') { \"SZ\" }\n                else if c.starts_with('4') || c.starts_with('8') { \"BJ\" }\n                else { \"\" }\n            }.to_string(),`;

c = c.replace(oldCode, newCode);
fs.writeFileSync(fp, c);
console.log('Fixed exchange field');
