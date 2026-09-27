# Concepts

> Shared domain vocabulary for this repository. Entries define concepts, not implementation details.

## Client access

### Access Request
A time-limited request from an agency for a client to grant specific platform and product access.

An Access Request remains incomplete until every requested product is actually fulfilled; OAuth return by itself is not completion.

### Platform Group
The vendor boundary that groups related requested products, such as the advertising and page products offered by one platform.

The client-facing request flow advances one incomplete Platform Group at a time so the active decision stays singular.

### Requested Product
A specific access capability or asset family inside a Platform Group.

Products in the same Platform Group can have different scopes, discovery surfaces, and fulfillment outcomes.

### OAuth State
A short-lived, single-use marker that binds an authorization callback to a specific authorization request.

In production, OAuth State requires durable storage. If that storage is unavailable, the authorization flow fails instead of issuing a reusable state marker.

### Authorization Progress
The observed fulfillment state of requested platforms and products, separate from whether an OAuth redirect merely returned.

It distinguishes completed work, the current action, remaining work, and unresolved follow-up.

### Active Platform
The one incomplete Platform Group the client should act on now.

If a returning OAuth platform is still incomplete, it becomes the Active Platform; otherwise the first incomplete Platform Group does. When nothing remains incomplete, there is no Active Platform.

### Full Request
The compact, complete view of every requested Platform Group and its truthful state.

It preserves context for the client without turning every item into an equal action.

### Asset-Selecting Product
A Requested Product whose fulfillment requires the client to select specific assets (ad accounts, pages, properties) after OAuth.

Non-selecting products are fulfilled by an active authorization on their Platform Group. The distinction lives in the fulfillment evaluator, not the UI.

### Owner Business
The one Meta business that owns the assets a client was asked to share, when exactly one such business exists.

An Owner Business is selected automatically and confirmed with a receipt, not a chooser. When zero or several businesses qualify, there is no Owner Business and the client answers one plain-language question instead.

### Truthful Status
A status presentation that names actual fulfillment and the next action rather than raw protocol success, an internal enum, or color alone.

It combines a recognizable icon, a plain-language word, and the design-system ink token for its meaning.

## Design system

### Acid Brutalism v2
The production design system, defined in `apps/web/DESIGN_SYSTEM.md`. Ink on paper, binary radius (square or circle), one coral accent, JetBrains Mono micro-labels, and shadows only as interaction punctuation.

### Ink Token
The AA-safe text form of a status color. Raw coral and raw teal are fills and borders only; status text uses `--success-ink` or `--danger-ink`.

### Rounded World
The superseded aesthetic documented in the root `DESIGN.md` (rounded corners, soft shadows, multiple accents). Not the production contract; `apps/web/DESIGN_SYSTEM.md` wins when the two disagree.

## Deploy operations

### Deploy Incident
One failing production deployment, keyed by the commit SHA that produced it.

Dedupe, the attempt budget, and audit records all hang off that SHA. Two platforms failing from the same push are one incident.

### Repair Attempt
One agent commit that passed the Green Gate and was pushed for a Deploy Incident.

A repeated deploy failure with no new commit is a re-observation, not an attempt; re-observations never spend budget.

### Green Gate
The mandatory verification every Repair Attempt passes before pushing: typecheck and build locally, plus tests in CI.

It validates the pushed commit content from a clean checkout, not the working tree.
