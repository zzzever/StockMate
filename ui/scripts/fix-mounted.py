import sys
with open('src/pages/BacktestPage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix: add isMounted.current = true at the start of effect 1
old = (
    " // EFFECT 1: Create chart ONCE on mount, NEVER recreate\n"
    " useEffect(() => {\n"
    " if (!containerRef.current) return;\n"
    " try {"
)
new = (
    " // EFFECT 1: Create chart ONCE on mount, NEVER recreate\n"
    " useEffect(() => {\n"
    " isMounted.current = true;\n"
    " if (!containerRef.current) return;\n"
    " try {"
)

c = c.replace(old, new)
with open('src/pages/BacktestPage.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('Fixed isMounted')
