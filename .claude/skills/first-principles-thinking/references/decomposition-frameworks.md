# Problem Decomposition Frameworks

Before you can apply first principles to a problem, you often need to decompose it into manageable pieces. A complex, tangled problem resists first-principles reasoning because you cannot isolate the ground truths — everything feels interconnected and overwhelming. These 15 frameworks provide structured ways to break down complexity so that first-principles thinking has something concrete to work with.

Pick the framework that matches your problem type, decompose first, then apply first-principles reasoning to each piece.

Source: think-better project's problem-solving-pro skill.

---

### Issue Tree
**What**: Break a broad question into a tree of sub-questions, where each level is MECE (Mutually Exclusive, Collectively Exhaustive).
**When**: Diagnostic problems where you need to find the root cause or map a decision space.
**Structure**:
```
Why is revenue declining?
├── Are we losing customers?
│   ├── Is churn increasing?
│   └── Are we acquiring fewer?
└── Are customers spending less?
    ├── Is average deal size shrinking?
    └── Is expansion revenue declining?
```
**Example**: "Why did NPS drop 15 points?" branches into product quality, support response time, onboarding experience, and pricing perception — each explored independently.

### Hypothesis Tree
**What**: Start with a hypothesis and break it into the conditions that must all be true for the hypothesis to hold.
**When**: Uncertain causes where you suspect an answer but need to validate it systematically.
**Structure**:
```
Hypothesis: We should enter the EU market
├── Condition 1: Sufficient demand exists (>$50M TAM)
├── Condition 2: We can comply with GDPR at reasonable cost
├── Condition 3: We can hire or partner locally
└── Condition 4: Unit economics work with EU pricing
```
**Example**: "Our product-market fit is weakening" — decompose into retention, activation, referral, and willingness-to-pay conditions. Test each one independently.

### MECE Decomposition
**What**: Divide any set into categories that do not overlap (Mutually Exclusive) and cover everything (Collectively Exhaustive).
**When**: Universal structuring principle applicable to any problem where you need completeness without double-counting.
**Structure**: Test every decomposition by asking: (1) Does anything fall into two categories? (2) Is anything left out? If yes to either, restructure.
**Example**: Segmenting customers by contract size (SMB < $50K, Mid-Market $50K-$250K, Enterprise > $250K) — every customer falls into exactly one bucket.

### Profitability Tree
**What**: Decompose profit into Revenue (Price x Volume) minus Costs (Fixed + Variable).
**When**: Financial analysis, margin diagnosis, pricing decisions, or understanding why profitability changed.
**Structure**:
```
Profit
├── Revenue
│   ├── Price per unit
│   └── Volume (units sold)
│       ├── New customers
│       └── Existing customers (expansion)
└── Costs
    ├── Fixed (rent, salaries, infrastructure)
    └── Variable (COGS, commissions, hosting per user)
```
**Example**: "Gross margin dropped 8 points" — the tree quickly isolates whether it is a pricing issue, a volume mix issue, or a cost increase.

### Process Flow Decomposition
**What**: Map a process as sequential steps, measure each, and identify bottlenecks.
**When**: Operational problems — anything where work flows through stages and something is slow, broken, or inconsistent.
**Structure**: `Step 1 → Step 2 → Step 3 → ... → Output` with time, error rate, and throughput measured at each step.
**Example**: Lead-to-close process: Inbound → Qualification (2 days) → Demo (5 days) → Proposal (3 days) → Negotiation (14 days) → Close. The 14-day negotiation step is the bottleneck.

### Customer Journey Map
**What**: Map every touchpoint a customer has with your product/company from first awareness through advocacy.
**When**: Customer experience problems, activation issues, churn diagnosis, or onboarding redesign.
**Structure**: `Awareness → Consideration → Trial → Purchase → Onboarding → Usage → Expansion → Advocacy` — at each stage, map: what the customer does, what they feel, and where they get stuck.
**Example**: Mapping a SaaS trial journey reveals that 60% of users drop off between signup and first meaningful action because the onboarding wizard asks for data they do not have yet.

### Value Chain Analysis
**What**: Decompose a business by its value-adding activities (inbound logistics, operations, outbound, marketing/sales, service) plus support activities (infrastructure, HR, technology, procurement).
**When**: Competitive advantage analysis — understanding where you create unique value vs. where you are commoditized.
**Structure**: Porter's value chain: primary activities (left to right) supported by infrastructure activities above.
**Example**: A fintech discovers its competitive advantage is not in the product (commoditized) but in its compliance operations — faster regulatory approval is the real moat.

### Systems Map
**What**: Map feedback loops, dependencies, and non-linear relationships between components.
**When**: Complex adaptive systems — problems where interventions have unintended consequences and cause-effect is circular.
**Structure**:
```
Hiring more engineers → More features shipped → More customers
       ↑                                              ↓
More revenue ← Higher retention ← Better product quality
```
Mark each arrow as reinforcing (+) or balancing (-). Identify the dominant loops.
**Example**: Mapping a marketplace reveals that driver supply and rider demand form a reinforcing loop, but surge pricing creates a balancing loop that caps growth in certain geographies.

### Stakeholder Map
**What**: Identify who is affected, who has influence, and who makes the final decision.
**When**: Organizational problems, change management, cross-functional initiatives, or any situation where human dynamics determine outcomes.
**Structure**: 2x2 matrix — Influence (high/low) x Interest (high/low). High-influence + high-interest = manage closely. High-influence + low-interest = keep satisfied.
**Example**: Rolling out a new CRM — Sales leadership (high influence, high interest), Finance (high influence, low interest), individual reps (low influence, high interest), Legal (low influence, low interest).

### Scenario Tree
**What**: Branch possible futures by key uncertainties, creating distinct scenarios to plan against.
**When**: Planning under uncertainty — when the right strategy depends on which future materializes.
**Structure**:
```
Key uncertainty: Market grows fast vs. slow
├── Fast growth
│   ├── We execute well → "Blue Ocean"
│   └── We stumble → "Missed Window"
└── Slow growth
    ├── We execute well → "Efficient Machine"
    └── We stumble → "Survival Mode"
```
**Example**: An AI startup models scenarios around regulation (strict vs. permissive) crossed with foundation model commoditization (fast vs. slow) to decide build-vs-buy strategy.

### Feature Tree
**What**: Decompose a product into its features, capabilities, and sub-capabilities in a hierarchy.
**When**: Product decisions — roadmap prioritization, build-vs-buy analysis, competitive gap analysis.
**Structure**:
```
Product
├── Core capability A
│   ├── Feature A1
│   └── Feature A2
├── Core capability B
│   ├── Feature B1
│   └── Feature B2
└── Platform / Infrastructure
    ├── Feature P1
    └── Feature P2
```
**Example**: Decomposing a project management tool into task management, collaboration, reporting, and integrations — then scoring each against competitors to find gaps.

### Technology Stack Decomposition
**What**: Layer a system by infrastructure, platform, application, and interface.
**When**: Technical architecture decisions, migration planning, or diagnosing performance issues.
**Structure**:
```
Interface Layer    (UI, API, CLI)
Application Layer  (business logic, services)
Platform Layer     (databases, queues, auth, storage)
Infrastructure     (compute, network, CDN, DNS)
```
**Example**: Diagnosing API latency — decompose by layer and measure each. Discovery: the application layer is fast but the platform layer has a database query doing a full table scan.

### Fishbone (Ishikawa) Diagram
**What**: Categorize potential causes of a problem into standard groups: People, Process, Technology, Environment, Materials, Measurement.
**When**: Root cause analysis — when a problem has occurred and you need to systematically identify all possible causes.
**Structure**:
```
                People ──────┐
               Process ──────┤
            Technology ──────┼──→ [Problem]
           Environment ──────┤
           Measurement ──────┘
```
**Example**: "Why are deployments failing?" — People (new engineer, no pairing), Process (no staging environment), Technology (flaky CI), Environment (third-party API rate limits).

### Pyramid Principle
**What**: Structure communication as answer first, then supporting arguments, then evidence beneath each argument.
**When**: Communication and decision-making — when you need to present reasoning clearly to stakeholders.
**Structure**:
```
Answer / Recommendation
├── Argument 1
│   ├── Evidence 1a
│   └── Evidence 1b
├── Argument 2
│   ├── Evidence 2a
│   └── Evidence 2b
└── Argument 3
    ├── Evidence 3a
    └── Evidence 3b
```
**Example**: "We should acquire Company X" supported by (1) fills our product gap in analytics, (2) their team has expertise we cannot recruit, (3) cheaper than building — each backed by specific data.

### SWOT Matrix
**What**: Map Strengths, Weaknesses, Opportunities, and Threats in a 2x2 (internal/external x positive/negative).
**When**: Strategic assessment — quick orientation on a competitive position, new market, or major initiative.
**Structure**:

|  | Positive | Negative |
|---|---|---|
| **Internal** | Strengths | Weaknesses |
| **External** | Opportunities | Threats |

**Example**: Evaluating a new product line — Strength: existing customer base. Weakness: no domain expertise. Opportunity: competitors ignoring this segment. Threat: regulatory change could kill the market.

---

## Framework Selection Guide

| Problem Type | Best Framework(s) |
|---|---|
| Why is something broken? | Issue Tree, Fishbone |
| Validating a hypothesis | Hypothesis Tree |
| Financial diagnosis | Profitability Tree |
| Operational bottleneck | Process Flow Decomposition |
| Customer experience issue | Customer Journey Map |
| Competitive positioning | Value Chain Analysis, SWOT Matrix |
| Complex system behavior | Systems Map |
| Organizational / political | Stakeholder Map |
| Planning under uncertainty | Scenario Tree |
| Product roadmap decisions | Feature Tree |
| Technical architecture | Technology Stack Decomposition |
| Structuring any analysis | MECE Decomposition |
| Presenting recommendations | Pyramid Principle |
| Root cause analysis | Fishbone, Issue Tree |
| Strategic assessment | SWOT Matrix, Scenario Tree |
