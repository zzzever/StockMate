import { useState, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  MessageSquare,
  Heart,
  Share2,
  TrendingUp,
  Clock,
  Plus,
  X,
  Send,
  Zap,
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Creator = {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  indicatorCount: number;
  followerCount: number;
  followingCount: number;
  joinDate: string;
  tags: string[];
  featured?: boolean;
};

type PostType = 'indicator_share' | 'strategy_discussion' | 'market_comment' | 'question' | 'tutorial';

type Post = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  type: PostType;
  title: string;
  content: string;
  tags: string[];
  likes: number;
  commentCount: number;
  createdAt: string;
};

type Comment = {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  likes: number;
};

const POST_TYPE_CONFIG: Record<PostType, { label: string; icon: typeof TrendingUp; color: string }> = {
  indicator_share: { label: '指标分享', icon: Zap, color: '#22c55e' },
  strategy_discussion: { label: '策略讨论', icon: MessageSquare, color: '#3b82f6' },
  market_comment: { label: '行情评论', icon: TrendingUp, color: '#f59e0b' },
  question: { label: '提问', icon: BookOpen, color: '#a855f7' },
  tutorial: { label: '教程', icon: BookOpen, color: '#06b6d4' },
};

const MOCK_CREATORS: Creator[] = [
  { id: 'c1', name: 'QuantLab', avatar: 'Q', bio: '专注量化策略研发，5年实盘经验', indicatorCount: 23, followerCount: 1580, followingCount: 45, joinDate: '2024-01-15', tags: ['量化', 'CTA', '多因子'], featured: true },
  { id: 'c2', name: 'SignalPro', avatar: 'S', bio: '技术指标专家，擅长趋势跟踪系统', indicatorCount: 18, followerCount: 920, followingCount: 32, joinDate: '2024-03-22', tags: ['技术分析', '趋势'] },
  { id: 'c3', name: 'DataFlow', avatar: 'D', bio: '数据驱动交易，Python量化爱好者', indicatorCount: 12, followerCount: 670, followingCount: 58, joinDate: '2024-05-10', tags: ['Python', '数据分析'] },
  { id: 'c4', name: 'TechTrade', avatar: 'T', bio: '融合技术面与基本面的综合策略', indicatorCount: 15, followerCount: 1120, followingCount: 29, joinDate: '2024-02-08', tags: ['综合策略', '价值投资'] },
  { id: 'c5', name: 'TradeMaster', avatar: 'M', bio: '高频交易研究者，专注微观结构', indicatorCount: 31, followerCount: 2340, followingCount: 17, joinDate: '2023-11-20', tags: ['高频', '微观结构', '做市'], featured: true },
  { id: 'c6', name: '量化小白', avatar: '白', bio: '刚开始学习量化交易，记录成长历程', indicatorCount: 3, followerCount: 85, followingCount: 120, joinDate: '2025-06-01', tags: ['新手', '学习笔记'] },
];

const MOCK_POSTS: Post[] = [
  { id: 'p1', authorId: 'c1', authorName: 'QuantLab', authorAvatar: 'Q', type: 'indicator_share', title: '新版ATR自适应通道指标分享', content: '经过3个月的回测和实盘验证，这个自适应ATR通道指标在震荡行情中表现优异。核心改进：使用Keltner通道替代固定ATR，结合波动率聚类算法动态调整参数。', tags: ['ATR', '通道指标', '自适应'], likes: 89, commentCount: 12, createdAt: '2026-08-30T14:30:00Z' },
  { id: 'p2', authorId: 'c5', authorName: 'TradeMaster', authorAvatar: 'M', type: 'strategy_discussion', title: '关于量化策略中的过拟合问题讨论', content: '最近在复盘自己的策略库，发现很多过去表现优异的策略在近半年都失效了。大家怎么看策略过拟合？我目前的做法是使用walk-forward analysis，但还是觉得不够。', tags: ['过拟合', '回测', '稳健性'], likes: 56, commentCount: 8, createdAt: '2026-08-29T10:15:00Z' },
  { id: 'p3', authorId: 'c2', authorName: 'SignalPro', authorAvatar: 'S', type: 'market_comment', title: '本周市场观察：大盘缩量后的技术面分析', content: '本周沪深两市持续缩量，从技术形态来看，上证指数在3200点附近形成了一个小型的头肩底形态。MACD日线金叉已确认，但量能配合度不足，需要关注下周能否放量突破。', tags: ['大盘', '技术分析', 'MACD'], likes: 34, commentCount: 5, createdAt: '2026-08-28T16:45:00Z' },
  { id: 'p4', authorId: 'c6', authorName: '量化小白', authorAvatar: '白', type: 'question', title: '新手求助：如何正确理解夏普比率？', content: '大家好，我在看策略回测报告时经常看到夏普比率这个指标，但不太理解它的实际意义。请问夏普比率多少算好？它有什么局限性吗？', tags: ['夏普比率', '新手', '风险指标'], likes: 15, commentCount: 7, createdAt: '2026-08-27T09:20:00Z' },
  { id: 'p5', authorId: 'c3', authorName: 'DataFlow', authorAvatar: 'D', type: 'tutorial', title: 'Python实现：自定义布林带策略回测框架', content: '今天分享一个我用Python实现的简易回测框架，专门用于布林带策略的测试。代码结构清晰，支持多品种回测，自带可视化报告生成。适合想学习量化但不知道从哪里开始的朋友。', tags: ['Python', '布林带', '教程', '回测'], likes: 102, commentCount: 15, createdAt: '2026-08-26T11:00:00Z' },
  { id: 'p6', authorId: 'c4', authorName: 'TechTrade', authorAvatar: 'T', type: 'indicator_share', title: '成交量加权RSI指标优化版', content: '传统RSI在极端行情中容易钝化，加入成交量加权后可以有效改善信号质量。这个版本还加入了多时间框架确认机制，信号可靠性显著提升。', tags: ['RSI', '成交量', '多周期'], likes: 67, commentCount: 9, createdAt: '2026-08-25T13:30:00Z' },
];

const MOCK_COMMENTS: Comment[] = [
  { id: 'cm1', postId: 'p1', authorId: 'c5', authorName: 'TradeMaster', content: '这个改进思路不错，我在实盘中也遇到过固定ATR通道的问题。请问参数优化用的是什么方法？', createdAt: '2026-08-30T15:00:00Z', likes: 3 },
  { id: 'cm2', postId: 'p1', authorId: 'c2', authorName: 'SignalPro', content: '建议加上成交量确认，缩量突破假信号太多了。', createdAt: '2026-08-30T15:30:00Z', likes: 5 },
  { id: 'cm3', postId: 'p4', authorId: 'c1', authorName: 'QuantLab', content: '夏普比率>1算及格，>2算优秀，>3要警惕过拟合。局限性主要是假设收益正态分布，实际市场存在肥尾。', createdAt: '2026-08-27T10:15:00Z', likes: 12 },
  { id: 'cm4', postId: 'p5', authorId: 'c4', authorName: 'TechTrade', content: '框架代码能开源吗？想学习一下回测逻辑的实现方式。', createdAt: '2026-08-26T14:20:00Z', likes: 4 },
  { id: 'cm5', postId: 'p2', authorId: 'c3', authorName: 'DataFlow', content: '建议使用蒙特卡洛模拟来检测策略稳健性，比walk-forward更全面。', createdAt: '2026-08-29T11:45:00Z', likes: 7 },
];

function loadJSON<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}个月前`;
  const years = Math.floor(months / 12);
  return `${years}年前`;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function CreatorCard({
  creator,
  isFollowed,
  onToggleFollow,
}: {
  creator: Creator;
  isFollowed: boolean;
  onToggleFollow: (id: string) => void;
}) {
  return (
    <motion.div
      className="glass-card"
      style={{ padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'hsl(var(--swiss-accent))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {creator.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{creator.name}</span>
            {creator.featured && (
              <span style={{ fontSize: 10, background: 'hsl(var(--swiss-accent))', color: '#fff', padding: '1px 6px', borderRadius: 8 }}>推荐</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{creator.bio}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{creator.indicatorCount}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>指标</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{creator.followerCount.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>粉丝</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{creator.followingCount}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>关注</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {creator.tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 8,
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <button
        onClick={() => onToggleFollow(creator.id)}
        style={{
          width: '100%',
          padding: '8px 0',
          borderRadius: 8,
          border: isFollowed ? '1px solid var(--border-subtle)' : '1px solid hsl(var(--swiss-accent))',
          background: isFollowed ? 'var(--bg-secondary)' : 'hsl(var(--swiss-accent))',
          color: isFollowed ? 'var(--text-secondary)' : '#fff',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          transition: 'all 0.2s',
        }}
      >
        {isFollowed ? <UserCheck size={14} /> : <UserPlus size={14} />}
        {isFollowed ? '已关注' : '关注'}
      </button>
    </motion.div>
  );
}

function PostCard({
  post,
  isLiked,
  onToggleLike,
  onOpenComments,
}: {
  post: Post;
  isLiked: boolean;
  onToggleLike: (id: string) => void;
  onOpenComments: (postId: string) => void;
}) {
  const config = POST_TYPE_CONFIG[post.type];
  const Icon = config.icon;

  return (
    <motion.div
      className="glass-card"
      style={{ padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'hsl(var(--swiss-accent))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {post.authorAvatar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{post.authorName}</span>
            <span
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 6,
                background: `${config.color}20`,
                color: config.color,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <Icon size={10} />
              {config.label}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} />
            {timeAgo(post.createdAt)}
          </div>
        </div>
      </div>

      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{post.title}</h3>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {post.content.length > 120 ? post.content.slice(0, 120) + '...' : post.content}
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {post.tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 8,
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            #{tag}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
        <button
          onClick={() => onToggleLike(post.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            color: isLiked ? '#ef4444' : 'var(--text-tertiary)',
            fontSize: 12,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Heart size={14} fill={isLiked ? '#ef4444' : 'none'} />
          {post.likes}
        </button>
        <button
          onClick={() => onOpenComments(post.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            fontSize: 12,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <MessageSquare size={14} />
          {post.commentCount}
        </button>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            fontSize: 12,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Share2 size={14} />
          分享
        </button>
      </div>
    </motion.div>
  );
}

function CommentSection({
  comments,
  postId,
  onAddComment,
  onClose,
}: {
  comments: Comment[];
  postId: string;
  onAddComment: (postId: string, content: string) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onAddComment(postId, trimmed);
    setInput('');
  }, [input, postId, onAddComment]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '60vh',
        background: 'var(--bg-secondary)',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>评论 ({comments.length})</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12, maxHeight: '40vh' }}>
        {comments.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 20 }}>
            暂无评论，来发表第一条评论吧
          </div>
        )}
        {comments.map((c) => (
          <div key={c.id} style={{ display: 'flex', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {c.authorName[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.authorName}</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{timeAgo(c.createdAt)}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="写下你的评论..."
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: input.trim() ? 'hsl(var(--swiss-accent))' : 'var(--border-subtle)',
            color: input.trim() ? '#fff' : 'var(--text-tertiary)',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </motion.div>
  );
}

function NewPostModal({ onClose, onPublish }: { onClose: () => void; onPublish: (post: Omit<Post, 'id' | 'likes' | 'commentCount' | 'createdAt'>) => void }) {
  const [type, setType] = useState<PostType>('indicator_share');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const handlePublish = useCallback(() => {
    if (!title.trim() || !content.trim()) return;
    const tags = tagsInput
      .split(/[,，、\s]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter(Boolean);
    onPublish({
      authorId: 'c1',
      authorName: 'QuantLab',
      authorAvatar: 'Q',
      type,
      title: title.trim(),
      content: content.trim(),
      tags,
    });
  }, [type, title, content, tagsInput, onPublish]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
        padding: 16,
      }}
    >
      <motion.div
        className="glass-card"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '80vh',
          overflowY: 'auto',
          padding: 24,
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>发布动态</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>动态类型</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.keys(POST_TYPE_CONFIG) as PostType[]).map((t) => {
              const cfg = POST_TYPE_CONFIG[t];
              const Icon = cfg.icon;
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `1px solid ${type === t ? cfg.color : 'var(--border-subtle)'}`,
                    background: type === t ? `${cfg.color}15` : 'var(--bg-secondary)',
                    color: type === t ? cfg.color : 'var(--text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontWeight: type === t ? 600 : 400,
                  }}
                >
                  <Icon size={12} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>标题</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入标题..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="分享你的观点、策略或问题..."
            rows={5}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
              lineHeight: 1.6,
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>标签（用逗号分隔）</label>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="例如: ATR, 趋势跟踪, 量化"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          onClick={handlePublish}
          disabled={!title.trim() || !content.trim()}
          style={{
            padding: '10px 0',
            borderRadius: 8,
            border: 'none',
            background: title.trim() && content.trim() ? 'hsl(var(--swiss-accent))' : 'var(--border-subtle)',
            color: title.trim() && content.trim() ? '#fff' : 'var(--text-tertiary)',
            fontSize: 14,
            fontWeight: 600,
            cursor: title.trim() && content.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          发布
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<'feed' | 'creators' | 'trending'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<PostType | 'all'>('all');
  const [showNewPost, setShowNewPost] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>(() => loadJSON('stockmate_community_posts', MOCK_POSTS));
  const [comments, setComments] = useState<Comment[]>(() => loadJSON('stockmate_community_comments', MOCK_COMMENTS));
  const [follows, setFollows] = useState<Record<string, boolean>>(() => loadJSON('stockmate_community_follows', {}));
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>(() => loadJSON('stockmate_community_likes', {}));

  const persist = useCallback(<T,>(key: string, value: T) => saveJSON(key, value), []);

  const handleToggleFollow = useCallback(
    (id: string) => {
      setFollows((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        persist('stockmate_community_follows', next);
        return next;
      });
    },
    [persist],
  );

  const handleToggleLike = useCallback(
    (postId: string) => {
      setLikedPosts((prev) => {
        const next = { ...prev, [postId]: !prev[postId] };
        persist('stockmate_community_likes', next);
        return next;
      });
      setPosts((prev) => {
        const next = prev.map((p) =>
          p.id === postId ? { ...p, likes: p.likes + (likedPosts[postId] ? -1 : 1) } : p,
        );
        persist('stockmate_community_posts', next);
        return next;
      });
    },
    [likedPosts, persist],
  );

  const handleAddComment = useCallback(
    (postId: string, content: string) => {
      const newComment: Comment = {
        id: generateId(),
        postId,
        authorId: 'c1',
        authorName: 'QuantLab',
        content,
        createdAt: new Date().toISOString(),
        likes: 0,
      };
      setComments((prev) => {
        const next = [...prev, newComment];
        persist('stockmate_community_comments', next);
        return next;
      });
      setPosts((prev) => {
        const next = prev.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
        persist('stockmate_community_posts', next);
        return next;
      });
    },
    [persist],
  );

  const handlePublishPost = useCallback(
    (data: Omit<Post, 'id' | 'likes' | 'commentCount' | 'createdAt'>) => {
      const newPost: Post = {
        ...data,
        id: generateId(),
        likes: 0,
        commentCount: 0,
        createdAt: new Date().toISOString(),
      };
      setPosts((prev) => {
        const next = [newPost, ...prev];
        persist('stockmate_community_posts', next);
        return next;
      });
      setShowNewPost(false);
    },
    [persist],
  );

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (typeFilter !== 'all') {
      result = result.filter((p) => p.type === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [posts, typeFilter, searchQuery]);

  const filteredCreators = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_CREATORS;
    const q = searchQuery.toLowerCase();
    return MOCK_CREATORS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.bio.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  const topCreators = useMemo(() => [...MOCK_CREATORS].sort((a, b) => b.followerCount - a.followerCount).slice(0, 5), []);

  const topTags = useMemo(() => {
    const tagMap: Record<string, number> = {};
    posts.forEach((p) => p.tags.forEach((t) => (tagMap[t] = (tagMap[t] || 0) + 1)));
    return Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [posts]);

  const commentPostComments = useMemo(
    () => (commentPostId ? comments.filter((c) => c.postId === commentPostId) : []),
    [comments, commentPostId],
  );

  const tabs = [
    { key: 'feed' as const, label: '动态', icon: MessageSquare },
    { key: 'creators' as const, label: '创作者', icon: Users },
    { key: 'trending' as const, label: '热门', icon: TrendingUp },
  ];

  const postTypeFilters: { key: PostType | 'all'; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'indicator_share', label: '指标分享' },
    { key: 'strategy_discussion', label: '策略讨论' },
    { key: 'market_comment', label: '行情评论' },
    { key: 'question', label: '提问' },
    { key: 'tutorial', label: '教程' },
  ];

  return (
    <div style={{ minHeight: '100vh', padding: 16, maxWidth: 800, margin: '0 auto' }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>社区</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>与量化交易者交流，发现优质指标</p>
      </header>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 0 }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: '10px 0',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid hsl(var(--swiss-accent))' : '2px solid transparent',
                color: isActive ? 'hsl(var(--swiss-accent))' : 'var(--text-tertiary)',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索动态、创作者、标签..."
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {activeTab === 'feed' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {postTypeFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: `1px solid ${typeFilter === f.key ? 'hsl(var(--swiss-accent))' : 'var(--border-subtle)'}`,
                  background: typeFilter === f.key ? 'hsl(var(--swiss-accent))' : 'var(--bg-secondary)',
                  color: typeFilter === f.key ? '#fff' : 'var(--text-secondary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: typeFilter === f.key ? 600 : 400,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AnimatePresence>
              {filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isLiked={!!likedPosts[post.id]}
                  onToggleLike={handleToggleLike}
                  onOpenComments={setCommentPostId}
                />
              ))}
            </AnimatePresence>
            {filteredPosts.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40, fontSize: 14 }}>
                暂无匹配的动态
              </div>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNewPost(true)}
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'hsl(var(--swiss-accent))',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 16px hsl(var(--swiss-accent) / 0.4)',
              zIndex: 100,
            }}
          >
            <Plus size={24} />
          </motion.button>
        </>
      )}

      {activeTab === 'creators' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {filteredCreators.map((creator) => (
            <CreatorCard
              key={creator.id}
              creator={creator}
              isFollowed={!!follows[creator.id]}
              onToggleFollow={handleToggleFollow}
            />
          ))}
          {filteredCreators.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-tertiary)', padding: 40, fontSize: 14 }}>
              暂无匹配的创作者
            </div>
          )}
        </div>
      )}

      {activeTab === 'trending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={18} />
              热门创作者
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topCreators.map((creator, idx) => (
                <div
                  key={creator.id}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 10,
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7c2f' : 'var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: idx < 3 ? '#fff' : 'var(--text-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'hsl(var(--swiss-accent))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    {creator.avatar}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{creator.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{creator.bio}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{creator.followerCount.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>粉丝</div>
                  </div>
                  <button
                    onClick={() => handleToggleFollow(creator.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      border: follows[creator.id] ? '1px solid var(--border-subtle)' : '1px solid hsl(var(--swiss-accent))',
                      background: follows[creator.id] ? 'var(--bg-secondary)' : 'hsl(var(--swiss-accent))',
                      color: follows[creator.id] ? 'var(--text-secondary)' : '#fff',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {follows[creator.id] ? '已关注' : '关注'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={18} />
              热门标签
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {topTags.map(([tag, count]) => (
                <div
                  key={tag}
                  className="glass-card"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    border: '1px solid var(--border-subtle)',
                  }}
                  onClick={() => {
                    setActiveTab('feed');
                    setSearchQuery(tag);
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>#{tag}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: 8 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showNewPost && <NewPostModal onClose={() => setShowNewPost(false)} onPublish={handlePublishPost} />}
      </AnimatePresence>

      <AnimatePresence>
        {commentPostId && (
          <CommentSection
            postId={commentPostId}
            comments={commentPostComments}
            onAddComment={handleAddComment}
            onClose={() => setCommentPostId(null)}
          />
        )}
      </AnimatePresence>

      {commentPostId && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }} onClick={() => setCommentPostId(null)} />}
    </div>
  );
}
