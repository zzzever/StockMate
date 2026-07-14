const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src', '__tests__', 'store', 'useAppStore.test.ts');
let c = fs.readFileSync(filePath, 'utf8');

const oldTest =
  "  it('toggleDarkMode toggles theme and updates document class', () => {\n" +
  "      useAppStore.getState().toggleDarkMode();\n" +
  "      expect(useAppStore.getState().theme).toBe('light');\n" +
  "      expect(useAppStore.getState().darkMode).toBe(false);\n" +
  "      useAppStore.getState().toggleDarkMode();\n" +
  "      expect(useAppStore.getState().theme).toBe('dark');\n" +
  "      expect(useAppStore.getState().darkMode).toBe(true);\n" +
  "      document.documentElement.className = '';\n" +
  "  });";

const newTest =
  "  it('toggleDarkMode stays dark (dark-only mode)', () => {\n" +
  "    useAppStore.getState().toggleDarkMode();\n" +
  "    expect(useAppStore.getState().theme).toBe('dark');\n" +
  "    expect(useAppStore.getState().darkMode).toBe(true);\n" +
  "    document.documentElement.className = '';\n" +
  "  });";

c = c.replace(oldTest, newTest);
fs.writeFileSync(filePath, c);
console.log('done');
