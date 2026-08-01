import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export function isWebSocketUpgrade(req: IncomingMessage): boolean {
  const upgrade = String(req.headers.upgrade ?? "").toLowerCase();
  const connection = String(req.headers.connection ?? "").toLowerCase();
  return upgrade === "websocket" && connection.includes("upgrade");
}

export function acceptWebSocket(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): MinimalWebSocket | null {
  const key = req.headers["sec-websocket-key"];
  if (typeof key !== "string" || key.length === 0) {
    socket.destroy();
    return null;
  }
  const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      "\r\n",
  );
  if (head.length > 0) {
    socket.unshift(head);
  }
  return new MinimalWebSocket(socket);
}

/** Minimal text-frame WebSocket for localhost CORE (no external deps). */
export class MinimalWebSocket {
  private buffer = Buffer.alloc(0);
  private closed = false;
  private readonly messageListeners = new Set<(data: string) => void>();
  private readonly closeListeners = new Set<() => void>();

  constructor(private readonly socket: Duplex) {
    socket.on("data", (chunk: Buffer) => this.onData(chunk));
    socket.on("close", () => this.finishClose());
    socket.on("error", () => this.finishClose());
  }

  onMessage(listener: (data: string) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onClose(listener: () => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  send(text: string): void {
    if (this.closed) return;
    const payload = Buffer.from(text, "utf8");
    const len = payload.length;
    let header: Buffer;
    if (len < 126) {
      header = Buffer.from([0x81, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(len, 6);
    }
    this.socket.write(Buffer.concat([header, payload]));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.socket.write(Buffer.from([0x88, 0x00]));
    } catch {
      // ignore
    }
    this.socket.destroy();
    this.finishClose();
  }

  private finishClose(): void {
    if (this.closeListeners.size === 0 && this.messageListeners.size === 0) {
      this.closed = true;
      return;
    }
    this.closed = true;
    for (const listener of this.closeListeners) listener();
    this.closeListeners.clear();
    this.messageListeners.clear();
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      if (first === undefined || second === undefined) return;
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let payloadLen = second & 0x7f;
      let offset = 2;
      if (payloadLen === 126) {
        if (this.buffer.length < 4) return;
        payloadLen = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (this.buffer.length < 10) return;
        const high = this.buffer.readUInt32BE(2);
        const low = this.buffer.readUInt32BE(6);
        if (high !== 0 || low > 0x7fffffff) {
          this.close();
          return;
        }
        payloadLen = low;
        offset = 10;
      }
      const maskLen = masked ? 4 : 0;
      const total = offset + maskLen + payloadLen;
      if (this.buffer.length < total) return;
      let payload = this.buffer.subarray(offset + maskLen, total);
      if (masked) {
        const mask = this.buffer.subarray(offset, offset + 4);
        const decoded = Buffer.alloc(payloadLen);
        for (let i = 0; i < payloadLen; i++) {
          const b = payload[i] ?? 0;
          const m = mask[i % 4] ?? 0;
          decoded[i] = b ^ m;
        }
        payload = decoded;
      }
      this.buffer = this.buffer.subarray(total);

      if (opcode === 0x8) {
        this.close();
        return;
      }
      if (opcode === 0x9) {
        const pongHeader = Buffer.from([0x8a, payload.length]);
        this.socket.write(Buffer.concat([pongHeader, payload]));
        continue;
      }
      if (opcode === 0x1) {
        const text = payload.toString("utf8");
        for (const listener of this.messageListeners) listener(text);
      }
    }
  }
}
