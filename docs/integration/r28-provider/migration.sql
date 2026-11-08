-- DFL Site R28. Isolated from finance tables. Stores ZERO tokens, links, numbers or order IDs.
CREATE TABLE IF NOT EXISTS public.dfl_tracking_provider_attempts_v1 (
  order_key_hmac text PRIMARY KEY CHECK (order_key_hmac ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK (state IN ('reserved','accepted_by_provider','delivery_uncertain','rejected_by_provider')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dfl_tracking_provider_attempts_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dfl_tracking_provider_attempts_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.dfl_tracking_provider_attempts_v1 TO service_role;
COMMENT ON TABLE public.dfl_tracking_provider_attempts_v1 IS
  'DFL tracking P9: one-way HMAC order reservation and provider outcome. No recipient, URL, token, message, or financial data.';
