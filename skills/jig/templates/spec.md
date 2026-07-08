---
id: {{ID}}
type: {{TYPE}}          # feature | bug | chore | refactor
track: {{TRACK}}        # full | fast | hotfix
status: intake          # intake | spec_plan | implement | test | review | ship | done
created: {{CREATED}}
gate_spec_plan: pending # pending | approved
gate_review: pending    # pending | approved
---

# {{ID}}

## Part 1 — Spec (the contract)

### Summary
<!-- One-line statement of the task. -->

### Context
<!-- Background + links into .jig/memory (architecture.md, modules.md). -->

### Problem / Goal
<!-- What the developer actually wants, distilled from the Intake dialogue. -->

### Requirements
1. <!-- Functional requirement -->

### Acceptance criteria
- [ ] <!-- Testable, checkable outcome — the definition of done. -->

### Out of scope
- <!-- Explicit non-goals. -->

### Assumptions & resolved questions
- <!-- Decisions locked during Intake so they aren't re-litigated. -->

## Part 2 — Plan (execution)

### Approach
<!-- Chosen approach + one line on why (alternatives considered). -->

### Affected files & modules
- <!-- Concrete paths, from .jig/memory/modules.md + risks.md. -->

### Steps
1. <!-- Ordered; each step = a concrete change mapped to file(s). -->

### Test plan
- <!-- Which test proves each acceptance criterion; new vs existing. -->

### Risks & rollback
- <!-- Blast radius, migration notes, how to back out. -->
