import sys
with open('src/pages/BacktestPage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

old = (
    ' // Add trade markers to the strategy series\n'
    ' if (result.trades?.length) {\n'
    ' const markers = result.trades.map(t => ({\n'
    ' time: t.date as any,\n'
    ' position: t.type === \'buy\' ? \'belowBar\' as const : \'aboveBar\' as const,\n'
    ' shape: t.type === \'buy\' ? \'arrowUp\' as const : \'arrowDown\' as const,\n'
    ' color: t.type === \'buy\' ? \'#22c55e\' : \'#ef4444\',\n'
    ' text: t.type === \'buy\' ? \'B\' : \'S\',\n'
    ' size: 1.5,\n'
    ' }));\n'
    ' strategySeriesRef.current.setMarkers(markers);\n'
    ' } else {\n'
    ' strategySeriesRef.current.setMarkers([]);\n'
    ' }'
)

new = (
    ' // Add trade markers to the strategy series\n'
    ' if (result.trades?.length) {\n'
    ' const markers = result.trades.map(t => ({\n'
    ' time: t.date as any,\n'
    ' position: t.type === \'buy\' ? \'belowBar\' as const : \'aboveBar\' as const,\n'
    ' shape: t.type === \'buy\' ? \'arrowUp\' as const : \'arrowDown\' as const,\n'
    ' color: t.type === \'buy\' ? \'#22c55e\' : \'#ef4444\',\n'
    ' text: t.type === \'buy\' ? \'B\' : \'S\',\n'
    ' size: 1.5,\n'
    ' }));\n'
    ' try {\n'
    ' strategySeriesRef.current.setMarkers(markers);\n'
    ' } catch (e) {\n'
    ' console.warn(\'setMarkers failed:\', e);\n'
    ' }\n'
    ' } else {\n'
    ' try {\n'
    ' strategySeriesRef.current.setMarkers([]);\n'
    ' } catch (_) {}\n'
    ' }'
)

count = c.count(old)
print(f'Old marker code count: {count}')

if count >= 1:
    c = c.replace(old, new)
    with open('src/pages/BacktestPage.tsx', 'w', encoding='utf-8') as f:
        f.write(c)
    print('Replaced markers code')
else:
    # Search for nearby pattern
    idx = c.find('setMarkers(markers)')
    print(f'setMarkers(markers) at: {idx}')
    idx2 = c.find('setMarkers([])')
    print(f'setMarkers([]) at: {idx2}')
    print('Context around setMarkers(markers):')
    print(repr(c[idx-200:idx+200]))
