import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

const DISCLAIMER_KEY = 'stockmate_hasAgreedDisclaimer';

export function DisclaimerModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const agreed = localStorage.getItem(DISCLAIMER_KEY);
      if (!agreed) {
        setShow(true);
      }
    } catch {
      // localStorage not available in some environments
    }
  }, []);

  const handleAgree = () => {
    try {
      localStorage.setItem(DISCLAIMER_KEY, 'true');
    } catch {
      // ignore
    }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-card max-w-lg w-full mx-4 p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={20} />
              <h2 className="text-lg font-bold">免责声明</h2>
            </div>

            <div className="text-sm text-slate-700 dark:text-zinc-300 space-y-2 max-h-60 overflow-y-auto">
              <p>欢迎使用 StockMate！在使用本软件前，请仔细阅读以下条款：</p>
              <p><strong>1. 投资有风险：</strong>本软件提供的所有分析、策略、预测仅供参考，不构成任何投资建议。股市有风险，投资需谨慎。</p>
              <p><strong>2. 数据准确性：</strong>软件数据来源于第三方公开接口，我们不保证数据的实时性、准确性和完整性。</p>
              <p><strong>3. 盈亏自负：</strong>任何基于本软件信息做出的投资决策，其盈亏由用户自行承担。</p>
              <p><strong>4. 隐私政策：</strong>本软件仅在本地处理数据，不会上传您的个人隐私信息至外部服务器。</p>
              <p><strong>5. 软件性质：</strong>本软件为技术分析工具，不提供证券交易服务，不具备投资咨询资质。</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleAgree}
                className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 text-sm font-medium transition-colors"
              >
                我已阅读并同意
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DismissibleAlert({ message, icon }: { message: string; icon?: React.ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
      {icon ?? <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />}
      <div className="flex-1 text-xs text-amber-200/80">{message}</div>
      <button onClick={() => setDismissed(true)} className="text-amber-400/60 hover:text-amber-400 shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

export function StrategyDisclaimer() {
  return <DismissibleAlert message="策略信号仅供参考，不构成投资建议。请结合自身风险承受能力谨慎决策。" />;
}

export function PredictDisclaimer() {
  return <DismissibleAlert message="走势预测基于历史数据模型，结果具有不确定性，不构成投资建议。" />;
}
