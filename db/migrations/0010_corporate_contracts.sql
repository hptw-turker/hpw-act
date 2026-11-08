-- HPW Act — 0010: ana aksiyon ufku (P0-269-05), kohort kuralı kaydı
ALTER TABLE cm_master_action ADD COLUMN IF NOT EXISTS horizon_days int NOT NULL DEFAULT 180 CHECK (horizon_days BETWEEN 7 AND 730);
