-- 0010_add_model_to_prediction_history.sql: 区分 AI 预测来源模型 (deepseek / kronos)
-- 历史数据自动标记为 deepseek；Kronos 保存时显式写入 model='kronos'
ALTER TABLE prediction_history ADD COLUMN model TEXT NOT NULL DEFAULT 'deepseek';
