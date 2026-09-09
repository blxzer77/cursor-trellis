import { types as utilTypes } from "node:util";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_JSON_DEPTH = 64;
const MAX_JSON_NODES = 100_000;

/**
 * Validate an untrusted public input without invoking caller code.
 *
 * The accepted domain is deliberately narrower than arbitrary JavaScript:
 * plain Object/Array JSON trees with own enumerable data fields only. Native
 * Proxy detection happens before any reflective operation, and descriptors are
 * traversed without reading properties, so rejected accessors have zero reads.
 */
export function isPlainOwnDataJsonTreeV3(input: unknown): boolean {
  const active = new WeakSet<object>();
  let nodes = 0;

  const inspect = (value: unknown, depth: number): boolean => {
    nodes += 1;
    if (nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) return false;
    if (value === null || typeof value === "boolean") return true;
    if (typeof value === "string") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value !== "object" || utilTypes.isProxy(value)) return false;
    if (active.has(value)) return false;
    active.add(value);
    try {
      const prototype = Object.getPrototypeOf(value) as object | null;
      const ownKeys = Reflect.ownKeys(value);
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (ownKeys.some((key) => typeof key === "symbol")) return false;

      if (Array.isArray(value)) {
        if (prototype !== Array.prototype) return false;
        const lengthDescriptor = descriptors.length;
        if (
          !lengthDescriptor ||
          !("value" in lengthDescriptor) ||
          !Number.isSafeInteger(lengthDescriptor.value) ||
          lengthDescriptor.value < 0
        ) {
          return false;
        }
        const length = lengthDescriptor.value as number;
        if (ownKeys.length !== length + 1) return false;
        for (let index = 0; index < length; index += 1) {
          const descriptor = descriptors[String(index)];
          if (
            !descriptor ||
            !("value" in descriptor) ||
            descriptor.enumerable !== true ||
            !inspect(descriptor.value, depth + 1)
          ) {
            return false;
          }
        }
        return Object.keys(descriptors).every(
          (key) => key === "length" || /^(?:0|[1-9]\d*)$/u.test(key),
        );
      }

      if (prototype !== Object.prototype) return false;
      for (const key of Object.keys(descriptors)) {
        const descriptor = descriptors[key];
        if (
          FORBIDDEN_KEYS.has(key) ||
          !descriptor ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true ||
          !inspect(descriptor.value, depth + 1)
        ) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    } finally {
      active.delete(value);
    }
  };

  return inspect(input, 0);
}

/**
 * Return a null-prototype snapshot of an untrusted JSON object's own fields.
 *
 * Consumers can safely read missing keys from this record even when the host's
 * `Object.prototype` is polluted. Values are copied from data descriptors, not
 * through property access, after the complete nested tree has been validated.
 */
export function snapshotPlainOwnDataRecordV3(
  input: unknown,
): Readonly<Record<string, unknown>> | null {
  if (
    !isPlainOwnDataJsonTreeV3(input) ||
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    return null;
  }
  try {
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const snapshot = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(descriptors)) {
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor)) return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}
