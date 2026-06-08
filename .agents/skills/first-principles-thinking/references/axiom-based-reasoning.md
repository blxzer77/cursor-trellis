# Axiom-Based First Principles Reasoning

## 1. Why First Principles Thinking?

There are two fundamental modes of reasoning, and most people default to only one.

**Inductive reasoning** observes specific cases and summarizes patterns. You look at how ten companies solved a problem, find commonalities, and apply them to your situation. This tells you "how others do it." It is fast, practical, and works well when conditions are stable. But it silently inherits every assumption those ten companies made — assumptions that may not hold for you.

**Deductive reasoning** starts from irreducible truths and derives conclusions. You identify what must be true regardless of context, then build solutions from those truths forward. This tells you "why this way, and can we do better." It is slower, harder, and sometimes uncomfortable because it forces you to question things everyone accepts.

First principles thinking is deductive reasoning applied to problem-solving:

1. **Deconstruct** the problem down to its irreducible facts
2. **Challenge** every assumption that isn't provably true
3. **Rebuild** the solution from scratch using only verified truths

The two modes are complementary, not competing. Induction is how you gather raw material — real-world evidence, patterns, heuristics. Deduction is how you stress-test that material and discover when the patterns break. The best decisions use induction to generate hypotheses and deduction to validate them.

The danger is using only induction. When you reason exclusively from "what works for others," you optimize within someone else's constraint set. First principles thinking breaks you out of inherited constraints and lets you find solutions that are genuinely optimal for your situation.

Elon Musk's battery cost example illustrates this concretely: industry consensus said battery packs cost $600/kWh and would decline slowly. Inductive reasoning accepted this as given. First principles reasoning decomposed a battery into raw materials (cobalt, nickel, lithium, carbon, steel, polymers) and asked what those materials cost on the London Metal Exchange — roughly $80/kWh. The gap between $80 and $600 was not physics; it was inherited process assumptions. That gap was the opportunity space.

---

## 2. The Axiom-Based Method

The axiom-based method is a systematic four-step process for applying first principles thinking to any domain. It transforms an intuitive practice ("think from scratch") into a repeatable, auditable methodology.

### Step 1: Establish Axioms

Axioms are irreducible truths — statements that are independently verifiable and cannot be further decomposed into simpler components. They are the bedrock on which everything else is built.

**How to identify axioms:**
- Ask: "Can this be further decomposed into simpler truths?"
- Ask: "Is this provably true, or is it just commonly believed?"
- Ask: "If someone violated this, would failure be guaranteed?"
- Ask: "Does this hold true regardless of context, technology, or era?"

An axiom is not a best practice, not a rule of thumb, and not an industry norm. It is a fact that survives all attempts to disprove it.

**Example axioms for decision-making:**
- **Axiom: Every decision is a resource allocation.** You cannot decide without spending time, money, attention, or opportunity cost. This is irreducible — even "deciding not to decide" consumes time and forecloses options.
- **Axiom: Information degrades with transmission.** Every time information passes through a human intermediary, it loses fidelity. This is verifiable through any game of telephone and holds regardless of technology.
- **Axiom: Complex systems fail at interfaces.** Failures cluster at boundaries between subsystems, teams, or processes — not within well-understood components. This is independently verifiable across engineering, organizations, and biology.

When establishing axioms, aim for 3-5 per problem domain. Fewer than 3 usually means you haven't decomposed enough. More than 7 usually means some of your "axioms" are actually derived conclusions.

**Common pitfalls in axiom identification:**
- Mistaking industry conventions for axioms ("quarterly planning cycles are necessary" is a convention, not an axiom)
- Stating axioms too broadly ("people are rational" is unfalsifiable at this level of generality)
- Stating axioms too narrowly ("our API response time must be under 200ms" is a requirement, not an axiom)
- Confusing axioms with goals ("we need to grow 3x this year" is a target, not a ground truth)

### Step 2: Identify and Challenge Assumptions

Most "best practices" are actually assumptions disguised as facts. They were true once, in one context, and have been passed forward uncritically ever since.

For each assumption in your problem space, use the axioms as judgment criteria:

**Structure the challenge:**
1. State the assumption explicitly
2. Examine it against each relevant axiom
3. Determine the verdict: holds, partially holds, or fails

The most dangerous assumptions are the ones everyone agrees on. Universal agreement often means nobody has tested the assumption recently — it has become invisible infrastructure that everyone builds on without questioning.

**How to surface hidden assumptions:**
- List everything you are treating as "given" or "obvious"
- Ask: "Why do we do it this way?" If the answer is "because we always have" or "because everyone does," you have found an assumption
- Ask: "What would a newcomer with no industry knowledge question about this?"
- Look for phrases like "obviously," "of course," "everyone knows" — these are markers of untested assumptions
- Examine constraints you treat as fixed: "We can't do X because Y" — is Y actually immovable, or just expensive to change?
- Look at what competitors do identically — uniform behavior across an industry often signals shared assumptions rather than shared truths

### Step 3: Derive Corrected Positions

For each challenged assumption, derive a corrected position based on the axiom analysis. A corrected position is not merely the negation of the assumption — it is a constructive statement about what should replace it.

**Format:**
> Assumption X fails because Axiom Y shows Z. Corrected position: [actionable statement].

The corrected position must be:
- **Specific enough to act on** — "be more careful" is not a corrected position
- **Traceable to axioms** — you should be able to point to exactly which axiom(s) support it
- **Falsifiable** — there should be evidence that could prove the corrected position wrong

If you cannot derive a clear corrected position, the assumption may actually be valid, or your axioms may need refinement.

### Step 4: Synthesize Practices

From corrected positions, derive concrete practices — actions, processes, or policies that implement the corrected understanding.

**Requirements for derived practices:**
- Each practice must trace back to one or more axioms (no orphan practices)
- Each practice must address one or more corrected positions
- No practice may contradict any established axiom

**Validation checklist:**
- Does every challenged assumption have at least one corresponding practice?
- Can every practice's rationale be traced to an axiom in under 30 seconds?
- If you removed one axiom, which practices would need to change? (This tests that the tracing is real, not cosmetic.)
- Are there any practices that feel right but cannot be traced to any axiom? If so, either an axiom is missing or the practice is unjustified.
- Does any practice contradict another practice? If so, the underlying axioms may be in tension — make the tension explicit.

---

### When to Use the Full Method vs. a Quick Check

The full four-step method is appropriate for high-stakes decisions — strategy changes, major investments, organizational redesigns. For lower-stakes decisions, a quick version suffices:

1. **Quick check:** State the assumption. Ask "what would have to be true for this to hold?" Check whether those conditions exist. If yes, proceed. If no, flag for full analysis.
2. **Full derivation:** Use all four steps when the decision is expensive to reverse, affects many people, or when quick checks keep surfacing doubts.

The method's cost should be proportional to the decision's cost. Applying the full framework to choose a lunch spot is waste; failing to apply it to a market entry decision is negligence.

**Rules of thumb for choosing depth:**
- Reversible decision under $10K impact: quick check only (5 minutes)
- Partially reversible, $10K-$500K impact: abbreviated derivation with 2-3 axioms (1-2 hours)
- Irreversible or >$500K impact: full four-step derivation with team review (half-day to full day)
- Strategic direction change: full derivation plus external validation against real-world data (multi-day)

---

## 3. Worked Example: 5 Common Assumptions Challenged

The following demonstrates the axiom-based method applied to five assumptions that appear across nearly every domain. Each assumption is widespread, rarely questioned, and at least partially wrong.

**Working axioms for this example:**
- **A1: Decisions are constrained by attention, not information.** Human cognitive bandwidth is finite and non-scalable. Adding information beyond processing capacity degrades outcomes.
- **A2: Tools amplify intent — they do not create it.** A tool produces output proportional to the quality of intent and understanding fed into it. No tool compensates for unclear thinking.
- **A3: Systems optimize for what they measure.** Unmeasured dimensions are neglected, regardless of their importance. Measurement is not neutral — it shapes behavior.
- **A4: Error accumulation is nonlinear in autonomous systems.** Unchecked small errors compound into large systemic failures. The relationship is exponential, not additive.
- **A5: Conditions are non-stationary.** The environment in which a solution was optimal changes continuously. Fitness to past conditions provides no guarantee of fitness to current conditions.

---

### Assumption 1: "More information leads to better decisions"

| Aspect | Detail |
|--------|--------|
| **Assumption** | More information leads to better decisions |
| **Key Challenge** | Quality (signal-to-noise ratio) matters more than quantity; information overload degrades decision quality |
| **Corrected Position** | Curate high-relevance information; filter ruthlessly |

**Analysis:** Axiom A1 states that decisions are constrained by attention, not information. If attention is the bottleneck, adding more information without increasing processing capacity merely dilutes the signal. Research on information overload consistently shows that decision quality peaks at moderate information levels and declines beyond that point. The assumption conflates "information available" with "information processed" — these are different quantities.

Applying the "what would have to be true" test: for this assumption to hold, humans would need unlimited processing bandwidth, or every additional piece of information would need to be net-positive after accounting for the cognitive cost of processing it. Neither condition is true. The corrected position is not "use less information" but rather "invest in filtering before consuming." The marginal cost of processing one more piece of information must be weighed against the marginal value it adds, and in most contexts, aggressive curation outperforms exhaustive collection.

---

### Assumption 2: "Expert tools can handle any complex problem"

| Aspect | Detail |
|--------|--------|
| **Assumption** | Expert tools can handle any complex problem |
| **Key Challenge** | Tools are constrained by their inputs; without proper context and domain knowledge, even the best tool produces mediocre output |
| **Corrected Position** | Invest in understanding the problem space before choosing tools |

**Analysis:** Axiom A2 establishes that tools amplify intent — they do not create it. A sophisticated tool given vague inputs will produce sophisticated-looking but fundamentally vague outputs. This is especially pernicious because the output looks authoritative, which masks the underlying weakness.

The assumption treats tools as solution generators when they are actually solution amplifiers. Applying axiom-based challenge: "What would have to be true for expert tools to handle any complex problem?" The tool would need to generate its own context, understand unstated constraints, and compensate for gaps in the operator's understanding. No tool does this — tools transform inputs into outputs. The corrected position redirects investment: spend 70% of effort on understanding the problem and 30% on tool selection and usage, not the reverse. An expert who deeply understands the problem with a simple tool will outperform a novice with the most advanced tool available.

---

### Assumption 3: "Speed is the primary measure of productivity"

| Aspect | Detail |
|--------|--------|
| **Assumption** | Speed is the primary measure of productivity |
| **Key Challenge** | Speed without direction amplifies errors; moving fast on the wrong problem wastes more resources than moving slowly on the right one |
| **Corrected Position** | Measure value delivered, not velocity |

**Analysis:** Axiom A3 tells us that systems optimize for what they measure. If you measure speed, people will move fast — including fast in the wrong direction. The assumption confuses activity with progress.

Speed is a multiplier, not a value in itself: speed multiplied by correct direction produces value, but speed multiplied by wrong direction produces waste at an accelerated rate. This is not a marginal effect — it is multiplicative. A team moving at 2x speed on the wrong problem produces 2x waste, not 2x value. The corrected position reframes the metric entirely. "We shipped 47 features this quarter" is meaningless without "and they collectively increased customer retention by 12%." Organizations that measure velocity without direction invariably accumulate fast-produced waste that later requires slow, expensive correction. The axiom predicts this outcome: what you measure is what you get, nothing more.

---

### Assumption 4: "The solution should be fully autonomous"

| Aspect | Detail |
|--------|--------|
| **Assumption** | The solution should be fully autonomous |
| **Key Challenge** | Autonomous systems accumulate unchecked errors; complex problems require human judgment at key checkpoints |
| **Corrected Position** | Design for human-in-the-loop at critical decision points |

**Analysis:** Axiom A4 establishes that error accumulation in autonomous systems is nonlinear. A 1% error rate per step becomes a 26% cumulative error rate after 30 steps (1 - 0.99^30). With a 2% error rate, it reaches 45% after 30 steps. The math is unforgiving.

Autonomous systems are excellent at executing well-defined processes but poor at detecting when the process itself has become inappropriate — they lack the meta-awareness to ask "should I still be doing this?" The assumption treats autonomy as an unqualified good, when it is actually a tradeoff between efficiency and error correction. Applying the axiom-based challenge: for full autonomy to work, either the error rate per step must be effectively zero, or the cost of accumulated errors must be trivially low. Neither condition holds for complex problems. The corrected position identifies the leverage points: let the system run autonomously through well-understood steps, but insert human checkpoints at branching decisions, ambiguous inputs, and irreversible actions. Full autonomy is appropriate only when the error cost of any single step is trivially low and fully reversible.

---

### Assumption 5: "Past solutions should guide future decisions"

| Aspect | Detail |
|--------|--------|
| **Assumption** | Past solutions should guide future decisions |
| **Key Challenge** | Conditions change; solutions optimized for past constraints may be suboptimal or harmful under new conditions |
| **Corrected Position** | Re-derive solutions from current ground truths, not historical precedent |

**Analysis:** Axiom A5 states that conditions are non-stationary. A solution that was optimal under Condition Set A may be actively harmful under Condition Set B. The assumption treats past success as evidence of future success, but what it actually evidences is fitness to past conditions — which may no longer exist.

This is the assumption that most often masquerades as "wisdom" or "experience." The more successful the past solution, the harder it is to question — and the more dangerous it becomes when conditions shift. Resistance to re-examination is proportional to past success, which is exactly backwards from what rationality demands. This does not mean past experience is worthless. It means past experience should be treated as a hypothesis ("this approach might work here because conditions are similar"), not a conclusion ("this approach will work here because it worked before"). The corrected position demands re-derivation: use historical solutions as one input, but validate them against current axioms and current conditions before adopting them. The question is never "did this work before?" but always "do the conditions that made this work still exist?"

---

## 4. The Derivation Template

Use this template to apply axiom-based first principles reasoning to any topic.

```markdown
## First Principles Derivation: [Topic]

### Axioms (Irreducible Truths)
1. [Axiom 1] — [Why irreducible]
2. [Axiom 2] — [Why irreducible]
3. [Axiom 3] — [Why irreducible]

### Assumptions Challenged
| Assumption | Axiom(s) Used | Analysis | Corrected Position |
|-----------|--------------|---------|-------------------|
| [Common belief] | A1, A3 | [Why it fails] | [What replaces it] |
| [Industry norm] | A2 | [Why it fails] | [What replaces it] |

### Derived Practices
| Practice | Traces to Axiom(s) | Covers Assumption(s) |
|---------|-------------------|---------------------|
| [Concrete action] | A1, A3 | #1, #3 |
| [Process change] | A2 | #2 |

### Validation
- [ ] Every corrected position leads to at least one practice
- [ ] Every practice traces to at least one axiom
- [ ] No practice contradicts any axiom
- [ ] Removing any single axiom changes at least one practice (no cosmetic axioms)
- [ ] Each practice is specific enough to implement this week
```

### Template Usage Notes

**Establishing axioms:** Start with 3-5. If you struggle to find 3, you may not understand the domain deeply enough. If you find more than 7, some are likely derived conclusions, not axioms — test each by asking whether it can be derived from a combination of the others.

**Challenging assumptions:** Work through assumptions in order of impact. Start with the assumption whose correction would change the most about your current approach. This ensures that even if you only complete half the analysis, you have addressed the highest-leverage items.

**Deriving practices:** Each practice should be concrete enough that someone could begin implementing it within one week. "Improve communication" is not a practice. "Hold a 15-minute daily sync where each person states their top blocker" is a practice.

**Validation:** The validation checklist is not bureaucratic overhead — it is the mechanism that ensures your reasoning is sound. If any check fails, the derivation has a gap that needs to be closed before the practices can be trusted.

**Common failure modes when using the template:**
- **Axioms that are actually conclusions:** If an axiom can be derived by combining two other axioms, it is not an axiom — demote it to a derived conclusion
- **Circular reasoning:** The corrected position merely restates the axiom in different words rather than applying it to the specific assumption
- **Practices too abstract to implement:** "Improve alignment" is not a practice; "Hold weekly 30-minute cross-team syncs with a shared agenda template" is
- **Missing the validation step:** Skipping validation feels efficient but produces derivations that look rigorous while containing logical gaps

---

## 5. Key Principles for Axiom-Based Reasoning

These principles govern the effective application of the method.

### 1. Axioms must be independently verifiable
If you cannot test an axiom — if there is no experiment, observation, or logical proof that could confirm or deny it — it is not an axiom. It is a belief. Beliefs can be useful, but they cannot serve as the foundation of a rigorous derivation. Every axiom should come with an implicit answer to "How would I verify this?"

### 2. The most valuable axioms are domain-specific, not generic truisms
"Quality matters" is a truism — it is true but useless because it provides no leverage. "In regulated industries, compliance cost grows quadratically with the number of jurisdictions served" is a domain-specific axiom that directly constrains solution design. Prefer axioms that create specific, actionable constraints over axioms that are merely broadly true.

### 3. Challenge assumptions in order of impact
Not all assumptions are created equal. An assumption that affects 80% of your operations deserves attention before one that affects 5%. Rank assumptions by the magnitude of change their correction would produce, and work from the top. This ensures maximum return on analytical effort. A practical heuristic: if correcting an assumption would change nothing about your current approach, it is not worth challenging — move to the next one.

### 4. "What would have to be true" is the most powerful question
When evaluating any assumption, ask: "What would have to be true for this assumption to hold?" Then check whether those conditions actually exist. This question transforms vague disagreement ("I don't think that's right") into precise analysis ("That requires X, Y, and Z to be true, and Z is not true in our context"). It is the single most useful question in assumption challenging.

### 5. Corrected positions must be actionable
A corrected position that reads "the assumption is wrong" is worthless. A corrected position that reads "instead of X, do Y because axiom Z shows W" is valuable. Every corrected position should pass the test: "Could someone who read only this corrected position change their behavior appropriately?" If not, make it more specific.

### 6. The derivation is the documentation
In axiom-based reasoning, the derivation itself serves as the decision record. Every practice traces to axioms through corrected positions, which means every decision is self-documenting. When someone asks "why do we do it this way?" the answer is in the derivation chain. This eliminates the need for separate justification documents and ensures institutional memory survives personnel changes. It also makes onboarding faster — a new team member can read the derivation and understand not just what to do, but why, in a single document.

### 7. Revisit axioms when conditions change fundamentally
Axioms are irreducible truths — but they are truths within a context. When the context changes fundamentally (new technology, new market structure, new regulation), axioms must be re-examined. An axiom that was irreducible in 2020 may be decomposable or even false in 2026. Schedule periodic axiom reviews, especially after major environmental shifts. Signs that your axioms need revision: derived practices keep producing unexpected results, new entrants succeed by violating your axioms, or the assumptions you challenge keep passing validation when your intuition says they should not.

### 8. Induction validates deduction
After deriving practices from axioms, check them against real-world evidence. Do organizations that follow similar practices actually outperform? Does the data support the derived conclusions? Deduction tells you what should work; induction tells you what does work. When they agree, you have high confidence. When they disagree, the disagreement itself is the most important finding — it means either your axioms are incomplete or the real-world data has confounding factors worth investigating.

Practical validation approach: after completing a derivation, identify 3-5 organizations or cases where similar practices were applied. Did the outcomes match the derivation's predictions? If not, trace the discrepancy back through the axiom chain to find where the model diverges from reality.

### 9. When axioms conflict, the conflict itself is the most valuable insight
If two well-established axioms produce contradictory conclusions, resist the urge to discard one. The tension between them usually reveals a nuance that neither axiom alone captures. For example, "move fast" and "verify carefully" both qualify as axioms in certain contexts. The conflict between them is where judgment lives — and mapping that conflict explicitly (under what conditions does each take priority?) produces more useful guidance than either axiom alone.

To resolve axiom conflicts productively: identify the boundary condition where one axiom's importance overtakes the other. Express this as a conditional: "When [condition], prioritize Axiom A over Axiom B." This conditional itself becomes a derived principle that enriches the framework.

### 10. Separate the method from the conclusion
The value of axiom-based reasoning is not any particular conclusion — it is the repeatability and auditability of the process. Two people applying the method to the same problem with the same axioms should reach similar conclusions. If they reach different conclusions, the divergence point is identifiable and debatable. This is the fundamental advantage over intuition-based reasoning, where disagreements are unresolvable because the reasoning is opaque. Defend the method rigorously, hold conclusions lightly — they should change whenever better axioms or new evidence emerge.
