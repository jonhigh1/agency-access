-- Rename the top subscription tier to align with marketing terminology
-- Migration: AGENCY → SCALE (follows 20260314_rename_subscription_tiers)

UPDATE "subscriptions"
SET "tier" = 'SCALE'
WHERE "tier" = 'AGENCY';

UPDATE "agencies"
SET "subscription_tier" = 'SCALE'
WHERE "subscription_tier" = 'AGENCY';
