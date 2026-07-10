import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; detailsOpen: boolean; copied: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, detailsOpen: false, copied: false };

  static getDerivedStateFromError(error: Error): State {
    console.log('[ErrorBoundary] error caught', { message: error.message, stack: error.stack });
    return { hasError: true, error, detailsOpen: false, copied: false };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, detailsOpen: false, copied: false });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, detailsOpen: false, copied: false });
    window.location.hash = '#/watchlist';
  };

  handleCopyError = async () => {
    if (!this.state.error) return;
    const text = `Error: ${this.state.error.message}\n\nStack:\n${this.state.error.stack || '(no stack)'}`;
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Fallback for environments where clipboard API is unavailable
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); this.setState({ copied: true }); setTimeout(() => this.setState({ copied: false }), 2000); } catch (e) { console.warn('[ErrorBoundary] copy failed:', e); }
      document.body.removeChild(ta);
    }
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      const err = this.state.error;

      return (
        <div className="min-h-screen flex items-center justify-center p-8" role="alert">
          <div className="glass-card p-8 max-w-lg w-full text-center space-y-5">
            {/* Icon */}
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'hsl(var(--price-up-bg) / 0.15)' }}>
              <AlertTriangle size={32} className="text-amber-500" />
            </div>

            {/* Title */}
            <div>
              <h2 className="text-lg font-semibold text-black dark:text-white mb-1">应用发生错误</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                {err?.message || '未知错误'}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
              >
                <RefreshCw size={14} />
                重试
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-default))' }}
              >
                <Home size={14} />
                返回首页
              </button>
              <button
                onClick={this.handleCopyError}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-default))' }}
              >
                {this.state.copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                {this.state.copied ? '已复制' : '复制错误'}
              </button>
            </div>

            {/* Error details collapse */}
            {err && (
              <div className="space-y-2">
                <button
                  onClick={() => this.setState({ detailsOpen: !this.state.detailsOpen })}
                  className="inline-flex items-center gap-1 text-xs font-medium transition-colors"
                  style={{ color: 'hsl(var(--text-tertiary))' }}
                >
                  {this.state.detailsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  错误详情
                </button>
                {this.state.detailsOpen && (
                  <div className="text-left">
                    <pre
                      className="text-[11px] font-mono leading-relaxed p-3 rounded-lg overflow-auto max-h-48"
                      style={{
                        background: 'hsl(var(--bg-root))',
                        color: 'hsl(var(--text-secondary))',
                        border: '1px solid hsl(var(--border-subtle))',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {err.message}
                      {'\n\n'}
                      {isDev && err.stack ? err.stack : isDev ? '(no stack)' : '生产环境已隐藏堆栈信息'}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
