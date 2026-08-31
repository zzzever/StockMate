import { useState, useMemo, useCallback } from "react";
import {
  Layers,
  Plus,
  X,
  Trash2,
  Edit3,
  Play,
  Save,
  Search,
  Star,
  Clock,
  Users,
  Eye,
  ChevronRight,
  Zap,
  TrendingUp,
  Activity,
  BarChart3,
  GitBranch,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "stockmate_strategy_combos";

const availableIndicators: { id: string; name: string; category: string; color: string }[] = [
  { id: "supertrend", name: "SuperTrend", category: "趋势", color: "hsl(142, 71%, 45%)" },
  { id: "rsi", name: "RSI Divergence", category: "动量", color: "hsl(262, 83%, 58%)" },
  { id: "macd", name: "MACD", category: "动量", color: "hsl(207, 90%, 54%)" },
  { id: "ma_cross", name: "MA Cross", category: "趋势", color: "hsl(47, 96%, 53%)" },
  { id: "vvolume", name: "VVolume", category: "量价", color: "hsl(24, 95%, 53%)" },
  { id: "bollinger", name: "Bollinger Bands", category: "波动率", color: "hsl(339, 82%, 52%)" },
  { id: "kdj", name: "KDJ", category: "动量", color: "hsl(168, 76%, 42%)" },
  { id: "atr_channel", name: "ATR Channel", category: "波动率", color: "hsl(291, 64%, 42%)" },
  { id: "obv", name: "OBV", category: "量价", color: "hsl(199, 89%, 48%)" },
  { id: "sar", name: "Parabolic SAR", category: "趋势", color: "hsl(84, 81%, 44%)" },
  { id: "bollinger_squeeze", name: "Bollinger Squeeze", category: "波动率", color: "hsl(12, 92%, 57%)" },
];

interface StrategyCombo {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  author: string;
  createdAt: string;
  likes: number;
  useCount: number;
  tags: string[];
  featured?: boolean;
}

const defaultCombos: StrategyCombo[] = [
  {
    id: "trend_following",
    name: "趋势跟踪组合",
    description: "趋势策略三件套：SuperTrend判断方向，MA Cross确认趋势，ATR Channel动态止损。适合中长线持仓。",
    indicators: ["supertrend", "ma_cross", "atr_channel"],
    author: "SwissQuant",
    createdAt: "2026-01-15",
    likes: 342,
    useCount: 1205,
    tags: ["趋势", "稳健", "中长线"],
    featured: true,
  },
  {
    id: "reversal_hunter",
    name: "反转捕捉组合",
    description: "捕捉顶部和底部反转信号。RSI背离找极值，MACD交叉确认动量，布林带提供超买超卖参考。",
    indicators: ["rsi", "macd", "bollinger"],
    author: "SwissQuant",
    createdAt: "2026-02-10",
    likes: 287,
    useCount: 892,
    tags: ["反转", "短线", "激进"],
    featured: true,
  },
  {
    id: "volume_price",
    name: "量价确认组合",
    description: "量价关系验证工具。VVolume识别主力行为，OBV追踪资金流向，SAR提示趋势反转。",
    indicators: ["vvolume", "obv", "sar"],
    author: "QuantMaster",
    createdAt: "2026-03-05",
    likes: 198,
    useCount: 567,
    tags: ["量价", "资金流", "进阶"],
    featured: true,
  },
  {
    id: "volatility_trading",
    name: "波动率交易组合",
    description: "波动率策略套件。Bollinger Squeeze捕捉突破前兆，ATR Channel提供目标位，KDJ辅助择时。",
    indicators: ["bollinger_squeeze", "atr_channel", "kdj"],
    author: "VolTrader",
    createdAt: "2026-03-20",
    likes: 156,
    useCount: 423,
    tags: ["波动率", "突破", "日内"],
    featured: true,
  },
  {
    id: "beginner_combo",
    name: "入门推荐组合",
    description: "新手友好型组合。MA Cross提供方向，MACD辅助判断动量，RSI提示超买超卖。简单直观。",
    indicators: ["ma_cross", "macd", "rsi"],
    author: "SwissQuant",
    createdAt: "2026-01-20",
    likes: 521,
    useCount: 2340,
    tags: ["入门", "简单", "稳健"],
    featured: true,
  },
];

function loadCombos(): StrategyCombo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return defaultCombos;
}

function saveCombos(combos: StrategyCombo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(combos));
}

function getIndicator(id: string) {
  return availableIndicators.find((i) => i.id === id);
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "趋势": return <TrendingUp size={14} />;
    case "动量": return <Activity size={14} />;
    case "量价": return <BarChart3 size={14} />;
    case "波动率": return <Zap size={14} />;
    default: return <GitBranch size={14} />;
  }
}

function ComboCard({
  combo,
  onClick,
  onDelete,
  isOwn,
}: {
  combo: StrategyCombo;
  onClick: () => void;
  onDelete?: () => void;
  isOwn?: boolean;
}) {
  return (
    <motion.div
      className="glass-card"
      style={{
        padding: 20,
        borderRadius: 14,
        cursor: "pointer",
        border: combo.featured ? "1px solid hsl(47, 96%, 53%, 0.3)" : "1px solid var(--border-subtle)",
        background: "var(--bg-secondary)",
        position: "relative",
        overflow: "hidden",
      }}
      whileHover={{ scale: 1.02, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      {combo.featured && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "hsl(47, 96%, 53%, 0.15)",
            color: "hsl(47, 96%, 53%)",
            borderRadius: 6,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Star size={10} />
          精选
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, hsl(var(--swiss-accent)), hsl(262, 83%, 58%))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <Layers size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {combo.name}
          </h3>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            by {combo.author} · {combo.createdAt}
          </span>
        </div>
        {isOwn && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px 0", lineHeight: 1.5 }}>
        {combo.description}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {combo.indicators.map((indId) => {
          const ind = getIndicator(indId);
          if (!ind) return null;
          return (
            <span
              key={indId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 6,
                background: `${ind.color}15`,
                color: ind.color,
                fontWeight: 500,
              }}
            >
              {getCategoryIcon(ind.category)}
              {ind.name}
            </span>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-tertiary)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Star size={12} />
          {combo.likes}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Users size={12} />
          {combo.useCount}
        </span>
      </div>

      {combo.tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {combo.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-tertiary)",
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ComboDetailModal({
  combo,
  onClose,
  onApply,
}: {
  combo: StrategyCombo;
  onClose: () => void;
  onApply: () => void;
}) {
  const indicators = combo.indicators
    .map(getIndicator)
    .filter(Boolean) as typeof availableIndicators;

  return (
    <motion.div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
        }}
        onClick={onClose}
      />

      <motion.div
        className="glass-card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 560,
          maxHeight: "80vh",
          overflow: "auto",
          padding: 28,
          borderRadius: 18,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-subtle)",
        }}
        initial={{ scale: 0.92, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 30 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            padding: 4,
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "linear-gradient(135deg, hsl(var(--swiss-accent)), hsl(262, 83%, 58%))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 20,
            }}
          >
            <Layers size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              {combo.name}
            </h2>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              作者: {combo.author} · 创建于 {combo.createdAt}
            </span>
          </div>
        </div>

        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
          {combo.description}
        </p>

        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>
            包含指标
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {indicators.map((ind, idx) => (
              <div
                key={ind.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--bg-primary, var(--bg-secondary))",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: `${ind.color}18`,
                    color: ind.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{ind.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{ind.category}类指标</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-tertiary)" }}>
                  {getCategoryIcon(ind.category)}
                  <ChevronRight size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 20,
          }}
        >
          {combo.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 6,
                background: "hsl(var(--swiss-accent), 0.1)",
                color: "hsl(var(--swiss-accent))",
                fontWeight: 500,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
          <div
            style={{
              flex: 1,
              textAlign: "center",
              padding: 10,
              borderRadius: 10,
              background: "var(--bg-primary, var(--bg-secondary))",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{combo.likes}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>收藏</div>
          </div>
          <div
            style={{
              flex: 1,
              textAlign: "center",
              padding: 10,
              borderRadius: 10,
              background: "var(--bg-primary, var(--bg-secondary))",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{combo.useCount}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>使用</div>
          </div>
        </div>

        <button
          onClick={onApply}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, hsl(var(--swiss-accent)), hsl(262, 83%, 58%))",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Play size={16} />
          应用此组合
        </button>
      </motion.div>
    </motion.div>
  );
}

function CreateComboModal({
  onSave,
  onClose,
  existingCombos: _existingCombos,
}: {
  onSave: (combo: StrategyCombo) => void;
  onClose: () => void;
  existingCombos: StrategyCombo[];
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState("");
  const [search, setSearch] = useState("");

  const filteredIndicators = useMemo(() => {
    if (!search.trim()) return availableIndicators;
    return availableIndicators.filter(
      (ind) =>
        ind.name.toLowerCase().includes(search.toLowerCase()) ||
        ind.category.toLowerCase().includes(search.toLowerCase()),
    );
  }, [search]);

  const toggleIndicator = useCallback((id: string) => {
    setSelectedIndicators((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const tags = useMemo(
    () => tagsInput.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
    [tagsInput],
  );

  const isValid = name.trim() && description.trim() && selectedIndicators.length >= 2;

  const handleSave = () => {
    if (!isValid) return;
    const newCombo: StrategyCombo = {
      id: `user_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      indicators: selectedIndicators,
      author: "我",
      createdAt: new Date().toISOString().split("T")[0],
      likes: 0,
      useCount: 0,
      tags,
      featured: false,
    };
    onSave(newCombo);
  };

  return (
    <motion.div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
        }}
        onClick={onClose}
      />

      <motion.div
        className="glass-card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 560,
          maxHeight: "85vh",
          overflow: "auto",
          padding: 28,
          borderRadius: 18,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-subtle)",
        }}
        initial={{ scale: 0.92, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 30 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            padding: 4,
          }}
        >
          <X size={20} />
        </button>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 20px 0" }}>
          创建指标组合
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
            组合名称
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 我的交易策略"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-primary, var(--bg-secondary))",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
            描述
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简要描述这个组合的用途和适用场景..."
            rows={3}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-primary, var(--bg-secondary))",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
            选择指标 <span style={{ color: "var(--text-tertiary)" }}>(至少2个)</span>
          </label>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-primary, var(--bg-secondary))",
              marginBottom: 10,
            }}
          >
            <Search size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索指标..."
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                color: "var(--text-primary)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              maxHeight: 200,
              overflow: "auto",
              borderRadius: 10,
              border: "1px solid var(--border-subtle)",
            }}
          >
            {filteredIndicators.map((ind) => {
              const selected = selectedIndicators.includes(ind.id);
              return (
                <div
                  key={ind.id}
                  onClick={() => toggleIndicator(ind.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    cursor: "pointer",
                    background: selected ? `${ind.color}12` : "transparent",
                    borderBottom: "1px solid var(--border-subtle)",
                    transition: "background 0.15s",
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: selected ? "none" : "2px solid var(--border-subtle)",
                      background: selected ? ind.color : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 11,
                      flexShrink: 0,
                      transition: "all 0.15s",
                    }}
                  >
                    {selected && "✓"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{ind.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{ind.category}类</div>
                  </div>
                  <div style={{ color: ind.color, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                    {getCategoryIcon(ind.category)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
            标签
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="用逗号分隔，例: 趋势,短线,稳健"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-primary, var(--bg-secondary))",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "hsl(var(--swiss-accent), 0.1)",
                    color: "hsl(var(--swiss-accent))",
                    fontWeight: 500,
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={!isValid}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "none",
            background: isValid
              ? "linear-gradient(135deg, hsl(var(--swiss-accent)), hsl(262, 83%, 58%))"
              : "var(--border-subtle)",
            color: isValid ? "#fff" : "var(--text-tertiary)",
            fontSize: 14,
            fontWeight: 600,
            cursor: isValid ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Save size={16} />
          保存组合
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function StrategyGroupPage() {
  const [combos, setCombos] = useState<StrategyCombo[]>(() => loadCombos());
  const [activeTab, setActiveTab] = useState<"featured" | "mine" | "all">("featured");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCombo, setSelectedCombo] = useState<StrategyCombo | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const myCombos = useMemo(() => combos.filter((c) => c.author === "我"), [combos]);

  const filteredCombos = useMemo(() => {
    let list = combos;
    if (activeTab === "featured") list = combos.filter((c) => c.featured);
    else if (activeTab === "mine") list = myCombos;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)) ||
          c.indicators.some((indId) => {
            const ind = getIndicator(indId);
            return ind && ind.name.toLowerCase().includes(q);
          }),
      );
    }
    return list;
  }, [combos, activeTab, searchQuery, myCombos]);

  const totalUses = useMemo(() => combos.reduce((sum, c) => sum + c.useCount, 0), [combos]);

  const handleSaveCombo = useCallback(
    (newCombo: StrategyCombo) => {
      const updated = [newCombo, ...combos];
      setCombos(updated);
      saveCombos(updated);
      setShowCreateModal(false);
    },
    [combos],
  );

  const handleDeleteCombo = useCallback(
    (id: string) => {
      if (!window.confirm("确定删除此组合？")) return;
      const updated = combos.filter((c) => c.id !== id);
      setCombos(updated);
      saveCombos(updated);
    },
    [combos],
  );

  const handleApplyCombo = useCallback(
    (combo: StrategyCombo) => {
      const updated = combos.map((c) => (c.id === combo.id ? { ...c, useCount: c.useCount + 1 } : c));
      setCombos(updated);
      saveCombos(updated);
      alert(`已应用「${combo.name}」！\n组合包含 ${combo.indicators.length} 个指标。`);
      setSelectedCombo(null);
    },
    [combos],
  );

  const tabs = [
    { key: "featured" as const, label: "推荐组合", icon: <Star size={14} /> },
    { key: "mine" as const, label: "我的组合", icon: <Edit3 size={14} /> },
    { key: "all" as const, label: "全部组合", icon: <Layers size={14} /> },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "linear-gradient(135deg, hsl(var(--swiss-accent)), hsl(262, 83%, 58%))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <Layers size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                指标组合
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
                将多个指标组合使用，提升交易决策质量
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, hsl(var(--swiss-accent)), hsl(262, 83%, 58%))",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus size={16} />
            创建组合
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <div
            style={{
              flex: 1,
              minWidth: 200,
              textAlign: "center",
              padding: "14px 20px",
              borderRadius: 12,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{combos.length}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>组合总数</div>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 200,
              textAlign: "center",
              padding: "14px 20px",
              borderRadius: 12,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
              {totalUses.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>累计使用</div>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 200,
              textAlign: "center",
              padding: "14px 20px",
              borderRadius: 12,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
              {availableIndicators.length}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>可选指标</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-secondary)",
            marginBottom: 16,
          }}
        >
          <Search size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索组合名称、描述、标签或指标..."
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-tertiary)",
                cursor: "pointer",
                padding: 2,
                display: "flex",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 24,
            padding: 4,
            borderRadius: 12,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 9,
                border: "none",
                background: activeTab === tab.key ? "var(--bg-primary, #1e1e2e)" : "transparent",
                color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-tertiary)",
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {filteredCombos.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "var(--text-tertiary)",
            }}
          >
            <Layers size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ fontSize: 14, margin: 0 }}>
              {searchQuery ? "没有找到匹配的组合" : "暂无组合，点击上方按钮创建"}
            </p>
          </div>
        ) : (
          <motion.div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16,
            }}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06 } },
            }}
          >
            {filteredCombos.map((combo) => (
              <motion.div
                key={combo.id}
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.35 }}
              >
                <ComboCard
                  combo={combo}
                  onClick={() => setSelectedCombo(combo)}
                  onDelete={
                    combo.author === "我"
                      ? () => handleDeleteCombo(combo.id)
                      : undefined
                  }
                  isOwn={combo.author === "我"}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedCombo && (
          <ComboDetailModal
            combo={selectedCombo}
            onClose={() => setSelectedCombo(null)}
            onApply={() => handleApplyCombo(selectedCombo)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateModal && (
          <CreateComboModal
            onSave={handleSaveCombo}
            onClose={() => setShowCreateModal(false)}
            existingCombos={combos}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
