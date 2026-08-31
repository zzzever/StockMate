import { useState } from "react";
import {
  Server,
  Play,
  Square,
  Copy,
  Check,
  Code,
  Key,
  Shield,
  Zap,
  Globe,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { motion } from "framer-motion";

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  description: string;
  params?: string[];
  body?: string;
  response: string;
}

const endpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/api/v1/indicators",
    description: "获取可用指标列表",
    response: `{
  "indicators": [
    { "name": "sma", "label": "简单移动平均", "params": ["period"] },
    { "name": "ema", "label": "指数移动平均", "params": ["period"] },
    { "name": "macd", "label": "MACD", "params": ["fast","slow","signal"] },
    { "name": "rsi", "label": "RSI", "params": ["period"] },
    { "name": "kdj", "label": "KDJ", "params": ["n","m1","m2"] }
  ]
}`,
  },
  {
    method: "POST",
    path: "/api/v1/indicator/compute",
    description: "计算指标",
    body: `{
  "code": "ma5 = sma(close, 5); ma10 = sma(close, 10)",
  "params": {},
  "stock_code": "600519",
  "period": "daily"
}`,
    response: `{
  "stock_code": "600519",
  "dates": ["2025-01-02", "2025-01-03", ...],
  "result": {
    "ma5": [1800.25, 1805.30, ...],
    "ma10": [1798.50, 1802.10, ...]
  }
}`,
  },
  {
    method: "POST",
    path: "/api/v1/indicator/backtest",
    description: "指标回测",
    body: `{
  "code": "ma5 = sma(close, 5); ma10 = sma(close, 10); signal = cross(ma5, ma10)",
  "params": {},
  "stock_code": "600519",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}`,
    response: `{
  "stock_code": "600519",
  "period": { "start": "2024-01-01", "end": "2024-12-31" },
  "trades": [
    { "date": "2024-02-15", "action": "buy", "price": 1750.00 },
    { "date": "2024-03-20", "action": "sell", "price": 1820.50 }
  ],
  "stats": {
    "total_return": "12.3%",
    "max_drawdown": "-5.2%",
    "win_rate": "58.3%",
    "trade_count": 24
  }
}`,
  },
  {
    method: "GET",
    path: "/api/v1/stock/{code}/quote",
    description: "获取股票实时行情",
    params: ["code: 股票代码 (如 600519)"],
    response: `{
  "code": "600519",
  "name": "贵州茅台",
  "price": 1805.30,
  "change": 2.50,
  "change_pct": "0.14%",
  "open": 1802.00,
  "high": 1810.50,
  "low": 1798.00,
  "volume": 1258300,
  "amount": 2275800000
}`,
  },
  {
    method: "GET",
    path: "/api/v1/stock/{code}/history",
    description: "获取历史K线",
    params: ["code: 股票代码", "period: 周期 (daily/weekly/monthly)", "days: 天数"],
    response: `{
  "code": "600519",
  "period": "daily",
  "data": [
    { "date": "2025-01-02", "open": 1800, "high": 1810, "low": 1795, "close": 1805, "volume": 1250000 },
    ...
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/health",
    description: "健康检查",
    response: `{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600
}`,
  },
];

const pythonSdkCode = `from stockmate import StockMate

client = StockMate(api_key="your-api-key")

# 计算指标
result = client.compute(
    code="ma5 = sma(close, 5); ma10 = sma(close, 10)",
    stock_code="600519"
)
print(result)

# 回测
backtest = client.backtest(
    code="signal = cross(sma(close, 5), sma(close, 10))",
    stock_code="600519",
    start_date="2024-01-01",
    end_date="2024-12-31"
)
print(backtest.stats)`;

const jsSdkCode = `import { StockMate } from 'stockmate-sdk';

const client = new StockMate({ apiKey: 'your-api-key' });

// 计算指标
const result = await client.compute({
  code: 'ma5 = sma(close, 5); ma10 = sma(close, 10)',
  stockCode: '600519',
});
console.log(result);

// 回测
const backtest = await client.backtest({
  code: 'signal = cross(sma(close, 5), sma(close, 10))',
  stockCode: '600519',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
});
console.log(backtest.stats);`;

const pythonExampleCode = `import requests

resp = requests.post("http://localhost:9876/api/v1/indicator/compute", json={
    "code": "ma5 = sma(close, 5); ma10 = sma(close, 10)",
    "params": {},
    "stock_code": "600519"
})
print(resp.json())`;

const curlExampleCode = `curl -X POST http://localhost:9876/api/v1/indicator/compute \\
  -H "Content-Type: application/json" \\
  -d '{"code":"ma5 = sma(close, 5)","params":{},"stock_code":"600519"}'`;

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "rgba(0,0,0,0.3)",
          borderRadius: "8px 8px 0 0",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            color: "var(--text-tertiary)",
            fontFamily: "monospace",
          }}
        >
          {language}
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: "var(--text-tertiary)",
            fontSize: "12px",
            padding: "2px 6px",
            borderRadius: "4px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-primary)";
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-tertiary)";
            e.currentTarget.style.background = "none";
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "16px",
          background: "rgba(0,0,0,0.5)",
          borderRadius: "0 0 8px 8px",
          overflow: "auto",
          fontSize: "13px",
          lineHeight: "1.6",
          color: "#e2e8f0",
          fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 700,
        fontFamily: "monospace",
        letterSpacing: "0.5px",
        color: "#fff",
        background: method === "GET" ? "#10b981" : "#3b82f6",
        minWidth: "48px",
        justifyContent: "center",
      }}
    >
      {method}
    </span>
  );
}

export default function ApiPage() {
  const [serverRunning, setServerRunning] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState<number | null>(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-secondary)",
        color: "var(--text-primary)",
        padding: "32px 24px",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          textAlign: "center",
          marginBottom: "48px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, hsl(var(--swiss-accent)), hsl(var(--swiss-accent) / 0.6))",
            marginBottom: "20px",
          }}
        >
          <Server size={32} color="#fff" />
        </div>
        <h1
          style={{
            fontSize: "36px",
            fontWeight: 700,
            marginBottom: "8px",
            color: "var(--text-primary)",
          }}
        >
          指标 API
        </h1>
        <p
          style={{
            fontSize: "16px",
            color: "var(--text-secondary)",
            marginBottom: "24px",
          }}
        >
          通过本地 HTTP 接口，让外部程序调用指标计算
        </p>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "16px",
            padding: "12px 24px",
            borderRadius: "12px",
            background: "var(--glass-bg, rgba(255,255,255,0.03))",
            border: "1px solid var(--border-subtle)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: serverRunning ? "#10b981" : "#ef4444",
                boxShadow: serverRunning
                  ? "0 0 8px rgba(16,185,129,0.6)"
                  : "0 0 8px rgba(239,68,68,0.4)",
              }}
            />
            <span
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
              }}
            >
              {serverRunning ? "服务运行中" : "服务已停止"}
            </span>
          </div>

          <button
            onClick={() => setServerRunning(!serverRunning)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 20px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
              color: "#fff",
              background: serverRunning
                ? "linear-gradient(135deg, #ef4444, #dc2626)"
                : "linear-gradient(135deg, hsl(var(--swiss-accent)), hsl(var(--swiss-accent) / 0.8))",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.03)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {serverRunning ? <Square size={14} /> : <Play size={14} />}
            {serverRunning ? "停止服务" : "启动服务"}
          </button>
        </div>
      </motion.div>

      {/* Quick Start */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{ marginBottom: "48px" }}
      >
        <h2
          style={{
            fontSize: "22px",
            fontWeight: 600,
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "var(--text-primary)",
          }}
        >
          <Zap size={20} style={{ color: "hsl(var(--swiss-accent))" }} />
          快速开始
        </h2>

        <div
          className="glass-card"
          style={{
            padding: "24px",
            borderRadius: "16px",
            border: "1px solid var(--border-subtle)",
            background: "var(--glass-bg, rgba(255,255,255,0.03))",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <span
              style={{
                fontSize: "13px",
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                fontWeight: 600,
              }}
            >
              Base URL
            </span>
            <div
              style={{
                marginTop: "8px",
                padding: "10px 16px",
                background: "rgba(0,0,0,0.3)",
                borderRadius: "8px",
                fontFamily: "monospace",
                fontSize: "14px",
                color: "hsl(var(--swiss-accent))",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              http://localhost:9876/api/v1
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  marginBottom: "8px",
                  color: "var(--text-secondary)",
                }}
              >
                Python 示例
              </h3>
              <CodeBlock code={pythonExampleCode} language="python" />
            </div>
            <div>
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  marginBottom: "8px",
                  color: "var(--text-secondary)",
                }}
              >
                cURL 示例
              </h3>
              <CodeBlock code={curlExampleCode} language="bash" />
            </div>
          </div>
        </div>
      </motion.section>

      {/* API Endpoints */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{ marginBottom: "48px" }}
      >
        <h2
          style={{
            fontSize: "22px",
            fontWeight: 600,
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "var(--text-primary)",
          }}
        >
          <Code size={20} style={{ color: "hsl(var(--swiss-accent))" }} />
          API 接口
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {endpoints.map((ep, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i }}
              className="glass-card"
              style={{
                borderRadius: "12px",
                border: "1px solid var(--border-subtle)",
                background: "var(--glass-bg, rgba(255,255,255,0.03))",
                backdropFilter: "blur(12px)",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() =>
                  setExpandedEndpoint(expandedEndpoint === i ? null : i)
                }
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "16px 20px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <MethodBadge method={ep.method} />
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "14px",
                    color: "var(--text-primary)",
                    flex: 1,
                  }}
                >
                  {ep.path}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    flex: 1,
                  }}
                >
                  {ep.description}
                </span>
                <motion.span
                  animate={{ rotate: expandedEndpoint === i ? 180 : 0 }}
                  style={{ color: "var(--text-tertiary)", fontSize: "18px" }}
                >
                  ▾
                </motion.span>
              </button>

              {expandedEndpoint === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    padding: "0 20px 20px",
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  {ep.params && (
                    <div style={{ marginTop: "16px" }}>
                      <h4
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--text-tertiary)",
                          marginBottom: "8px",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        路径参数
                      </h4>
                      <ul
                        style={{
                          margin: 0,
                          padding: "0 0 0 20px",
                          fontSize: "13px",
                          color: "var(--text-secondary)",
                          lineHeight: 1.8,
                        }}
                      >
                        {ep.params.map((p, j) => (
                          <li key={j}>
                            <code
                              style={{
                                background: "rgba(0,0,0,0.3)",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                fontSize: "12px",
                              }}
                            >
                              {p}
                            </code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {ep.body && (
                    <div style={{ marginTop: "16px" }}>
                      <h4
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--text-tertiary)",
                          marginBottom: "8px",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        请求体
                      </h4>
                      <CodeBlock code={ep.body} language="json" />
                    </div>
                  )}
                  <div style={{ marginTop: "16px" }}>
                    <h4
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--text-tertiary)",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      响应
                    </h4>
                    <CodeBlock code={ep.response} language="json" />
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Auth & Rate Limits */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        style={{ marginBottom: "48px" }}
      >
        <h2
          style={{
            fontSize: "22px",
            fontWeight: 600,
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "var(--text-primary)",
          }}
        >
          <Shield size={20} style={{ color: "hsl(var(--swiss-accent))" }} />
          认证与限制
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          <div
            className="glass-card"
            style={{
              padding: "24px",
              borderRadius: "16px",
              border: "1px solid var(--border-subtle)",
              background: "var(--glass-bg, rgba(255,255,255,0.03))",
              backdropFilter: "blur(12px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <Key size={18} style={{ color: "#f59e0b" }} />
              <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                API Key 认证
              </h3>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "12px", lineHeight: 1.6 }}>
              在请求头中携带 API Key 进行身份验证：
            </p>
            <CodeBlock
              code='X-API-Key: your-api-key-here'
              language="header"
            />
          </div>

          <div
            className="glass-card"
            style={{
              padding: "24px",
              borderRadius: "16px",
              border: "1px solid var(--border-subtle)",
              background: "var(--glass-bg, rgba(255,255,255,0.03))",
              backdropFilter: "blur(12px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <AlertCircle size={18} style={{ color: "#3b82f6" }} />
              <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                速率限制
              </h3>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              每个 API Key 每分钟最多 <strong style={{ color: "var(--text-primary)" }}>100 次</strong> 请求。
              超出限制将返回 <code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: "4px", fontSize: "13px" }}>429 Too Many Requests</code>。
            </p>
          </div>

          <div
            className="glass-card"
            style={{
              padding: "24px",
              borderRadius: "16px",
              border: "1px solid var(--border-subtle)",
              background: "var(--glass-bg, rgba(255,255,255,0.03))",
              backdropFilter: "blur(12px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <Globe size={18} style={{ color: "#10b981" }} />
              <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                CORS 跨域
              </h3>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              已启用 CORS，允许 <code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: "4px", fontSize: "13px" }}>localhost</code> 域名下的前端页面直接调用 API。
              生产环境请通过后端代理访问。
            </p>
          </div>
        </div>
      </motion.section>

      {/* SDK Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        style={{ marginBottom: "48px" }}
      >
        <h2
          style={{
            fontSize: "22px",
            fontWeight: 600,
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "var(--text-primary)",
          }}
        >
          <ExternalLink size={20} style={{ color: "hsl(var(--swiss-accent))" }} />
          SDK
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            gap: "16px",
          }}
        >
          <div
            className="glass-card"
            style={{
              padding: "24px",
              borderRadius: "16px",
              border: "1px solid var(--border-subtle)",
              background: "var(--glass-bg, rgba(255,255,255,0.03))",
              backdropFilter: "blur(12px)",
            }}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                marginBottom: "4px",
                color: "var(--text-primary)",
              }}
            >
              Python SDK
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-tertiary)",
                marginBottom: "12px",
              }}
            >
              安装
            </p>
            <CodeBlock code="pip install stockmate-sdk" language="bash" />
            <div style={{ marginTop: "16px" }}>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-tertiary)",
                  marginBottom: "8px",
                }}
              >
                使用示例
              </p>
              <CodeBlock code={pythonSdkCode} language="python" />
            </div>
          </div>

          <div
            className="glass-card"
            style={{
              padding: "24px",
              borderRadius: "16px",
              border: "1px solid var(--border-subtle)",
              background: "var(--glass-bg, rgba(255,255,255,0.03))",
              backdropFilter: "blur(12px)",
            }}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                marginBottom: "4px",
                color: "var(--text-primary)",
              }}
            >
              JavaScript SDK
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-tertiary)",
                marginBottom: "12px",
              }}
            >
              安装
            </p>
            <CodeBlock code="npm install stockmate-sdk" language="bash" />
            <div style={{ marginTop: "16px" }}>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-tertiary)",
                  marginBottom: "8px",
                }}
              >
                使用示例
              </p>
              <CodeBlock code={jsSdkCode} language="typescript" />
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        style={{
          textAlign: "center",
          padding: "24px",
          borderTop: "1px solid var(--border-subtle)",
          marginTop: "32px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            color: "var(--text-tertiary)",
          }}
        >
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: serverRunning ? "#10b981" : "#ef4444",
            }}
          />
          Server running on port 9876
        </div>
      </motion.footer>
    </div>
  );
}
