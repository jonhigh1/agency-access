---
title: Stale root design file parses as live tokens
date: 2026-10-09
category: documentation
module: design system
problem_type: documentation_gap
tags: [design-system, stale-frontmatter, tokens, agent-memory]
---

# Stale Root Design File Parses as Live Tokens

## Problem

The root `DESIGN.md` carried a full YAML frontmatter block defining colors, typography, radius, spacing, and components from the superseded v1 aesthetic, while its body declared the file stale in favor of `apps/web/DESIGN_SYSTEM.md` v2. Any agent or tool parsing frontmatter as tokens shipped violet accents and rounded corners against the binary-radius, one-coral-accent contract.

## Decision

Stale files must not carry machine-readable token blocks. The frontmatter was stripped, leaving the stale pointer and body intact. Canonical tokens live in `apps/web/DESIGN_SYSTEM.md` and `apps/web/src/app/globals.css` only.

## Verification

Workspace review confirmed the frontmatter lines against the v2 contract before removal. The remaining file holds no token-shaped YAML.
