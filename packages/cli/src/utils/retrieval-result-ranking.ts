export type RetrievalRankingIntent =
  | "caller-chain"
  | "trap-package-disambiguation"
  | "env-config-literal"
  | "exact-symbol-path"
  | "protocol-platform-preserve"
  | string;

export interface RetrievalResultCandidate {
  path: string;
  baseRank: number;
  score?: number;
  matchedIntents?: RetrievalRankingIntent[];
  evidenceType?:
    | "caller-callsite"
    | "assembly"
    | "trap"
    | "env-script"
    | "implementation"
    | "protocol"
    | string;
  sourceRole?: string;
  corroborated?: boolean;
  expectedHint?: boolean;
  trapHint?: boolean;
  exactPreserve?: boolean;
}

export interface RankedRetrievalResultCandidate extends RetrievalResultCandidate {
  adjustedScore: number;
  rankingReasons: string[];
}

export interface RankRetrievalResultOptions {
  intents: RetrievalRankingIntent[];
  topK?: number;
  expandedPoolSize?: number;
  callerPoolExpansion?: {
    enabled: boolean;
    minConcreteCallers: number;
  };
}

export interface RankedRetrievalResult {
  expandedPoolSize: number;
  expandedPool: RankedRetrievalResultCandidate[];
  topCandidates: RankedRetrievalResultCandidate[];
  warnings: string[];
}

function includesIntent(
  intents: readonly RetrievalRankingIntent[],
  target: RetrievalRankingIntent,
): boolean {
  return intents.includes(target);
}

function normalizedPath(candidatePath: string): string {
  return candidatePath.replace(/\\/g, "/").toLowerCase();
}

function isAssemblyOnlyCandidate(candidate: RetrievalResultCandidate): boolean {
  const path = normalizedPath(candidate.path);
  return (
    candidate.evidenceType === "assembly" ||
    /(?:facade|loader|barrel|runtime|registry|snapshot)/i.test(candidate.sourceRole ?? "") ||
    /(?:facade|loader|barrel|runtime|registry|snapshot)/i.test(path)
  );
}

function isConcreteCallerCandidate(candidate: RetrievalResultCandidate): boolean {
  return candidate.evidenceType === "caller-callsite" || /caller|callsite/i.test(candidate.sourceRole ?? "");
}

function isTrapCandidate(candidate: RetrievalResultCandidate): boolean {
  const path = normalizedPath(candidate.path);
  return (
    candidate.trapHint === true ||
    candidate.evidenceType === "trap" ||
    /plugin-registry-snapshot|registry-snapshot|snapshot\.ts$/.test(path) ||
    /\/src\/agents\//.test(path)
  );
}

function isEnvPriorityPath(candidate: RetrievalResultCandidate): boolean {
  const path = normalizedPath(candidate.path);
  return /(^|\/)(scripts|e2e|bench|benches|\.github|ci|config|configs|test|tests)(\/|$)/.test(
    path,
  );
}

function isGenericEnvImplementationPath(candidate: RetrievalResultCandidate): boolean {
  const path = normalizedPath(candidate.path);
  return /(^|\/)src\/(auth|paths?|state|config)(\/|\.|$)/.test(path);
}

function baseScore(candidate: RetrievalResultCandidate): number {
  return candidate.score ?? 1000 - candidate.baseRank;
}

function scoreCandidate(
  candidate: RetrievalResultCandidate,
  intents: readonly RetrievalRankingIntent[],
): RankedRetrievalResultCandidate {
  let adjustedScore = baseScore(candidate);
  const rankingReasons: string[] = [];
  const exactPreserve =
    candidate.exactPreserve === true ||
    includesIntent(candidate.matchedIntents ?? [], "protocol-platform-preserve") ||
    includesIntent(candidate.matchedIntents ?? [], "exact-symbol-path");

  if (exactPreserve) {
    adjustedScore += 1000;
    rankingReasons.push("exact-preserve-protected");
  }

  if (!exactPreserve && includesIntent(intents, "caller-chain")) {
    if (isConcreteCallerCandidate(candidate)) {
      adjustedScore += 150;
      rankingReasons.push("concrete-caller-boost");
    }
    if (isAssemblyOnlyCandidate(candidate)) {
      adjustedScore -= 120;
      rankingReasons.push("assembly-only-demotion");
    }
  }

  if (!exactPreserve && includesIntent(intents, "trap-package-disambiguation")) {
    if (isTrapCandidate(candidate) && !candidate.expectedHint) {
      adjustedScore -= 250;
      rankingReasons.push("trap-demotion");
    }
    if (candidate.corroborated && !isTrapCandidate(candidate)) {
      adjustedScore += 80;
      rankingReasons.push("corroborated-non-trap-boost");
    }
  }

  if (!exactPreserve && includesIntent(intents, "env-config-literal")) {
    if (isEnvPriorityPath(candidate)) {
      adjustedScore += 140;
      rankingReasons.push("env-script-priority");
    }
    if (isGenericEnvImplementationPath(candidate)) {
      adjustedScore -= 100;
      rankingReasons.push("generic-env-implementation-demotion");
    }
  }

  return {
    ...candidate,
    adjustedScore,
    rankingReasons,
  };
}

export function rankRetrievalResultCandidates(
  candidates: readonly RetrievalResultCandidate[],
  options: RankRetrievalResultOptions,
): RankedRetrievalResult {
  const topK = options.topK ?? 5;
  const expandedPoolSize = options.expandedPoolSize ?? Math.max(topK * 3, topK);
  const warnings: string[] = [];

  const ranked = candidates
    .map((candidate) => scoreCandidate(candidate, options.intents))
    .sort((a, b) => {
      if (b.adjustedScore !== a.adjustedScore) return b.adjustedScore - a.adjustedScore;
      return a.baseRank - b.baseRank;
    });

  let expandedPool = ranked.slice(0, expandedPoolSize);

  const callerExpansion = options.callerPoolExpansion;
  if (callerExpansion?.enabled && includesIntent(options.intents, "caller-chain")) {
    const concreteCallersInPool = expandedPool.filter((c) => isConcreteCallerCandidate(c));
    const concreteCallerPaths = new Set(concreteCallersInPool.map((c) => normalizedPath(c.path)));

    if (concreteCallersInPool.length < callerExpansion.minConcreteCallers) {
      const outsidePool = ranked.slice(expandedPoolSize);
      for (const candidate of outsidePool) {
        if (
          isConcreteCallerCandidate(candidate) &&
          !concreteCallerPaths.has(normalizedPath(candidate.path))
        ) {
          expandedPool.push(candidate);
          concreteCallerPaths.add(normalizedPath(candidate.path));
          if (expandedPool.filter((c) => isConcreteCallerCandidate(c)).length >= callerExpansion.minConcreteCallers) {
            break;
          }
        }
      }
    }

    const finalConcreteCount = expandedPool.filter((c) => isConcreteCallerCandidate(c)).length;
    if (finalConcreteCount < callerExpansion.minConcreteCallers) {
      warnings.push(
        `caller-pool-expansion: only ${finalConcreteCount} concrete callers found, below minConcreteCallers=${callerExpansion.minConcreteCallers}`,
      );
    }
  }

  return {
    expandedPoolSize,
    expandedPool,
    topCandidates: expandedPool.slice(0, topK),
    warnings,
  };
}

export interface PagedCallerResult {
  callers: RetrievalResultCandidate[];
  pagesConsumed: number;
  deduplicatedCount: number;
}

export function pagedCallerAggregation(
  initialCallers: readonly RetrievalResultCandidate[],
  maxPages: number,
  fetchPage: (page: number) => RetrievalResultCandidate[],
): PagedCallerResult {
  const seen = new Map<string, RetrievalResultCandidate>();

  for (const caller of initialCallers) {
    const key = normalizedPath(caller.path);
    const existing = seen.get(key);
    if (existing) {
      if (caller.sourceRole && !existing.sourceRole) {
        seen.set(key, { ...existing, sourceRole: caller.sourceRole });
      }
    } else {
      seen.set(key, { ...caller });
    }
  }

  let pagesConsumed = 0;
  for (let page = 1; page <= maxPages; page++) {
    const pageResults = fetchPage(page);
    pagesConsumed = page;
    if (pageResults.length === 0) break;

    for (const caller of pageResults) {
      const key = normalizedPath(caller.path);
      const existing = seen.get(key);
      if (existing) {
        if (caller.sourceRole && !existing.sourceRole) {
          seen.set(key, { ...existing, sourceRole: caller.sourceRole });
        }
      } else {
        seen.set(key, { ...caller });
      }
    }
  }

  const callers = Array.from(seen.values());
  const deduplicatedCount = callers.length;

  return { callers, pagesConsumed, deduplicatedCount };
}

