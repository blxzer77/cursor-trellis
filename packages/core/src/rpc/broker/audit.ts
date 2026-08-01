import type { RpcEnvelope } from "../contract/types.js";

export interface RpcAuditEntry {
  seq: number;
  ts: string;
  kind: string;
  detail: Record<string, unknown>;
}

export class RpcAuditLog {
  private seq = 0;
  private readonly entries: RpcAuditEntry[] = [];

  append(kind: string, detail: Record<string, unknown> = {}): RpcAuditEntry {
    const entry: RpcAuditEntry = {
      seq: ++this.seq,
      ts: new Date().toISOString(),
      kind,
      detail,
    };
    this.entries.push(entry);
    return entry;
  }

  appendEnvelope(kind: string, envelope: RpcEnvelope): RpcAuditEntry {
    return this.append(kind, {
      id: envelope.id,
      type: envelope.type,
      method: envelope.method ?? null,
      event: envelope.event ?? null,
      from: envelope.from,
      to: envelope.to ?? null,
      correlationId: envelope.correlationId ?? null,
      topic: envelope.topic ?? null,
    });
  }

  list(): readonly RpcAuditEntry[] {
    return this.entries;
  }

  get size(): number {
    return this.entries.length;
  }
}
