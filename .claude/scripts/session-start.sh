#!/bin/bash
# SessionStart hook - loads skills and memory context

set -euo pipefail

# Embedded using-skills content
using_skills_content='---
name: using-skills
description: Use when starting any conversation - establishes mandatory workflows for finding and using skills
---

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST read the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.
</EXTREMELY-IMPORTANT>

## MANDATORY FIRST RESPONSE PROTOCOL

Before responding to ANY user message, you MUST complete this checklist:

1. ☐ List available skills in your mind
2. ☐ Ask yourself: "Does ANY skill match this request?"
3. ☐ If yes → Use the Skill tool to read and run the skill file
4. ☐ Announce which skill you'\''re using
5. ☐ Follow the skill exactly

**Responding WITHOUT completing this checklist = automatic failure.**

## Critical Rules

1. **Follow mandatory workflows.** Check for relevant skills before ANY task.
2. Execute skills with the Skill tool

## Skills with Checklists

If a skill has a checklist, YOU MUST create TodoWrite todos for EACH item.

**Don'\''t:**
- Work through checklist mentally
- Skip creating todos "to save time"
- Batch multiple items into one todo

**Why:** Checklists without TodoWrite tracking = steps get skipped. Every time.

## Summary

**Starting any task:**
1. If relevant skill exists → Use the skill
2. Announce you'\''re using it
3. Follow what it says

**Finding a relevant skill = mandatory to read and use it. Not optional.**
'

# Load memory.md if it exists, bounded by the retrieval budget (U6).
# Priority: workspace docs first (via loop-contract pointer below), then this
# recalled context, then recent logs. Raw claims already promoted or dropped
# are skipped at the source: memory.md is archived history, not authority.
memory_context=""

# Discover workspace root by walking up from current directory
workspace_root=$(pwd)
while [ "$workspace_root" != "/" ] && [ ! -d "$workspace_root/.aipmos" ]; do
    workspace_root=$(dirname "$workspace_root")
done

# Try to load memory.md, capped so session start stays inside budget.
# Truncation is character-safe (python path) with a byte fallback.
memory_file="$workspace_root/memory-bank/memory.md"
MEMORY_BUDGET_CHARS=1500
cap_text() {
    if command -v python3 >/dev/null 2>&1; then
        python3 -c 'import sys; print(open(sys.argv[1], encoding="utf-8", errors="replace").read()[:int(sys.argv[2])])' "$1" "$2"
    else
        head -c "$2" "$1"
    fi
}
if [ -f "$memory_file" ]; then
    memory_context=$(cap_text "$memory_file" "$MEMORY_BUDGET_CHARS")
    if [ "$(wc -m < "$memory_file" | tr -d ' ')" -gt "$MEMORY_BUDGET_CHARS" ]; then
        memory_context="${memory_context}
[…truncated at budget: full history in memory-bank/memory.md, which is archived, not authoritative…]"
    fi
fi

# Try to load learned patterns if they exist, under the same cap
learned_patterns_file="$workspace_root/memory-bank/learned-patterns.md"
learned_patterns_context=""

if [ -f "$learned_patterns_file" ]; then
    learned_patterns_context=$(cap_text "$learned_patterns_file" "$MEMORY_BUDGET_CHARS")
fi

# Initialize session intent file if it doesn't exist or is stale
session_intent_file="$workspace_root/.aipmos/session-intent.json"
session_id=$(date +%s)$$  # Timestamp + PID for uniqueness
current_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Check if session intent exists and is from today (stale check)
init_intent=false
if [ -f "$session_intent_file" ]; then
    file_time=$(stat -f "%Sm" -t "%Y-%m-%d" "$session_intent_file" 2>/dev/null || stat -c "%y" "$session_intent_file" 2>/dev/null | cut -d' ' -f1 || true)
    today=$(date +%Y-%m-%d)
    if [ "$file_time" != "$today" ]; then
        init_intent=true
    fi
else
    init_intent=true
fi

if [ "$init_intent" = true ]; then
    # Create new session intent template
    cat > "$session_intent_file" << EOF
{
  "session_id": "$session_id",
  "start_time": "$current_time",
  "intent": "",
  "user_description": ""
}
EOF
fi

# Build additional context
additional_context="<EXTREMELY-IMPORTANT>
You have many skills.

**Below is the full content of your 'using-skills' skill - your introduction to using skills. For all other skills, use the 'Skill' tool:**

${using_skills_content}"

if [ -n "$memory_context" ]; then
    additional_context="${additional_context}

---

## Memory Context (recalled, bounded; authority: code > promoted notes > this recall > raw logs; see docs/workspace/memory-loop.md)

${memory_context}"
fi

# Heal heartbeat: warn when the last heal verdict is older than 7 days (U6)
verdicts_file="$workspace_root/docs/memory-heal-verdicts.md"
heal_warn=""
if [ ! -f "$verdicts_file" ]; then
    heal_warn="Memory heal has never run: treat promoted notes as unverified."
else
    mtime=$(stat -f "%m" "$verdicts_file" 2>/dev/null || stat -c "%Y" "$verdicts_file" 2>/dev/null || true)
    now=$(date +%s)
    if [ -n "$mtime" ] && [ "$((now - mtime))" -gt 604800 ]; then
        heal_warn="Memory heal overdue (no verdict in 7+ days): treat promoted notes as unverified."
    fi
fi
if [ -n "$heal_warn" ]; then
    additional_context="${additional_context}

---

## Heal Status

${heal_warn}"
fi

if [ -n "$learned_patterns_context" ]; then
    additional_context="${additional_context}

---

## Recently Learned Patterns

${learned_patterns_context}"
fi

# Output context injection as JSON (jq encodes the string safely)
jq -n --arg ctx "$additional_context" \
    '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'

# Initialize observers and record session start (Phase 1 Memory System)
# Use venv python if available, otherwise system python
VENV_PYTHON="$workspace_root/.venv/bin/python3"
if [ -f "$VENV_PYTHON" ]; then
    PYTHON_CMD="$VENV_PYTHON"
else
    PYTHON_CMD="python3"
fi

export WORKSPACE_ROOT="$workspace_root"
"$PYTHON_CMD" -c "
import asyncio
import sys
import os
from pathlib import Path

workspace = Path(os.environ.get('WORKSPACE_ROOT', '.'))

# Add automation scripts to path
sys.path.insert(0, str(workspace / 'scripts/automation'))

try:
    from observers.observer_manager import ObserverManager

    async def main():
        manager = ObserverManager()
        await manager.initialize(workspace)
        time_observer = manager.get_observer('time_patterns')
        if time_observer:
            await time_observer.mark_session_start()

    asyncio.run(main())
except Exception as e:
    # Graceful degradation - don't fail session start
    sys.stderr.write(f'Observer initialization failed: {e}\n')
"

exit 0
