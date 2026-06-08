---
name: first-principles-thinking
description: >
  Systematic first principles thinking for any problem domain. Use when the user says
  "analyze from first principles", "第一性原理", "从根本分析", "从零开始思考",
  "think from scratch", "question this design", "is this the right approach",
  "challenge assumptions", "挑战假设", "为什么要这样做", "有没有更好的方案",
  "why are we doing it this way", or needs to evaluate decisions, designs, or strategies
  without relying on analogies, conventions, or "best practices". Also triggers on
  "这个设计合理吗", "从本质上看", "回到基本面", "what's really true here",
  "what are we assuming", or any request to decompose a problem to its fundamentals.
license: MIT
metadata:
  author: oh-my-openclaw
  version: "1.0"
  composed_from:
    - "awesome-skills/first-principles-skill (GitHub, 11 stars)"
    - "HoangTheQuyen/think-better (GitHub, 41 stars)"
    - "鹅厂架构师 davidycwei — 从第一性原理思考 Agentic Engineering (Zhihu)"
    - "Reddit r/PromptEngineering — 4 Thinking Models Master Prompt (112 upvotes)"
  sources:
    - https://github.com/tt-a1i/first-principles-skill
    - https://github.com/HoangTheQuyen/think-better
    - https://zhuanlan.zhihu.com/p/2010365825916359006
    - https://www.reddit.com/r/PromptEngineering/comments/1ma7f00/
---

# First Principles Thinking

A systematic approach to decomposing complex problems into irreducible truths and reasoning upward from there — avoiding the trap of reasoning by analogy, convention, or "best practice".

## When to Use

- Evaluating whether an architecture, design, or strategy is truly optimal
- Questioning "best practices" that may not fit the current context
- Breaking through when conventional solutions feel inadequate
- Making foundational decisions with long-term impact
- Challenging inherited assumptions in legacy systems or legacy thinking
- Any moment where "we've always done it this way" is the primary justification

## When NOT to Use

- Trivial decisions (use Occam's Razor instead — just pick the simplest)
- Time-critical emergencies (act first, analyze later)
- Well-validated problems with proven solutions (don't reinvent the wheel)
- When you lack domain expertise AND can't acquire it (first principles without knowledge = naive solutions)

---

## Core Methodology: 6 Phases

### Phase 0: Frame the Question — Establish Axioms

Before analyzing anything, define the irreducible truths that constrain this domain.

**Axioms** = facts that are independently verifiable, cannot be further decomposed, and violating them definitely causes failure.

**How to identify axioms:**
- Ask: "Can this be further decomposed?" — If yes, it's not an axiom yet.
- Ask: "Is this provably true, not just commonly believed?" — If uncertain, it's an assumption.
- Ask: "Would violating this definitely cause failure?" — If maybe, it's a preference.

**Gate**: Must produce ≥3 axioms before proceeding. Each axiom stated in one sentence with a "why irreducible" justification.

```markdown
### Axioms
1. [Axiom] — [Why this cannot be further decomposed]
2. [Axiom] — [Why this is provably true]
3. [Axiom] — [Why violating this causes failure]
```

> Deep methodology: `references/axiom-based-reasoning.md`

### Phase 1: Identify the Problem's Essence

Strip away implementation details to find the core problem.

1. **State the problem clearly** — What exactly needs to be solved?
2. **Separate symptoms from causes** — Is this the real problem or a manifestation?
3. **Define success criteria** — What would a perfect solution achieve? (Measurable.)

**Key questions:**
- What is the fundamental job to be done here?
- If this system/process didn't exist, what would we actually need?
- What outcome matters, independent of how we get there?

**Gate**: Must produce a one-sentence problem statement + measurable success criteria.

### Phase 2: Surface and Challenge All Assumptions

This is the highest-leverage phase. Most "best practices" are assumptions disguised as facts.

1. **List explicit assumptions** — What are we taking as given?
2. **Surface implicit assumptions** — What conventions are we following without questioning?
3. **Test each against axioms** — Is this actually a constraint (traces to axiom), or just how it's always been done?

**Minimum**: Produce an assumption table with ≥5 rows.

| Assumption | Why Question It | Axiom(s) Used | Verdict |
|------------|----------------|---------------|---------|
| "We need X" | [Challenge] | A1, A2 | Keep / Discard / Modify |

**Red flags (likely false assumptions):**
- "We've always done it this way"
- "Industry standard says..."
- "Everyone uses X for this"
- "That's too simple to work"

**Depth standard**: Each row must include *why* you're questioning it and *which axiom* informs the verdict. "Maybe not needed" without reasoning = not deep enough.

**Gate**: ≥5 assumptions challenged with verdicts. Each verdict must reference at least one axiom.

> Deep methodology: `references/axiom-based-reasoning.md` § "Identify and Challenge Assumptions"

### Phase 3: Establish Ground Truths

From the wreckage of challenged assumptions, identify what IS irreducibly true for this specific problem.

**Ground Truth test:**
- Can this be further decomposed? → If yes, decompose it.
- Is this provably true, not just commonly believed? → If unsure, it's still an assumption.
- Would violating this definitely cause failure? → If not, it's a preference.

**Gate**: Must produce ≥3 ground truths. Each must be specific and falsifiable — not generic truisms.

```
❌ "Users need fast response times" (too vague)
✅ "P99 latency must be < 200ms per SLA contract §3.2" (specific, verifiable)

❌ "The team is small" (relative)
✅ "Team is 3 engineers, no new hires possible before Q3" (concrete constraint)
```

### Phase 4: Reason Upward

Build solutions from ground truths only. Each layer must justify its existence.

```
Ground Truth → Minimal Solution → Justified Additions → Final Design
     ↑              ↑                    ↑
  (proven)     (sufficient)        (each defended)
```

1. **Start minimal** — What's the simplest thing that satisfies all ground truths?
2. **Add only what's necessary** — Each addition must reference a ground truth or axiom.
3. **Challenge each layer** — Does this layer earn its complexity?

**Gate**: Must produce a reasoning chain where every step traces to a ground truth.

```markdown
### Reasoning Chain
GT#1 (latency < 200ms) + GT#3 (3-person team) → Eliminate distributed architecture
GT#2 (read-heavy 95%) + GT#1 → Add read cache with 30s TTL
→ Conclusion: Monolith + in-memory cache
```

### Phase 5: Validate and Stress-Test

Ensure the reasoning is sound before acting.

**Three validation questions (Completion Gate):**

| # | Question | What Failure Means |
|---|---------|-------------------|
| 1 | Can every conclusion trace back to a ground truth? (**Traceability**) | You've introduced unjustified assumptions in Phase 4 |
| 2 | Is every ground truth covered by at least one conclusion? (**Completeness**) | Your solution ignores a constraint — it will fail there |
| 3 | Were any phases skipped or done shallowly? (**Honesty**) | Go back and finish them |

**Stress-test with complementary models:**

| Model | Question to Ask | When It Adds Value |
|-------|----------------|-------------------|
| **Pre-Mortem** | "It's 12 months later and this failed. Why?" | When you're excited about the solution |
| **Second-Order** | "If this works, what happens next? And after that?" | When solution has systemic effects |
| **Inversion** | "What would guarantee failure? Are we doing any of that?" | When you need to find blind spots |
| **OODA Act** | "What's the smallest test we can run right now?" | When analysis paralysis sets in |

> Full model toolkit: `references/thinking-models-toolkit.md`

**Gate**: All 3 validation questions answered "yes". At least one stress-test model applied.

---

## Reasoning Discipline Protocol

**Problem**: AI tends to skip steps, get distracted mid-analysis, or do each step shallowly.

### Phase Gates (Mandatory Artifacts)

| Phase | Must Produce | Min Depth |
|-------|-------------|-----------|
| 0: Frame | ≥3 axioms with justifications | Each axiom: 1 sentence + why irreducible |
| 1: Essence | Problem statement + success criteria | Specific and measurable |
| 2: Assumptions | Assumption table ≥5 rows | Each row: challenge + axiom reference + verdict |
| 3: Ground Truths | ≥3 ground truths | Each: specific, falsifiable, not a truism |
| 4: Reason Up | Reasoning chain with GT references | Every step traces to a GT |
| 5: Validate | 3 validation answers + 1 stress test | All answers = "yes" |

**No artifact → no next phase.** If a gate is not met, stop and complete it.

### Progress Tracker (Anti-Drift)

Maintain a running checklist throughout the analysis. After each phase completion, output:

```markdown
## 🧭 FP Progress
- [x] Phase 0: Frame — ✅ 3 axioms
- [x] Phase 1: Essence — ✅ "..."
- [→] Phase 2: Assumptions — 3/6 checked
- [ ] Phase 3: Ground Truths
- [ ] Phase 4: Reason Upward
- [ ] Phase 5: Validate
```

**If conversation drifts** (user asks a tangent, discussion expands on a side topic), after addressing it, immediately output:

> 📍 Returning to FP analysis: Phase N has M items remaining. Continuing.

### Depth Standards (Anti-Shallow)

| Phase | Shallow (Fail) | Deep (Pass) |
|-------|----------------|-------------|
| Assumptions | "Maybe we don't need this" | Table row with challenge reason + axiom reference + verdict |
| Ground Truths | "Users want fast" | "P99 < 200ms per SLA §3.2" |
| Reasoning | "So we should use X" | "GT#2 + GT#3 → eliminates Y → X is minimal solution" |

---

## Trellis Integration

When used within a Trellis-managed project, the analysis artifacts integrate with the task system.

### File Placement

```
.trellis/tasks/{MM-DD-slug}/
├── task.json              # Existing
├── prd.md                 # Existing — FP feeds into this
├── fp-analysis.md         # ← FP analysis output (Phases 0-5)
├── fp-progress.md         # ← Phase progress tracker (anti-drift)
├── implement.jsonl        # Existing — fp-analysis.md auto-added
├── check.jsonl            # Existing — fp-analysis.md auto-added
└── ...
```

### Brainstorm Integration

During `/trellis:brainstorm`, when the task is classified as "Complex":

1. **Trigger**: User says "从第一性原理分析" or AI detects the problem has ≥3 unvalidated assumptions
2. **Execute**: Run Phases 0-3, saving output to `fp-analysis.md` in task directory
3. **Feed into PRD**:
   - Ground Truths → PRD Requirements and Constraints
   - Assumption Table → design.md Trade-offs
   - Reasoning Chain → `design.md`
4. **Continue**: Phases 4-5 inform implementation decisions

### Context Injection

After FP analysis completes, add to context files:

```bash
python3 ./.trellis/scripts/task.py add-context "$TASK_DIR" implement "fp-analysis.md" "Ground truths and reasoning chain"
python3 ./.trellis/scripts/task.py add-context "$TASK_DIR" check "fp-analysis.md" "Verify implementation traces to ground truths"
```

### Completion Recording

After Phase 5, update `task.json`:

```json
{
  "fp_analysis": {
    "completed": true,
    "axioms_count": 3,
    "assumptions_challenged": 6,
    "ground_truths_count": 5,
    "validation_passed": true
  }
}
```

---

## Output Format

When applying first principles thinking, structure the final output as:

```markdown
## First Principles Analysis: [Topic]

### Axioms
1. [Axiom 1] — [Why irreducible]
2. [Axiom 2] — [Why irreducible]
3. [Axiom 3] — [Why irreducible]

### Problem Essence
**Core problem:** [One sentence]
**Success criteria:** [Measurable outcomes]

### Assumptions Challenged
| Assumption | Challenge | Axiom(s) | Verdict |
|------------|-----------|----------|---------|
| ... | ... | A1, A2 | Keep/Discard/Modify |

### Ground Truths
1. [Specific, falsifiable fact]
2. [Specific, falsifiable fact]
3. [Specific, falsifiable fact]

### Reasoning Chain
GT#1 + GT#3 → [Inference] → [Step] → [Conclusion]

### Conclusion
**Recommended approach:** [Description]
**Key insight:** [What FP analysis revealed that convention missed]
**Trade-offs acknowledged:** [What we accept and why]

### Validation
- [x] Every conclusion traces to a ground truth
- [x] Every ground truth is covered
- [x] No phases skipped
- [x] Stress-tested with: [model name]
```

---

## Common Traps

### The Complexity Trap
**Symptom**: Solution is more complex than the problem warrants.
**FP Check**: Remove one component — does it still solve the core problem? If yes, that component wasn't essential. Repeat.

### The Analogy Trap
**Symptom**: "Company X does it this way, so we should too."
**FP Check**: What problem was Company X solving? Is ours identical in all relevant dimensions? What constraints differ?

### The Legacy Trap
**Symptom**: Maintaining compatibility with decisions that no longer serve us.
**FP Check**: What was the original reason? Do those conditions still exist? What's the true cost of change vs. cost of maintaining?

> More patterns and case studies: `references/case-studies.md`

---

## Complementary Tools Quick Reference

| Tool | Key Question | Best Combined With Phase |
|------|-------------|------------------------|
| **Inversion** | "What guarantees failure?" | Phase 2 (find hidden assumptions) |
| **Second-Order** | "Then what? And then?" | Phase 5 (stress-test conclusions) |
| **5 Whys** | "Why? Why? Why? Why? Why?" | Phase 1 (find real problem) |
| **Pre-Mortem** | "It failed. Why?" | Phase 5 (stress-test) |
| **OODA Loop** | "What's the smallest test?" | Phase 5 (move to action) |
| **Via Negativa** | "What should we remove?" | Phase 4 (simplify solution) |
| **Bayesian Update** | "What new evidence changes this?" | Phase 3 (validate ground truths) |
| **Reversibility Filter** | "One-way or two-way door?" | Phase 4 (calibrate decision depth) |

> Full toolkit with examples: `references/thinking-models-toolkit.md`

---

## Bias Awareness

The 5 most dangerous biases for first-principles analysis:

| Bias | How It Corrupts FP | Quick Debias |
|------|-------------------|-------------|
| **Confirmation** | You "find" ground truths that confirm your preferred solution | Seek disconfirming evidence first |
| **Anchoring** | Conventional approach becomes mental anchor even when thinking "fresh" | Generate 3 alternatives before evaluating |
| **Sunk Cost** | Legacy decisions feel like ground truths | "If starting from zero today, would we choose this?" |
| **Status Quo** | "How it works now" feels like a constraint when it's a choice | Separate true constraints from current choices |
| **Overconfidence** | Treat assumptions as ground truths without testing | Assign confidence % to each assumption |

> Full 12-bias catalog with debiasing: `references/bias-and-debiasing.md`

---

## Problem Decomposition

Before applying FP to a complex problem, you may need to decompose it first. Quick selection:

| Problem Type | Best Framework |
|-------------|---------------|
| Diagnostic (why is X happening?) | Issue Tree or Fishbone |
| Financial (revenue/cost) | Profitability Tree |
| Strategic (what should we do?) | Hypothesis Tree |
| Operational (what's broken?) | Process Flow + 5 Whys |
| Complex adaptive system | Systems Map |

> Full 15-framework catalog: `references/decomposition-frameworks.md`

---

## Reference Files

| File | Content | When to Read |
|------|---------|-------------|
| `references/axiom-based-reasoning.md` | Deep methodology for establishing axioms, challenging assumptions, and deriving conclusions | When you need rigorous derivation, not just analysis |
| `references/thinking-models-toolkit.md` | 4-quadrant framework + 12 mental models + model selection guide + 5 Whys deep dive | When you need complementary thinking tools |
| `references/case-studies.md` | 5 software engineering cases + 2 SpaceX/Tesla cases + templates | When you want concrete examples of FP in action |
| `references/bias-and-debiasing.md` | 12 cognitive biases that corrupt FP thinking + debiasing strategies | When validating your analysis for blind spots |
| `references/decomposition-frameworks.md` | 15 problem decomposition methods (MECE, Issue Tree, etc.) | When the problem is too big to analyze directly |
