/**
 * Map RPC address.kind → CAP-oriented label.
 * Advisory only — Task ≠ Agent window (CAP MATRIX).
 */
export function capLabelForKind(kind: string): string {
  switch (kind) {
    case "worker":
      return "Task";
    case "session":
      return "window";
    case "sdk":
      return "SDK";
    case "cli":
      return "CLI";
    case "broker":
      return "broker";
    default:
      return "unknown";
  }
}
