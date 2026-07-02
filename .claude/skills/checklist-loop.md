# Checklist-Loop Skill v11

Checklist-driven multi-agent + human collaboration loop. Five agents (A/B/C/D/E) under Master orchestration. Every fix flows through Execute(A) → Review(B) → Test(C/D/E) → UserConfirm before it's "done."

## Trigger `/checklist-loop <task>`

## Agent Roles

| Agent | Role | Write FS? | Timeout | Produces |
|-------|------|-----------|---------|----------|
| **Master** | Orchestrator: parse task, build checklist, dispatch agents, merge verdicts, present to user | checklist.json + summary.json | — | round summary |
| **A** | Executor: implements fixes, only agent that modifies code | modified files + A.json | 5 min | rN/A.json |
| **B** | Reviewer: reviews A's diff, strategies fixes, has veto power | read-only | 3 min | rN/B.json |
| **C** | Functional + Performance tester: unit/integration/code-trace/perf | read-only | 3 min | rN/C.json |
| **D** | Integration + E2E tester: cross-module interaction, API contracts, data flow | read-only | 3 min | rN/D.json |
| **E** | UI + Build tester: visual correctness, build health, a11y, bundle size | read-only | 3 min | rN/E.json |

## End-to-End Example

Task: "Fix intraday chart tick labels not showing"

**Round 0**: Master analyzes IntrdayChart.tsx → finds `tickMarkFormatter` uses wall-clock minutes (570) but `TICK_MINUTES` uses offsets (0) → creates 8-item checklist → User approves.

**Round 1**: A fixes 8 items → B reviews diff → C/D/E verify in parallel → Master merges verdicts, updates checklist + trend, shows summary table → User reviews, marks item 3 FAIL.

**Round 2**: Partial re-exec: A+B target only item 3 → C/D/E full verify → Master updates → User confirms PASS on all.

**Round 3**: All PASS → task complete. Master writes final summary.

## Artifact Directory

```
.claude/artifacts/<slug>/
  checklist.json          ← single source of truth (Master reads/writes)
  summary.json            ← Master's per-round summary (user-facing)
  r1/A.json               ← Round 1: Executor output
  r1/B.json               ← Round 1: Reviewer output
  r1/C.json               ← Round 1: Func/Perf test output
  r1/D.json               ← Round 1: Integration test output
  r1/E.json               ← Round 1: UI/Build test output
  r2/...                  ← Round 2 outputs (only A+B re-exec; C/D/E full)
```

- Master creates directory + checklist.json at Round 0
- Agents write only their own file (A → A.json, etc.)
- Master reads all outputs, resolves verdicts, updates checklist.json + summary.json
- Old round directories preserved for trend audit

## Flow

```
Round 0: Master analyzes → checklist → User approves
Round 1: A(execute) → B(review) → C∥D∥E(test) → Master merges → User reviews
Round 2+: User marks FAIL items → A+B partial re-exec (FAIL only) → C/D/E full verify → User reviews
After max_rounds: list remaining FAIL → User decides (defer/accept/continue)
```

### Round 0 (Analysis)
1. Parse task, extract keywords (e.g. "intraday labels" → `IntradayChart.tsx`)
2. Glob to find matching files, Grep to trace call chains
3. Read key files; trace end-to-end data flow (UI → Hook → Tauri → Rust → API)
4. Identify edge cases: empty data / null / timezone / offline / concurrent / race
5. Create checklist (5-10 items) covering FUNC / PERF / RELI / UI / BUILD
6. Write `checklist.json` (all items `PENDING`, `round: 0`)
7. **Present checklist to user as markdown table → wait for approval before spawning agents**

### Round 1 (Full Execution)
1. Master sends `checklist.json` + task context to A
2. **A executes** → writes modified files + `r1/A.json`
3. **B reviews** A's diff against checklist → writes `r1/B.json`
4. After B passes, **C ∥ D ∥ E** verify in parallel → write `r1/C.json`, `r1/D.json`, `r1/E.json`
5. Master waits for all agents (with timeout); merges verdicts into `checklist.json`
6. Master writes `summary.json` and **presents round summary table to user**
7. User marks any FAIL items → next round

### Round 2+ (Partial Re-Execution)
1. User marks which items are FAIL (only these trigger repair)
2. **A+B target ONLY FAIL items** — A receives only FAIL items from checklist; B reviews only those diffs
3. C/D/E perform **full verification** across all items (not just FAIL — to catch regressions)
4. Master updates checklist + appends to `trend` array
5. Master shows summary with trend signals
6. After `max_rounds`: list all remaining FAIL → **User decides** (defer to backlog / accept as-is / continue one more round)

### Agent Concurrency
```
Round 1:   A ──→ B ──→ C ∥ D ∥ E ──→ Master
Round 2+:  A ──→ B ──→ C ∥ D ∥ E ──→ Master   (A+B: FAIL items only)
```
- C, D, E always run in parallel after B completes
- B cannot start until A finishes (needs A's diff)
- Master waits for all agents; timed-out agents → items marked BLOCKED
- Any agent crash → retry once; crash again → BLOCKED

## Checklist Format (checklist.json)

```json
{
  "task": "Fix intraday chart tick labels",
  "slug": "intraday-tick-labels",
  "round": 2,
  "max_rounds": 3,
  "status": "IN_PROGRESS",
  "trend": [
    { "round": 1, "pass": 7, "fail": 1, "skip": 0, "blocked": 0, "total": 8,
      "signals": [] }
  ],
  "items": [
    {
      "id": 1,
      "cat": "FUNC",
      "priority": "P0",
      "desc": "Tick labels visible for all market hours",
      "metric": "10 labels from 09:30 to 15:00 all rendered and readable",
      "status": "PASS",
      "depends_on": [],
      "source_files": ["ui/src/components/IntradayChart.tsx:175-182"],
      "verdicts": { "A": "PASS", "B": "PASS", "C": "PASS", "D": "PASS", "E": "PASS" },
      "evidence": "IntradayChart.tsx:178 — switch tickMarkFormatter to HH:MM string comparison",
      "blocked_reason": null,
      "round_history": [
        { "round": 1, "status": "PASS", "verdicts": { "A": "PASS", "B": "PASS", "C": "PASS", "D": "PASS", "E": "PASS" } }
      ]
    }
  ]
}
```

**Field reference:**
- `cat`: FUNC | PERF | RELI | UI | BUILD
- `priority`: P0 (blocking) | P1 (important) | P2 (nice-to-have)
- `status`: PENDING | PASS | FAIL | BLOCKED | SKIP
- `depends_on`: prerequisite item IDs; parent FAIL → child auto-SKIP
- `verdicts`: each agent's verdict — only PASS / FAIL / SKIP (unified vocabulary)
- `evidence`: format `file:line — description of what was done`
- `trend[].signals`: `["escalating:item-3", "rising_fail_count", "scope_creep", "stalled"]` — Master populates
- `round_history`: per-item per-round verdict snapshot for root-cause analysis
- `status` (top-level): IN_PROGRESS | COMPLETE | ABORTED

## Master Summary Format (summary.json)

Master writes this after each round; it's the user-facing round report.

```json
{
  "round": 1,
  "slug": "intraday-tick-labels",
  "summary": "7/8 items pass. Item 3 (tooltip hover) fails — C reports stale data on rapid hover.",
  "table": "| # | Cat | Item | Status | Evidence |\n|---|-----|------|--------|----------|\n| 1 | FUNC | Tick labels | ✅ PASS | HH:MM comparison |\n| ... |",
  "signals": [],
  "recommendation": "Proceed to Round 2 targeting item 3 only.",
  "user_actions": [
    { "item_id": 3, "options": ["mark FAIL → re-execute next round", "mark SKIP → defer", "mark PASS → accept as-is"] }
  ],
  "build_status": { "frontend": "PASS", "backend": "PASS" },
  "modified_files": ["ui/src/components/IntradayChart.tsx"],
  "round_duration_sec": 245
}
```

## Agent Output Schemas

All agents use **unified vocabulary**: `PASS` / `FAIL` / `SKIP`. Banned: FIXED, REVIEWED, DONE, PARTIAL, WIP.

### A.json (Executor)
```json
{
  "agent": "A", "round": 1,
  "items": [
    { "id": 1, "verdict": "PASS", "summary": "Fixed tickMarkFormatter to use IndexTimeScale", "files_touched": ["IntradayChart.tsx:175-182"] }
  ],
  "modified_files": ["ui/src/components/IntradayChart.tsx"],
  "build": { "frontend": "PASS", "backend": "PASS" },
  "risks": ["Tick format change may affect other charts using tickMarkFormatter"]
}
```

### B.json (Reviewer)
```json
{
  "agent": "B", "round": 1,
  "items": [
    { "id": 1, "verdict": "PASS", "issues": [], "praise": ["Clean fix, minimal diff"], "recommendation": "Merge as-is" }
  ],
  "conflicts_with": [],
  "unexpected_changes": [],
  "diff_summary": "Single-file change, 3 lines modified in tickMarkFormatter"
}
```

### C.json / D.json / E.json (Testers)
```json
{
  "agent": "C", "round": 1,
  "items": [
    { "id": 1, "verdict": "PASS", "method": "code-trace", "evidence": "IntradayChart.tsx:178 — confirms offset-based comparison", "issues": [] }
  ],
  "build": { "frontend": "PASS", "backend": "PASS" },
  "regression_risk": "low"
}
```

**Tester scope matrix:**

| Tester | Scope | Methods |
|--------|-------|---------|
| **C** | Functional correctness + Performance | code-trace, unit-test, perf-profile, logic-audit |
| **D** | Integration + E2E | cross-module trace, API contract check, data-flow validation, state-machine audit |
| **E** | UI rendering + Build health | visual-diff, a11y check, bundle-size, build-log scan, responsive-breakpoint |

## Verdict Resolution

Master resolves the final item status from agent verdicts:

| Pattern | Result | Rationale |
|---------|--------|-----------|
| All agents PASS | → **PASS** | Unanimous |
| A=PASS, B=PASS, any tester FAIL | → **FAIL** | Tester found runtime issue |
| A=PASS, B=FAIL | → **FAIL** | B has veto |
| A=FAIL (self-report) | → **FAIL** | A couldn't fix |
| B=PASS, C/D/E disagree among themselves | → **FAIL** | User arbitrates |
| Agent crash / no output | Retry once → **BLOCKED** | |
| Partial output (some items missing) | Missing → **BLOCKED** | |
| Unexpected files modified (not in A's `modified_files`) | → **FAIL** item(s) | B catches this |
| Prerequisite item FAIL | Dependent items → **SKIP** | `depends_on` cascade |

### Dependency Resolution Algorithm
```
function resolveDependencies(items):
  for each item sorted by id:
    if any parent in depends_on has status == FAIL:
      item.status = SKIP
      item.evidence = "Skipped: prerequisite item {id} failed"
    if any parent in depends_on has status == SKIP:
      item.status = SKIP
      item.evidence = "Skipped: prerequisite item {id} was skipped"
```
Master runs this BEFORE dispatching agents and AFTER merging verdicts.

## Trend & Signals

Master appends to `trend` array each round and populates `signals`:

| Signal | Trigger | Meaning |
|--------|---------|---------|
| `escalating:<id>` | Same item FAIL 2+ consecutive rounds | May need different approach or user intervention |
| `rising_fail_count` | fail_count this round > previous round | Regression introduced |
| `stalled` | Zero items changed status this round | Agents may be stuck or task is ill-defined |
| `scope_creep` | New items added mid-loop beyond initial 10 | Task expanding beyond original scope |
| `all_pass` | All items PASS | Task complete |
| `build_broken` | Build status changed from PASS to FAIL | Regression; all items become BLOCKED until fixed |

Signals appear in summary and help the user make faster decisions.

## Build Failure Protocol

If any agent reports `build: { frontend: "FAIL" }` or `build: { backend: "FAIL" }`:
1. All items for that round become **BLOCKED** (build must be fixed first)
2. Master creates a priority P0 build-fix item at the top of the checklist
3. Next round's A must fix the build before any other items
4. If build fails 2 consecutive rounds → Master recommends user intervention

## Timeout & Retry

| Scenario | Timeout | Action |
|----------|---------|--------|
| Agent A execute | 5 min | Timeout → Master retry once; retry fail → BLOCKED |
| Agent B review | 3 min | Timeout → Master retry once; retry fail → BLOCKED |
| Agent C/D/E test (each) | 3 min | Timeout → mark items BLOCKED; other testers continue |
| Master wait-all | 8 min | Completed items kept; pending → BLOCKED |

## Edge Case Catalog

| Edge Case | Handling |
|-----------|----------|
| Empty diff (A changed nothing) | B flags; Master marks items FAIL with evidence "no changes made" |
| A's diff is too large (>200 lines) | B marks FAIL with recommendation to split task |
| Checklist item has no quantitative metric | B requests Master refine the item before review |
| User requests new item mid-loop | Master appends item with `round_added` field; treated as new PENDING |
| User abandons task mid-loop | Master writes final checklist with status ABORTED; preserves artifacts |
| Two items have circular depends_on | B detects and reports; Master breaks cycle by priority |
| Build was fine in A but broken in C/D/E | Indicates non-deterministic build; Master marks items BLOCKED |
| All items SKIP (dependency cascade) | Master reports to user; user redefines task or accepts |
| Task too large for 10 items | Master splits into sub-slugs; each sub-task gets its own checklist-loop |

## User Interaction Points

| Point | Format | User Action |
|-------|--------|-------------|
| **Round 0 approval** | Markdown checklist table | Approve / Revise / Reject individual items |
| **End of each round** | Summary table (from summary.json) | Mark items PASS/FAIL/SKIP |
| **After max_rounds** | Final FAIL list | Defer (to backlog) / Accept (as-is) / Continue (+1 round) |
| **Build broken** | Alert with build log excerpt | Intervene manually / Retry / Abort |
| **Conflict detected** | Agent disagreement details | Arbitrate: pick which agent to trust |

## Rules

1. Every fix must pass B's review (verdict=PASS) to progress
2. Cannot claim "fixed" unless at least 2 of C/D/E confirm PASS
3. After every round, show complete checklist table to User (from summary.json)
4. Checklist items must have a quantitative metric (FUNC/PERF) or behavioral description (UI/BUILD)
5. Max 3 rounds default; after max_rounds, list FAIL items for User decision
6. A is the **only** agent that modifies files; B/C/D/E are read-only
7. All agents use unified vocabulary: PASS / FAIL / SKIP (banned: FIXED, REVIEWED, DONE, PARTIAL, WIP)
8. Files modified by A but not listed in `modified_files` → B marks as FAIL (rule 8)
9. Prerequisite item FAIL → dependent items auto-SKIP (dependency cascade)
10. BLOCKED items must populate `blocked_reason`; Master must address BLOCKED items before next round dispatch
11. Master must populate `signals` in trend when any signal condition triggers
12. Build failure → all items BLOCKED until build is fixed (see Build Failure Protocol)
