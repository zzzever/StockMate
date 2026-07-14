const fs = require('fs');
const c = fs.readFileSync('src/pages/SearchPage.tsx', 'utf8');
let out = c;
// Delete import line
out = out.replace(/import \{ motion, AnimatePresence \} from 'framer-motion';\n/, '');
// Remove <AnimatePresence> wrappers
out = out.replace(/<AnimatePresence[^>]*>\n/g, '');
out = out.replace(/<\/AnimatePresence>\n/g, '');
// Replace motion.div -> div, motion.button -> button
out = out.replace(/motion\.div/g, 'div');
out = out.replace(/motion\.button/g, 'button');
// Remove initial/animate/exit/transition props (multi-line)
out = out.replace(/\n\s+(initial|animate|exit|transition)=\{[^}]*\}/g, '');
fs.writeFileSync('src/pages/SearchPage.tsx', out);
console.log('SearchPage fixed');
