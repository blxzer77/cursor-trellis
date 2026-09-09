import type { MergeResult } from "./managed-block.js";

interface JsonNode {
  start: number;
  end: number;
  value: unknown;
  fields?: Map<string, JsonNode>;
}

/** Strict JSON parser retaining source spans and rejecting duplicate decoded keys. */
function jsonDocument(text: string): JsonNode {
  let offset = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const whitespace = (): void => {
    while (/[\x20\t\r\n]/.test(text[offset] ?? "!") && offset < text.length)
      offset++;
  };
  const string = (): string => {
    const start = offset++;
    while (offset < text.length) {
      if (text[offset] === "\\") {
        offset += 2;
        continue;
      }
      if (text[offset++] === '"')
        return JSON.parse(text.slice(start, offset)) as string;
    }
    throw new Error("invalid-json");
  };
  const node = (): JsonNode => {
    whitespace();
    const start = offset;
    if (text[offset] === "{") {
      offset++;
      whitespace();
      const fields = new Map<string, JsonNode>();
      const value: Record<string, unknown> = Object.create(null) as Record<
        string,
        unknown
      >;
      if (text[offset] !== "}")
        while (true) {
          if (text[offset] !== '"') throw new Error("invalid-json");
          const key = string();
          whitespace();
          if (fields.has(key) || text[offset++] !== ":")
            throw new Error("duplicate-or-invalid-json");
          const child = node();
          fields.set(key, child);
          value[key] = child.value;
          whitespace();
          if (text[offset] !== ",") break;
          offset++;
          whitespace();
        }
      if (text[offset++] !== "}") throw new Error("invalid-json");
      return { start, end: offset, fields, value };
    }
    if (text[offset] === "[") {
      offset++;
      whitespace();
      const value: unknown[] = [];
      if (text[offset] !== "]")
        while (true) {
          value.push(node().value);
          whitespace();
          if (text[offset] !== ",") break;
          offset++;
          whitespace();
        }
      if (text[offset++] !== "]") throw new Error("invalid-json");
      return { start, end: offset, value };
    }
    if (text[offset] === '"') return { start, value: string(), end: offset };
    const token =
      /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
        text.slice(offset),
      );
    if (!token) throw new Error("invalid-json");
    offset += token[0].length;
    const value: unknown = JSON.parse(token[0]);
    if (
      typeof value === "number" &&
      (!Number.isFinite(value) ||
        (Number.isInteger(value) && !Number.isSafeInteger(value)))
    )
      throw new Error("unsafe-json-number");
    return { start, end: offset, value };
  };
  const root = node();
  whitespace();
  if (offset !== text.length) throw new Error("invalid-json");
  return root;
}
/** Strict duplicate-aware JSON for canonical state as well as projection documents. */
export function parseProjectionJson(text: string): unknown {
  jsonDocument(text);
  // M0 decoders deliberately accept plain JSON objects, not null-prototype maps.
  return JSON.parse(
    text.charCodeAt(0) === 0xfeff ? text.slice(1) : text,
  ) as unknown;
}
function pointerParts(pointer: string): string[] {
  if (!pointer.startsWith("/") || /~[^01]|~$/.test(pointer))
    throw new Error("invalid-pointer");
  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}
function at(root: JsonNode, parts: string[]): JsonNode | undefined {
  let cursor: JsonNode | undefined = root;
  for (const part of parts) cursor = cursor?.fields?.get(part);
  return cursor;
}
function same(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right))
    return (
      left.length === right.length &&
      left.every((item, index) => same(item, right[index]))
    );
  if (left && right && typeof left === "object" && typeof right === "object") {
    const a = left as Record<string, unknown>,
      b = right as Record<string, unknown>;
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every(
        (key) => Object.hasOwn(b, key) && same(a[key], b[key]),
      )
    );
  }
  return false;
}

/** Pointers own entire named subtrees. Arrays are not addressed by index. Missing parents/deletions require review. */
export function mergeJsonPointers(
  current: string,
  previous: string | null,
  desired: string,
  pointers: readonly string[],
): MergeResult {
  try {
    const now = jsonDocument(current),
      old = jsonDocument(previous ?? "{}"),
      next = jsonDocument(desired);
    const paths = pointers.map(pointerParts);
    if (
      !paths.length ||
      paths.some((a, i) =>
        paths.some(
          (b, j) =>
            i !== j &&
            a.length <= b.length &&
            a.every((part, k) => part === b[k]),
        ),
      )
    )
      throw new Error("overlapping-pointers");
    let result = current;
    for (const parts of paths) {
      const observed = at(now, parts),
        baseline = at(old, parts),
        replacement = at(next, parts);
      if (
        !replacement ||
        (!same(observed?.value, baseline?.value) &&
          !same(observed?.value, replacement.value))
      )
        throw new Error("owned-region-modified");
      const working = jsonDocument(result),
        span = at(working, parts);
      if (span)
        result =
          result.slice(0, span.start) +
          JSON.stringify(replacement.value) +
          result.slice(span.end);
      else {
        const parent = at(working, parts.slice(0, -1));
        if (!parent?.fields) throw new Error("missing-object-parent");
        const insertion = `${parent.fields.size ? "," : ""}${JSON.stringify(parts.at(-1))}:${JSON.stringify(replacement.value)}`;
        result =
          result.slice(0, parent.end - 1) +
          insertion +
          result.slice(parent.end - 1);
      }
    }
    jsonDocument(result);
    return { status: "merged", text: result };
  } catch {
    return { status: "review", reason: "unsafe-json-merge" };
  }
}

export interface TomlOwnedKey {
  readonly table: readonly string[];
  readonly key: string;
}
interface TomlSpan {
  start: number;
  end: number;
  value: string;
}
interface TomlDocument {
  keys: Map<string, TomlSpan>;
  tables: Map<string, number>;
}
const tomlIdentity = (key: TomlOwnedKey): string =>
  JSON.stringify([...key.table, key.key]);
const bare = /^[A-Za-z0-9_-]+$/;

/** TOML strings are not JSON strings: each Unicode escape must be a scalar. */
function validateTomlValue(value: string): void {
  let offset = 0;
  const invalid = (): never => {
    throw new Error("unsupported-toml-value");
  };
  const whitespace = (): void => {
    while (/[ \t]/.test(value[offset] ?? "!")) offset++;
  };
  const item = (): void => {
    whitespace();
    const quote = value[offset];
    if (quote === '"' || quote === "'") {
      offset++;
      while (offset < value.length) {
        const point = value.codePointAt(offset) ?? invalid();
        if (value[offset] === quote) {
          offset++;
          return;
        }
        if (
          (point < 0x20 && point !== 9) ||
          point === 0x7f ||
          (point >= 0xd800 && point <= 0xdfff)
        )
          invalid();
        if (quote === '"' && value[offset] === "\\") {
          const escape = value[++offset];
          if (escape === "u" || escape === "U") {
            const length = escape === "u" ? 4 : 8;
            const digits = value.slice(offset + 1, offset + 1 + length);
            if (digits.length !== length || !/^[0-9a-fA-F]+$/.test(digits))
              invalid();
            const scalar = Number.parseInt(digits, 16);
            if (scalar > 0x10ffff || (scalar >= 0xd800 && scalar <= 0xdfff))
              invalid();
            offset += length + 1;
          } else {
            if (!escape || !'"\\btnfr'.includes(escape)) invalid();
            offset++;
          }
        } else offset += point > 0xffff ? 2 : 1;
      }
      invalid();
    }
    if (value[offset] === "[") {
      offset++;
      whitespace();
      while (value[offset] !== "]") {
        item();
        whitespace();
        if (value[offset] === "]") break;
        if (value[offset++] !== ",") invalid();
        whitespace();
      }
      offset++;
      return;
    }
    const token = /^[^,\] \t]+/.exec(value.slice(offset))?.[0];
    if (
      !token ||
      !/^(?:true|false|[+-]?(?:(?:0|[1-9]\d*)(?:\.\d+)?|inf|nan))$/.test(token)
    )
      return invalid();
    offset += token.length;
  };
  item();
  whitespace();
  if (offset !== value.length) invalid();
}

/** Conservative TOML subset: bare table/key names and single-line scalar/array values. Unsupported syntax is review, never reserialized. */
function tomlDocument(text: string): TomlDocument {
  const keys = new Map<string, TomlSpan>(),
    tables = new Map<string, number>();
  const assigned = new Set<string>();
  let table: string[] = [],
    offset = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  tables.set("", text.length);
  for (const line of text.slice(offset).match(/[^\n]*(?:\n|$)/g) ?? []) {
    if (!line) continue;
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const header = /^\[([A-Za-z0-9_.-]+)\]\s*(?:#.*)?$/.exec(trimmed);
      if (header) {
        const name = header[1],
          parts = name.split(".");
        if (!parts.every((part) => bare.test(part)) || tables.has(name))
          throw new Error("ambiguous-toml-table");
        if (
          parts.some((_, index) =>
            assigned.has(parts.slice(0, index + 1).join(".")),
          )
        )
          throw new Error("toml-key-table-conflict");
        tables.set(table.join("."), offset);
        table = parts;
        tables.set(name, text.length);
      } else {
        const assignment =
          /^(\s*)([A-Za-z0-9_-]+)(\s*=\s*)(.*?)(?:\r?\n)?$/.exec(line);
        if (!assignment) throw new Error("unsupported-toml");
        const raw = assignment[4];
        let quote = "",
          escaped = false,
          depth = 0,
          end = raw.length;
        for (let i = 0; i < raw.length; i++) {
          const ch = raw[i];
          if (quote) {
            if (escaped) escaped = false;
            else if (ch === "\\" && quote === '"') escaped = true;
            else if (ch === quote) quote = "";
          } else if (ch === '"' || ch === "'") quote = ch;
          else if (ch === "[") depth++;
          else if (ch === "]") {
            if (--depth < 0) throw new Error("invalid-toml");
          } else if (ch === "#") {
            end = i;
            break;
          }
        }
        if (quote || depth !== 0) throw new Error("multiline-or-invalid-toml");
        const value = raw.slice(0, end).trimEnd();
        validateTomlValue(value);
        const id = tomlIdentity({ table, key: assignment[2] });
        if (keys.has(id)) throw new Error("duplicate-toml-key");
        const dotted = [...table, assignment[2]].join(".");
        if (
          [...tables.keys()].some(
            (name) => name === dotted || name.startsWith(dotted + "."),
          )
        )
          throw new Error("toml-key-table-conflict");
        assigned.add(dotted);
        const start =
          offset +
          assignment[1].length +
          assignment[2].length +
          assignment[3].length;
        keys.set(id, { start, end: start + value.length, value });
      }
    }
    offset += line.length;
  }
  return { keys, tables };
}

export function mergeTomlKeys(
  current: string,
  previous: string | null,
  desired: string,
  owned: readonly TomlOwnedKey[],
): MergeResult {
  try {
    const now = tomlDocument(current),
      old = tomlDocument(previous ?? ""),
      next = tomlDocument(desired);
    const identities = owned.map(tomlIdentity);
    if (
      !owned.length ||
      new Set(identities).size !== owned.length ||
      owned.some(
        (item) =>
          !bare.test(item.key) || !item.table.every((part) => bare.test(part)),
      )
    )
      throw new Error("invalid-owned-keys");
    let result = current;
    for (const key of owned) {
      const id = tomlIdentity(key),
        observed = now.keys.get(id),
        baseline = old.keys.get(id),
        replacement = next.keys.get(id);
      if (
        !replacement ||
        (observed?.value !== baseline?.value &&
          observed?.value !== replacement.value)
      )
        throw new Error("owned-region-modified");
      const working = tomlDocument(result),
        span = working.keys.get(id);
      if (span)
        result =
          result.slice(0, span.start) +
          replacement.value +
          result.slice(span.end);
      else {
        const tableName = key.table.join("."),
          position = working.tables.get(tableName) ?? result.length;
        const header = working.tables.has(tableName) ? "" : `[${tableName}]\n`;
        const addition =
          (position && result[position - 1] !== "\n" ? "\n" : "") +
          header +
          `${key.key} = ${replacement.value}\n`;
        result = result.slice(0, position) + addition + result.slice(position);
      }
    }
    tomlDocument(result);
    return { status: "merged", text: result };
  } catch {
    return { status: "review", reason: "unsafe-toml-merge" };
  }
}
