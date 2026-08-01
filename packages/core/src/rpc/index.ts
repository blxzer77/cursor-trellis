// Public RPC-FULL CORE surface (protocol v1).

export {
  RPC_ERROR_CODES,
  RPC_ERROR_CODE_SET,
  RpcError,
  parseRpcErrorCode,
  parseRpcErrorBody,
  type RpcErrorCode,
  type RpcErrorBody,
} from "./contract/errors.js";

export {
  RPC_PROTOCOL_VERSION,
  RPC_ADDRESS_KINDS,
  RPC_MESSAGE_TYPES,
  RPC_METHODS,
  RPC_EVENT_NAMES,
  RPC_HITL_FORBIDDEN_METHODS,
  type RpcAddressKind,
  type RpcAddress,
  type RpcMessageType,
  type RpcMethod,
  type RpcEventName,
  type RpcHitlForbiddenMethod,
  type RpcEnvelope,
  type RpcRegisterPayload,
  type RpcSendPayload,
  type RpcStatusClient,
  type RpcStatusSnapshot,
} from "./contract/types.js";

export {
  parseRpcAddress,
  parseRpcMethod,
  parseRpcEventName,
  parseRpcEnvelope,
  isHitlForbiddenMethod,
  assertMethodAllowed,
  addressKey,
} from "./contract/parse.js";

export {
  campaignBroadcastTopic,
  campaignStageTopic,
  parseCampaignTopic,
} from "./contract/topics.js";

export { RpcAuditLog, type RpcAuditEntry } from "./broker/audit.js";
export { RpcJournal } from "./broker/journal.js";

export {
  InProcessBroker,
  type InProcessBrokerOptions,
  type RpcDeliveryListener,
} from "./broker/in-process.js";

export {
  LocalhostRpcServer,
  type LocalhostRpcServerOptions,
  type LocalhostRpcServerInfo,
} from "./transport/localhost-server.js";

export {
  MinimalWebSocket,
  acceptWebSocket,
  isWebSocketUpgrade,
} from "./transport/websocket.js";
