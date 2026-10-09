# Glossary

Domain vocabulary for the Agency Access Platform. Add a term when a name settles in code or review; keep definitions to what the term means, not how it is implemented. Architecture vocabulary (module, interface, depth, seam, adapter, leverage, locality) is defined in the codebase-design skill and is not duplicated here.

Created 2026-10-08 during the platform-registry architecture review.

## Platform identity

**Platform** — a thing a client or agency authorizes. One id space, three kinds: group, product, legacy.

**Group-level platform** — one OAuth connection that covers several products. Members today: `google`, `meta`, `linkedin`, `tiktok`, `snapchat`. Agency connections bind at group level.

**Product-level platform** — an individually authorizable product under a group, with a parent reference. Examples: `google_ads`, `ga4`, `meta_ads`, `meta_pages`, `linkedin_ads`.

**Legacy platform id** — an id that still arrives in stored `platforms[]` rows but is no longer a selectable platform. The accepted set is `LEGACY_PAYLOAD_IDS` (7 members: `whatsapp_business`, `google_tag_manager`, `google_merchant_center`, `google_search_console`, `youtube_studio`, `google_business_profile`, `display_video_360`). Four of the seven are demoted hierarchy products and carry a parent reference.

## Authorization

**Connection method** — the client-facing authorization flow for a platform: `oauth`, `manual`, or `api_key`. Documents what the client is asked to do.

**OAuth config block** — the agency-side transport facts for a platform (endpoints, scopes, flags, credential env-var names). Independent of the connection method: `shopify` is client-manual and agency-OAuth (with per-request `{shop}` context) in one entry.

**clientAuthorizable** — per-entry flag: the client OAuth step is available for this platform in an access request. Reproduces the client OAuth gate's 10 members. It does not mean "client-connectable": manual-invite platforms are client-connectable through the manual flow without this flag.

**Manual-invite platform** — a platform authorized outside OAuth (Kit, Klaviyo, Mailchimp, Pinterest, Shopify, Zapier) or by API key (Beehiiv). The set derives from `connectionMethod !== 'oauth'`.

**Email-invite quartet** — the four manual platforms invited by email rather than in-product steps: `beehiiv`, `kit`, `klaviyo`, `mailchimp`. One web-side constant; the selector modal and the invite page share it. (Semantics under product question PQ-selector-4.)

## Fulfillment

**Asset-selecting products** — the 13 products whose authorization collects selected assets (ad accounts, pages, datasets) rather than a bare grant.

**grantedAssets** — the per-request record of what a client actually authorized, stored as a JSON document with concurrent writers; verified grants are sticky.

## Open product questions

**PQ-other-14** — why the picker's "other" category holds exactly 14 platforms and omits `tiktok_ads`, `linkedin_ads`, `snapchat_ads`. Pinned as-is under characterization; a linked product decision must resolve it.

**PQ-selector-4** — whether the email quartet's real meaning is "email-invitable" or "shows the manual-invite modal."
