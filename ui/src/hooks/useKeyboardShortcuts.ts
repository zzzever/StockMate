import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';

/** 全局快捷键配置 */
interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

/**
 * 全局快捷键 Hook
 * 支持：
 * - Esc: 返回上一页
 * - Ctrl+K / /: 打开搜索
 * - Ctrl+D: 添加到自选
 * - Ctrl+R: 刷新当前页面
 * - F11: 全屏切换
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { selectedStock } = useAppStore();

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    // 忽略输入框内的快捷键
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // 只允许 Esc 在输入框内生效
      if (e.key !== 'Escape') return;
    }

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;

    // Esc: 返回上一页
    if (e.key === 'Escape') {
      e.preventDefault();
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // 如果在输入框内，先失焦
        (target as HTMLElement).blur();
      } else {
        navigate(-1);
      }
      return;
    }

    // Ctrl+K 或 /: 打开搜索
    if ((ctrl && e.key === 'k') || (!ctrl && !shift && !alt && e.key === '/')) {
      e.preventDefault();
      navigate('/search');
      return;
    }

    // Ctrl+D: 添加到自选（需要在股票详情页）
    if (ctrl && e.key === 'd') {
      e.preventDefault();
      // 触发自选按钮点击
      const starButton = document.querySelector('[aria-label="加入自选"], [aria-label="取消自选"]') as HTMLElement;
      if (starButton) {
        starButton.click();
      }
      return;
    }

    // Ctrl+R: 刷新
    if (ctrl && e.key === 'r') {
      e.preventDefault();
      window.location.reload();
      return;
    }

    // F11: 全屏切换
    if (e.key === 'F11') {
      e.preventDefault();
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
      return;
    }

    // Ctrl+,: 打开设置
    if (ctrl && e.key === ',') {
      e.preventDefault();
      navigate('/settings');
      return;
    }

    // Ctrl+1-9: 快速切换到指定页面
    if (ctrl && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const pages = ['/watchlist', '/search', '/sectors', '/screener', '/backtest', '/rules', '/settings'];
      const index = parseInt(e.key) - 1;
      if (index < pages.length) {
        navigate(pages[index]);
      }
      return;
    }
  }, [navigate, selectedStock]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [handleKeydown]);
}

/** 快捷键帮助信息 */
export const SHORTCUT_HELP = [
  { key: 'Esc', description: '返回上一页 / 退出输入框' },
  { key: 'Ctrl+K 或 /', description: '打开搜索' },
  { key: 'Ctrl+D', description: '添加/取消自选' },
  { key: 'Ctrl+R', description: '刷新页面' },
  { key: 'F11', description: '全屏切换' },
  { key: 'Ctrl+,', description: '打开设置' },
  { key: 'Ctrl+1-7', description: '快速切换页面' },
];
