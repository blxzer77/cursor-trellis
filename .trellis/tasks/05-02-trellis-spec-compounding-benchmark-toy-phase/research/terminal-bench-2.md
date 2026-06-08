# Research: Terminal-Bench 2.0 (TB2.0 / TerminalBench-2)

- **Query**: Can we reuse Terminal-Bench 2.0's 89-task corpus as the substrate for a Trellis spec-compounding benchmark? Find canonical source, license, task structure, harness, tool restrictions, reproducibility caveats.
- **Scope**: external
- **Date**: 2026-05-02
- **Sources verified**: GitHub repos `harbor-framework/terminal-bench-2`, `harbor-framework/harbor`, registry pages on tbench.ai, arXiv preprint, OpenReview PDF.

---

## 1. Where the dataset is hosted

- **Canonical task repo**: https://github.com/harbor-framework/terminal-bench-2 — 89 task directories at the repo root, plus `LICENSE` and `README.md`. (The README still references `https://github.com/laude-institute/terminal-bench-2`, but the GitHub API confirms the live repo lives under the `harbor-framework` org; the laude-institute URL redirects.) 212 stars / 71 forks at time of research.
- **Registry / download mechanism**: The Harbor CLI auto-downloads via `harbor run --dataset terminal-bench@2.0 ...`. The web registry is browseable at https://www.tbench.ai/registry/terminal-bench/2.0 (per-task pages) and https://www.tbench.ai/benchmarks/terminal-bench-2 (filterable list).
- **Leaderboard**: https://www.tbench.ai/leaderboard/terminal-bench/2.0 — official; community-mirrored at vals.ai, llm-stats.com, benchlm.ai.
- **HuggingFace**: Two unofficial mirrors exist (`DCAgent2/terminal_bench_2` and `Agent625/terminal-bench-2` — the latter explicitly states "read-only mirror, primary source is GitHub"). Don't rely on these as canonical.
- **Paper**: arXiv preprint "Terminal-Bench: Benchmarking Agents on Hard, Realistic Tasks in Command Line Interfaces" (https://arxiv.org/pdf/2601.11868), and OpenReview submission https://openreview.net/pdf?id=a7Qa4CcHak. Both describe TB 2.0's 89-task curation process from 229 crowdsourced submissions, plus baseline numbers (frontier <65 percent, smaller models ~15 percent).
- **Citation**: BibTeX `@misc{tbench_2025, ...}` from README — note the citation URL still points at the older `laude-institute/terminal-bench`.

## 2. License — can we re-evaluate and publish?

- **License**: **Apache-2.0** (verified via `gh api repos/harbor-framework/terminal-bench-2 --jq .license.spdx_id` → `Apache-2.0`; same for the Harbor harness repo).
- **Implication for our use**: Apache-2.0 is permissive. We can:
  - Fork / mirror the 89 tasks (must retain the LICENSE + NOTICE).
  - Run our own harness (Trellis-driven) against those tasks.
  - Publish numbers with attribution.
  - Modify task copies (must mark the changes per Apache-2.0 § 4(b)).
- **No "no benchmark contamination" clause** in LICENSE. Standard recommendation: don't redistribute the encrypted `protected.tar.gz.enc` payloads recklessly (they hold hidden test fixtures), but Apache-2.0 doesn't prohibit it.
- The README explicitly invites third-party agent integration (`harbor run --agent claude-code ...`), confirming the maintainers expect external evaluators to publish results.

## 3. Task structure (per-task layout)

Each of the 89 directories follows an identical schema (verified on `adaptive-rejection-sampler` and `protein-assembly`):

```
<task-name>/
├── README.md                # task metadata for humans
├── instruction.md           # natural-language prompt the agent receives
├── task.toml                # machine-readable spec (schema_version = "1.1")
├── environment/
│   ├── Dockerfile           # build context for the task container
│   └── protected.tar.gz.enc # encrypted hidden assets (decrypted inside container at test time)
├── solution/
│   └── solve.sh             # oracle / reference solution (bash entrypoint)
└── tests/
    ├── test.sh              # verifier entrypoint (the "outer" grader)
    └── test_outputs.py      # pytest assertions against agent's outputs
```

### `task.toml` keys (representative)

```toml
schema_version = "1.1"
[task]            # name, description, keywords, authors
[metadata]        # difficulty (easy|medium|hard), category, tags,
                  # expert_time_estimate_min, junior_time_estimate_min
[verifier]        # timeout_sec
[agent]           # timeout_sec  (e.g. 900s = 15 min default)
[environment]     # build_timeout_sec, docker_image (pre-built, e.g.
                  # "alexgshaw/<task-name>:20251031"),
                  # cpus = 1, memory_mb = 2048, storage_mb = 10240,
                  # gpus = 0, allow_internet = true, mcp_servers = []
```

Key insights:
- **Pre-built images are pinned**: every task references `alexgshaw/<task>:20251031` on Docker Hub. Builds during evaluation are normally skipped — agents run inside the published image. Reproducibility hinges on those Docker Hub tags staying alive.
- **Resource budget is uniform**: 1 CPU, 2 GB RAM, 10 GB disk, 0 GPU across the tasks I sampled. (Some ML tasks like `caffe-cifar-10` still set `gpus = 0` — the model trains on CPU, slowly.)
- **No per-task starting repo**: tasks start from a Docker image that already has the workspace set up (e.g. `WORKDIR /app`); the agent operates in a live shell. This is **not** a SWE-Bench-style "patch this git repo" setup. It is a "do work in a container" setup.

### Grading mechanism (pass/fail = binary 0/1)

`tests/test.sh` is a bash script run by the verifier sidecar after the agent finishes. Example from `adaptive-rejection-sampler`:

```bash
apt-get install -y curl
curl -LsSf https://astral.sh/uv/0.9.5/install.sh | sh
source $HOME/.local/bin/env
uvx -p 3.13 -w pytest==8.4.1 -w numpy==2.3.3 -w scipy==1.16.2 \
    -w pytest-json-ctrf==0.3.5 \
    pytest --ctrf /logs/verifier/ctrf.json /tests/test_outputs.py -rA

if [ $? -eq 0 ]; then echo 1 > /logs/verifier/reward.txt
else echo 0 > /logs/verifier/reward.txt
fi
```

So:
- Verifier installs its own deps **inside the task container** post-agent (no shared verifier env across tasks).
- A single `pytest` run against `test_outputs.py` decides the binary reward.
- All-or-nothing: any failing assertion → 0. Pytest CTRF JSON reports are written to `/logs/verifier/ctrf.json` for diagnostics.
- The agent never sees `tests/`; tests are mounted into the container only at verification time.
- Hidden assets (ground-truth answers, test inputs) live in `environment/protected.tar.gz.enc` — encrypted at rest in the GitHub repo and decrypted by the verifier with a key not bundled in the agent's view.

### The 89 tasks: category distribution (counted from every `task.toml`)

| Category              | Count |
|-----------------------|-------|
| software-engineering  | 26    |
| system-administration | 9     |
| security              | 8     |
| scientific-computing  | 8     |
| data-science          | 8     |
| file-operations       | 5     |
| debugging             | 5     |
| model-training        | 4     |
| mathematics           | 4     |
| data-processing       | 4     |
| machine-learning      | 3     |
| video-processing      | 1     |
| personal-assistant    | 1     |
| optimization          | 1     |
| games                 | 1     |
| data-querying         | 1     |
| **Total**             | **89** |

Difficulty mix: 4 easy, 55 medium, 30 hard.

Network: **all 89 tasks set `allow_internet = true`** (no offline tasks).

Diversity examples (task slugs): `protein-assembly`, `feal-differential-cryptanalysis`, `make-doom-for-mips`, `compile-compcert`, `cobol-modernization`, `path-tracing-reverse`, `mteb-leaderboard`, `sam-cell-seg`, `qemu-alpine-ssh`, `install-windows-3.11`, `regex-chess`, `gpt2-codegolf`. Domains range from systems programming and reverse engineering to bioinformatics, statistics, and ML training. The "code translation" angle the user mentioned shows up as `cobol-modernization`, `rstan-to-pystan`, `polyglot-c-py`, `polyglot-rust-c`. Cryptanalysis: `feal-differential-cryptanalysis`, `feal-linear-cryptanalysis`, `crack-7z-hash`, `password-recovery`. Bioinformatics: `dna-assembly`, `dna-insert`, `protein-assembly`, `sam-cell-seg`. ML setup / training: `caffe-cifar-10`, `train-fasttext`, `pytorch-model-cli`, `pytorch-model-recovery`, `count-dataset-tokens`, `torch-pipeline-parallelism`, `torch-tensor-parallelism`, `llm-inference-batching-scheduler`.

## 4. Existing harness / runner

- **Official harness**: **Harbor** — https://github.com/harbor-framework/harbor (Apache-2.0, Python, 1.7k stars). This is the **only** supported harness for TB 2.0 submissions per the README ("Submissions must use terminal-bench@2.0 via Harbor"). It replaces the legacy `terminal-bench` repo's eval harness.
- **Install**: `uv tool install harbor` or `pip install harbor`.
- **Run**: `harbor run --dataset terminal-bench@2.0 --agent <name> --model <id> --n-concurrent N`.
- **Built-in agent adapters**: `oracle` (runs `solution/solve.sh`, sanity check), `terminus-2` (Harbor's reference loop agent), `claude-code`, `codex` (per EvalScope docs). Custom agents extend `BaseInstalledAgent` or `BaseAgent` — example: https://github.com/laude-institute/harbor/blob/main/src/harbor/agents/installed/claude_code.py (URL from the README; lives under harbor-framework org now).
- **Sandbox providers**: Harbor wraps multiple — for the paper authors used **Daytona** at 32–100 concurrent containers. Local Docker is also supported. Daytona is the cloud option that matters for budget calculations.
- **Auxiliary**: `terminus-2` is the Terminal-Bench team's own agent loop (open source inside Harbor); `Terminus-KIRA` (KRAFTON AI) and `terminus-kira` mentioned in leaderboard are forks/variants of `terminus-2`. Forking `terminus-2` is the cheapest path to a custom agent.
- **Independent third-party runner**: **EvalScope** (https://evalscope.readthedocs.io/en/latest/benchmarks/terminal_bench_v2.html) provides an alternative runner under `--datasets terminal_bench_v2`, supporting `terminus-2 / claude-code / codex` agents — useful as a sanity-check second opinion.
- **Legacy v1 harness** (`terminal-bench-core==0.1.1`) is not used for v2 submissions.

## 5. Tool allowance — does the harness restrict tools?

- **No central toolbelt restriction.** Harbor delegates *what the agent does inside the container* entirely to the agent adapter. The verifier only checks the final state of the container against `tests/test_outputs.py`.
- `task.toml` sets `mcp_servers = []` and `allow_internet = true` for every sampled task — meaning agents can pull packages, hit APIs, fetch model weights, etc. There is **no enforced tool whitelist**; each agent (Claude Code, Codex CLI, Terminus-2, custom) brings its own toolbelt and prompting.
- The "fairness" comparison is at the agent level, not the tool level — leaderboard rows pair `(agent, model)` and the agent owns tool definitions. So we are free to use the Trellis toolbelt (file I/O, bash, git, Trellis-specific spec injection, etc.) inside the container.
- Resource caps (1 CPU / 2 GB RAM / 0 GPU / 15-min agent timeout / 15-min verifier timeout) are enforced by Harbor at the container level — those *are* the constraint to plan around.

## 6. Reproducibility constraints

- **Network-required**: 89/89 tasks have `allow_internet = true`. Many `test.sh` scripts (e.g. `adaptive-rejection-sampler/tests/test.sh` curls `astral.sh/uv/0.9.5/install.sh` and `pip install`s pinned packages at verify time) — if PyPI / astral / Docker Hub / HuggingFace go down, the eval breaks. This is structural, not a per-task quirk.
- **External resource pinning**: tasks like `mteb-retrieve` pin a HuggingFace model revision (`bge-small-zh-v1.5 @ 7999e1d3...`). If HuggingFace removes that revision, the task becomes unrunnable. There's no offline mirror in the dataset.
- **Docker image pinning**: every `task.toml` references `alexgshaw/<task>:20251031`. Loss of that Docker Hub account or tag deletion would brick the whole benchmark. Recommend mirroring the images we plan to use to our own registry.
- **Stochastic outputs** in some tasks: e.g. `adaptive-rejection-sampler` instruction explicitly says "the output is stochastic" — graders use statistical comparisons (mean/std band), but those bands could still produce false negatives at low frequency. Similar concern for `mcmc-sampling-stan`, `bn-fit-modify`, `tune-mjcf`.
- **Time-sensitive content**: `mteb-leaderboard` task asks for "best embedding model … as of August 2025" (live data scrape from a leaderboard webpage). Result correctness depends on the live state of an external site — likely flaky over time as MTEB updates.
- **Long agent timeouts**: 900 s (15 min) per task is the default for both agent and verifier phases. Running 89 tasks × N seeds in series → ~22 N hours single-stream; budget concurrency (n=32–100) the way the paper did.
- **Non-determinism noted by re-evaluators**: vals.ai writeup explicitly switched from "turn limit" (legacy) to "time limit" (TB 2.0) and runs remotely on Daytona — implying that wall-clock variance can affect scores. Their reproductions deviate up to a few percent vs. the official leaderboard for the same `(agent, model)` pair.
- **No public failure-mode CSV per task**, but the OpenReview paper Table 2 shows confidence intervals of ~±3 percent at the dataset level — useful as a sanity bar for our own variance.

---

## Implications for our benchmark

- **Reuse is legally clean**: Apache-2.0 + permissive README → fork the 89 tasks, run our own Trellis-driven harness, publish.
- **Substrate compatibility check**: our spec-compounding harness needs to drop into the same container interface that Harbor uses (mount agent, run, then mount `tests/`). Easiest path: implement a Harbor `BaseAgent` adapter that internally runs the Trellis loop. This avoids forking the dataset format entirely and gives us free comparability with leaderboard rows.
- **Substrate caveats for "spec compounding"**:
  - Tasks have no starting source repo — they're "build from scratch in a fresh container" tasks. Our spec-compounding hypothesis ("Trellis specs accumulated from earlier tasks help on later ones") needs tasks where prior context is *applicable*. The 26 `software-engineering` + 9 `system-administration` tasks are the most likely substrate for cross-task spec transfer; the bioinformatics / cryptanalysis / scientific-computing tasks are largely self-contained problem-solving and may not benefit from compounded specs.
  - Tests are **all-or-nothing pytest** with hidden fixtures. Partial-credit signal is not available without modifying `test_outputs.py` per task — possible but increases scope.
  - Time-bounded (15 min agent, 15 min verifier). Spec-compounding workflows that read large spec libraries need to fit in that budget.
- **Operational risks to mitigate before relying on TB2.0 long-term**:
  1. Mirror all 89 Docker images (`alexgshaw/*:20251031`) to our own registry.
  2. Skip or replace `mteb-leaderboard` (live web dependency) and possibly `mteb-retrieve` (HuggingFace revision dependency) for stable scoring.
  3. Run baseline + ours on the same Daytona/Docker substrate in the same week to control for upstream PyPI/network flakiness.
  4. Budget for ~3 percent run-to-run variance per the paper's CI; need ≥3 seeds per (agent, model, task) for meaningful spec-compounding deltas.
- **Existing runner to fork**: `terminus-2` (lives in `harbor` repo under `src/harbor/agents/`) is the smallest reference loop agent and Apache-2.0. Forking it to inject Trellis spec context is the lowest-friction starting point.

---

## Caveats / Not Found

- I did not pull the `terminus-2` source to count lines / read the loop in detail — only confirmed it exists inside the harbor repo. Worth a follow-up read if we plan to fork.
- Harbor's exact contract for filesystem isolation between agent and verifier (e.g. whether the agent can read `/tests` if it tries to `find /` early) was not fully verified — `tests/` is mounted by the verifier, so it should not be present during the agent phase, but a Harbor source read would confirm.
- I did not verify whether the encrypted `protected.tar.gz.enc` decryption key is shipped inside the Docker image or fetched at verify time. Either way it's outside the agent's view.
- The 4 "easy" tasks were not enumerated; if we want a smoke-test subset, list them by re-grepping `task.toml`.
- The exact pricing / quota for Daytona-hosted runs at "32–100 containers in parallel" wasn't part of this research scope.

