import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    console.log('[ErrorBoundary] error caught', { message: error.message, stack: error.stack });
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="glass-card p-8 max-w-md text-center space-y-4">
            <AlertTriangle size={48} className="mx-auto text-amber-500" />
            <h2 className="text-lg font-semibold text-black dark:text-white">应用发生错误</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {this.state.error?.message || '未知错误'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.hash = '#/sectors'; }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700 transition-colors"
            >
              <RefreshCw size={14} />
              返回首页
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
