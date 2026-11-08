-- HPW Act — 0012: ölçek performansı (400 şube hedef önizlemesi 1,5 sn → ölçüm)
CREATE INDEX IF NOT EXISTS ix_result_batch_metric_unit ON result (tenant_id, import_batch_id, metric_code, unit_id);
CREATE INDEX IF NOT EXISTS ix_result_batch_unit ON result (tenant_id, import_batch_id, unit_id);
CREATE INDEX IF NOT EXISTS ix_org_rel_to_type ON org_relationship (tenant_id, to_unit_id, relationship_type);
CREATE INDEX IF NOT EXISTS ix_org_rel_from_type ON org_relationship (tenant_id, from_unit_id, relationship_type);
ANALYZE result; ANALYZE org_relationship;
