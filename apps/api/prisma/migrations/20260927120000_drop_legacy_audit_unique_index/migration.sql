-- Remove the legacy unique index that blocks repeated audit events.
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_resource_id_key;

DROP INDEX IF EXISTS public.audit_logs_action_resource_id_key;

CREATE INDEX IF NOT EXISTS audit_logs_action_resource_id_idx
  ON public.audit_logs(action, resource_id);
