-- Financial donations are intentionally disabled for the current release.
-- Keep food donations, timed expiry, claims, chat, and live tracking unchanged.
-- Re-enable these RPC grants only after a real payment provider, signed webhooks,
-- legal approvals, and reconciliation flows are ready.

REVOKE ALL ON FUNCTION public.create_meal_donation_intent(uuid, integer, text, text, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_meal_donation_intent(uuid, integer, text, text, uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_meal_donation_intent(uuid, integer, text, text, uuid, uuid, text) FROM authenticated;

REVOKE ALL ON FUNCTION public.create_general_donation_intent(numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_general_donation_intent(numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_general_donation_intent(numeric, text, text) FROM authenticated;
