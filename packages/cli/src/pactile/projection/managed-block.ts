/** Pure span operations: ambiguity never grants permission to edit. */
export const PACTILE_MARKERS = {
  start: "<!-- PACTILE:START -->",
  end: "<!-- PACTILE:END -->",
} as const;
export interface BlockMarkers {
  readonly start: string;
  readonly end: string;
}
export type MergeResult =
  | { readonly status: "merged"; readonly text: string }
  | { readonly status: "review"; readonly reason: string };
export type BlockSpan =
  | {
      readonly status: "present";
      readonly start: number;
      readonly end: number;
      readonly text: string;
    }
  | { readonly status: "absent" }
  | { readonly status: "review" };

export function inspectManagedBlock(
  text: string,
  markers: BlockMarkers = PACTILE_MARKERS,
): BlockSpan {
  if (!markers.start || !markers.end || markers.start === markers.end)
    return { status: "review" };
  const start = text.indexOf(markers.start);
  const end = text.indexOf(markers.end);
  if (start === -1 && end === -1) return { status: "absent" };
  if (
    start === -1 ||
    end < start + markers.start.length ||
    text.indexOf(markers.start, start + markers.start.length) !== -1 ||
    text.indexOf(markers.end, end + markers.end.length) !== -1
  )
    return { status: "review" };
  return {
    status: "present",
    start,
    end: end + markers.end.length,
    text: text.slice(start, end + markers.end.length),
  };
}

export function patchManagedBlock(
  current: string,
  replacement: string | null,
  markers: BlockMarkers = PACTILE_MARKERS,
  insertionOffset = current.length,
): MergeResult {
  const span = inspectManagedBlock(current, markers);
  if (span.status === "review")
    return { status: "review", reason: "ambiguous-markers" };
  if (replacement !== null) {
    const next = inspectManagedBlock(replacement, markers);
    if (next.status !== "present" || next.text !== replacement)
      return { status: "review", reason: "invalid-generated-block" };
  }
  if (span.status === "present")
    return {
      status: "merged",
      text:
        current.slice(0, span.start) +
        (replacement ?? "") +
        current.slice(span.end),
    };
  if (replacement === null) return { status: "merged", text: current };
  if (
    !Number.isInteger(insertionOffset) ||
    insertionOffset < 0 ||
    insertionOffset > current.length
  )
    return { status: "review", reason: "invalid-insertion-offset" };
  return {
    status: "merged",
    text:
      current.slice(0, insertionOffset) +
      (insertionOffset ? "\n\n" : "") +
      replacement +
      "\n" +
      current.slice(insertionOffset),
  };
}

/** Legacy facade escape hatch for replacing a proven span with an unmarked template. */
export function replaceManagedBlockSpan(
  current: string,
  replacement: string,
  markers: BlockMarkers,
): MergeResult {
  const span = inspectManagedBlock(current, markers);
  if (span.status !== "present")
    return { status: "review", reason: "missing-or-ambiguous-markers" };
  return {
    status: "merged",
    text: current.slice(0, span.start) + replacement + current.slice(span.end),
  };
}

export function mergeManagedBlock(
  current: string,
  previous: string | null,
  desired: string,
): MergeResult {
  const now = inspectManagedBlock(current),
    old = inspectManagedBlock(previous ?? ""),
    next = inspectManagedBlock(desired);
  if (
    now.status === "review" ||
    old.status === "review" ||
    next.status !== "present"
  )
    return { status: "review", reason: "ambiguous-markers" };
  const normalize = (text: string): string => text.replace(/\r\n/g, "\n");
  const oldText = old.status === "present" ? normalize(old.text) : null,
    nowText = now.status === "present" ? normalize(now.text) : null;
  if (nowText !== oldText && nowText !== normalize(next.text))
    return { status: "review", reason: "owned-region-modified" };
  return patchManagedBlock(current, normalize(next.text));
}
