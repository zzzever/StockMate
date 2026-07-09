# SSLang v1.0 — Stock Strategy Language

SSLang 是 StockMate 的股票策略编程语言，专门为逐根 K 线求值布尔表达式而设计。
语法极简、零学习成本、安全沙箱执行（无 eval，无网络/文件/全局对象访问），由受限解释器逐 bar 运行。

---

## 1. 程序结构

一个 SSLang 文件包含零或多个 **RULE 块**。每个 RULE 块描述一条独立的交易策略规则。

```
RULE "规则名称"
  SIGNAL BUY | SELL | ALERT
  WHEN 布尔表达式
  NOTE "自然语言说明"
```

所有四个部分必须存在、按顺序排列。`--` 到行尾为注释。

### 示例

```
-- 连续三天缩量下跌后次日上涨买入 --
RULE "三天缩量跌后反弹"
  SIGNAL BUY
  WHEN i >= 4 && down(i-1, 3) && shrink(i-1, 3) && close(i) > close(i-1)
  NOTE "连续3天缩量下跌后次日收阳买入"

RULE "均线金叉"
  SIGNAL BUY
  WHEN cross(sma(5, i), sma(10, i))
  NOTE "5日均线上穿10日均线"

RULE "RSI超卖提醒"
  SIGNAL ALERT
  WHEN rsi(14, i) < 30
  NOTE "14日RSI低于30，关注超卖反弹机会"

RULE "放量跌破支撑"
  SIGNAL SELL
  WHEN close(i) < sma(20, i) && volume(i) > volume(i-1) * 2
  NOTE "价格跌破20日线且成交量放倍"
```

---

## 2. 数据类型

SSLang 只有四种值：

| 类型 | 示例 | 说明 |
|---|---|---|
| `number` | `100`, `3.14` | IEEE 754 双精度浮点 |
| `boolean` | `true`, `false` | 逻辑值 |
| `string` | `"hello"` | 仅用于 NOTE 和 RULE 名称 |
| `null` | `null` | 缺失/无效数据的占位 |

运算符遇到 `null` 操作数时，比较运算符返回 `false`，算术运算符返回 `null`。

---

## 3. 变量

唯一的内置变量是 `i` —— **当前求值的 bar 下标**（0-based，从最早 K 线数起）。

```
i           -- 当前 bar 的下标（0, 1, 2, ...）
i >= 4      -- 至少需要 5 根 bar（常见于 lookback 保护）
```

---

## 4. 数据访问函数

读取第 k 根 bar 的 OHLCV 数据。k 越界时返回 `null`。

| 函数 | 说明 |
|---|---|
| `open(k)` | 第 k 根 bar 的开盘价 |
| `high(k)` | 第 k 根 bar 的最高价 |
| `low(k)` | 第 k 根 bar 的最低价 |
| `close(k)` | 第 k 根 bar 的收盘价 |
| `volume(k)` | 第 k 根 bar 的成交量 |

也可用下标语法：`close[k]` 等价于 `close(k)`。

---

## 5. 技术指标函数

所有指标函数返回 `number | null`。数据不足（bar 不够）时返回 `null`。

### 均线 / 动量 / 摆动

| 函数 | 参数 | 说明 |
|---|---|---|
| `sma(n, k)` | n=周期, k=bar下标 | n 日简单移动平均 |
| `ema(n, k)` | n=周期, k=bar下标 | n 日指数移动平均 |
| `rsi(n, k)` | n=周期, k=bar下标 | n 日 RSI（0-100） |
| `wr(n, k)` | n=周期, k=bar下标 | 威廉指标 %R（-100 到 0） |
| `cci(n, k)` | n=周期, k=bar下标 | 顺势指标 CCI |
| `momentum(n, k)` | n=周期, k=bar下标 | 动量：`close(k) - close(k-n)` |
| `roc(n, k)` | n=周期, k=bar下标 | 变化率：`(close(k)-close(k-n))/close(k-n)*100` |
| `bias(n, k)` | n=周期, k=bar下标 | 乖离率：价格偏离 n 日均线的百分比 |

### MACD / KDJ

| 函数 | 参数 | 说明 |
|---|---|---|
| `macddiff(k)` | k=bar下标 | MACD DIF（12-26 EMA 差） |
| `macddea(k)` | k=bar下标 | MACD DEA（DIF 的 9-EMA） |
| `macdhist(k)` | k=bar下标 | MACD 柱（DIF - DEA） |
| `kdj_k(k)` | k=bar下标 | KDJ 的 K 值（9,3,3） |
| `kdj_d(k)` | k=bar下标 | KDJ 的 D 值 |
| `kdj_j(k)` | k=bar下标 | KDJ 的 J 值 |

### 布林带 / 波动率

| 函数 | 参数 | 说明 |
|---|---|---|
| `boll_upper(n, k)` | n=周期, k=bar下标 | 布林带上轨（SMA + 2σ） |
| `boll_middle(n, k)` | n=周期, k=bar下标 | 布林带中轨（= sma(n,k)） |
| `boll_lower(n, k)` | n=周期, k=bar下标 | 布林带下轨（SMA - 2σ） |
| `atr(n, k)` | n=周期, k=bar下标 | 平均真实波幅 ATR |
| `stddev(n, k)` | n=周期, k=bar下标 | n 日收盘价标准差 |

### 极值 / 通道

| 函数 | 参数 | 说明 |
|---|---|---|
| `highest(n, k)` | n=窗口, k=bar下标 | 近 n 根 bar 收盘价最高值 |
| `lowest(n, k)` | n=窗口, k=bar下标 | 近 n 根 bar 收盘价最低值 |
| `hhv(n, k)` | n=窗口, k=bar下标 | 近 n 根 bar 最高价的最大值 |
| `llv(n, k)` | n=窗口, k=bar下标 | 近 n 根 bar 最低价的最小值 |

### 成交量

| 函数 | 参数 | 说明 |
|---|---|---|
| `volume_ma(n, k)` | n=周期, k=bar下标 | n 日成交量均线 |
| `volume_ratio(k)` | k=bar下标 | 量比：`volume(k) / volume_ma(5, k)` |
| `obv(k)` | k=bar下标 | 能量潮 OBV（累计） |
| `ad(k)` | k=bar下标 | 累积/派发线（Chaikin A/D） |

---

## 6. 形态检测函数

返回 `boolean`。

| 函数 | 参数 | 说明 |
|---|---|---|
| `down(k, n)` | k=结束bar, n=天数 | 从 k-n+1 到 k 连续 n 天收盘价递减 |
| `up(k, n)` | k=结束bar, n=天数 | 从 k-n+1 到 k 连续 n 天收盘价递增 |
| `shrink(k, n)` | k=结束bar, n=天数 | 从 k-n+1 到 k 连续 n 天成交量递减 |
| `surge(k, n)` | k=结束bar, n=天数 | 从 k-n+1 到 k 连续 n 天成交量递增 |
| `cross(a, b)` | a,b=数值表达式 | a 上穿 b（当前 > 且 前一根 ≤） |
| `crossunder(a, b)` | a,b=数值表达式 | a 下穿 b（当前 < 且 前一根 ≥） |

`cross` / `crossunder` 自动比较当前 bar(i) 与前一根 bar(i-1) 的值，无需手动写 cross 逻辑。

## 6b. K 线形态函数

返回 `boolean`。参数 `k` 为 bar 下标。

| 函数 | 说明 |
|---|---|
| `hammer(k)` | 锤子线（长下影、小实体、实体在上半部） |
| `inv_hammer(k)` | 倒锤子线（长上影、小实体） |
| `doji(k)` | 十字星（实体极小） |
| `engulf_bull(k)` | 牛市吞没（阳线完全包住前一根阴线） |
| `engulf_bear(k)` | 熊市吞没（阴线完全包住前一根阳线） |
| `morning_star(k)` | 晨星（两跌后大阳，见底反转） |
| `evening_star(k)` | 暮星（两涨后大阴，见顶反转） |
| `gap_up(k)` | 向上跳空（当前 low > 前一根 high） |
| `gap_down(k)` | 向下跳空（当前 high < 前一根 low） |
| `three_soldiers(k)` | 红三兵（连续三根强势阳线） |
| `three_crows(k)` | 三只乌鸦（连续三根阴线） |

---

## 7. 便捷函数

| 函数 | 等价表达式 | 说明 |
|---|---|---|
| `above_ma(n, k)` | `close(k) > sma(n, k)` | 价格高于 n 日均线（上升趋势） |
| `below_ma(n, k)` | `close(k) < sma(n, k)` | 价格低于 n 日均线（下降趋势） |
| `abs(x)` | 绝对值 | |
| `min(a, b)` | 取最小值 | |
| `max(a, b)` | 取最大值 | |

---

## 8. 运算符

按优先级从高到低：

| 优先级 | 运算符 | 说明 |
|---|---|---|
| 1 | `? :` | 三元条件 |
| 2 | `\|\|` | 逻辑或 |
| 3 | `&&` | 逻辑与 |
| 4 | `== != < <= > >=` | 比较 |
| 5 | `+ -` | 加减 |
| 6 | `* / %` | 乘除取模 |
| 7 | `! -`（一元） | 逻辑非、负号 |
| 8 | `()` `[]` | 分组、下标 |

---

## 9. 信号类型

| SIGNAL | 含义 | K线上标记颜色 |
|---|---|---|
| `BUY` | 买入信号 | 红色 |
| `SELL` | 卖出信号 | 绿色 |
| `ALERT` | 提醒信号 | 黄色 |

---

## 10. 常用策略模板

### 均线金叉/死叉
```
RULE "MA金叉买入"  SIGNAL BUY  WHEN cross(sma(5, i), sma(10, i))  NOTE "5日线上穿10日线"
RULE "MA死叉卖出"  SIGNAL SELL WHEN crossunder(sma(5, i), sma(10, i))  NOTE "5日线下穿10日线"
```

### RSI 超买超卖
```
RULE "RSI超卖"  SIGNAL BUY  WHEN rsi(14, i) < 30  NOTE "14日RSI低于30"
RULE "RSI超买"  SIGNAL SELL WHEN rsi(14, i) > 70  NOTE "14日RSI高于70"
```

### MACD 信号
```
RULE "MACD金叉"  SIGNAL BUY  WHEN cross(macddiff(i), macddea(i))  NOTE "DIF上穿DEA"
RULE "MACD死叉"  SIGNAL SELL WHEN crossunder(macddiff(i), macddea(i))  NOTE "DIF下穿DEA"
```

### 连续 N 天形态
```
RULE "连阳"   SIGNAL BUY   WHEN up(i, 3)                     NOTE "连续3天上涨"
RULE "连阴"   SIGNAL SELL  WHEN down(i, 3)                   NOTE "连续3天下跌"
RULE "缩量跌" SIGNAL ALERT WHEN down(i, 3) && shrink(i, 3)  NOTE "连续3天缩量下跌，注意风险"
```

### 量价配合
```
RULE "放量突破"  SIGNAL BUY   WHEN close(i) > hhv(20, i-1) && volume(i) > volume(i-1) * 1.5  NOTE "放量突破20日高点"
RULE "放量跌破"  SIGNAL SELL  WHEN close(i) < llv(20, i-1) && volume(i) > volume(i-1) * 1.5  NOTE "放量跌破20日低点"
```

### 组合条件
```
-- 连续3天缩量下跌后次日反弹（常见反转形态）
RULE "缩量跌后反弹"
  SIGNAL BUY
  WHEN i >= 4 && down(i-1, 3) && shrink(i-1, 3) && close(i) > close(i-1)
  NOTE "连续3天缩量下跌后第4天收阳买入"

-- 连续3天缩量下跌后次日上涨 + 处于上升趋势（价格>20日均线）
RULE "缩量跌后反弹，上升趋势"
  SIGNAL BUY
  WHEN i >= 4 && down(i-1, 3) && shrink(i-1, 3) && close(i) > close(i-1) && above_ma(20, i)
  NOTE "连续3天缩量下跌后收阳，且价格在20日均线上方"
```

---

## 11. 安全约束

SSLang 代码在受沙箱环境中执行：
- **无** `eval`/`new Function`
- **无** 网络/文件/定时器访问
- **无** 全局对象（`window`、`document`、`fetch`、`setTimeout` 等被拦截抛错）
- **无** 赋值、循环、函数定义
- **单次求值步数上限** 20000（防止恶意超长表达式耗尽 CPU）
- `null` 安全：索引越界/数据不足返回 `null`，不会崩溃

---

## 12. 完整语法

```
program     → rule*
rule        → "RULE" string EOL
              "  SIGNAL" ("BUY" | "SELL" | "ALERT") EOL
              "  WHEN" expr EOL
              ("  NOTE" string EOL)?
comment     → "--" .* EOL
expr        → or_expr
or_expr     → and_expr ("||" and_expr)*
and_expr    → cmp_expr ("&&" cmp_expr)*
cmp_expr    → add_expr (("==" | "!=" | "<" | "<=" | ">" | ">=") add_expr)?
add_expr    → mul_expr (("+" | "-") mul_expr)*
mul_expr    → unary_expr (("*" | "/" | "%") unary_expr)*
unary_expr  → ("!" | "-") unary_expr | primary
primary     → NUMBER | STRING | "true" | "false" | "null"
            | IDENTIFIER "(" expr ("," expr)* ")"
            | IDENTIFIER "[" expr "]"
            | IDENTIFIER
            | "(" expr ")"
            | expr "?" expr ":" expr
```
