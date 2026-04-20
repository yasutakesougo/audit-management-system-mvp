export type CreateErrorReason =
  | "throttle"
  | "auth"
  | "duplicate"
  | "drift"
  | "unknown";

export type ClassificationSignal = "status" | "code" | "message" | "header";

export type ClassifiedCreateError = {
  reason: CreateErrorReason;
  summaryPhrase: string;
  rawDetail: string;
  matchedOn: ReadonlyArray<ClassificationSignal>;
  retryAfterSeconds?: number;
};

type ParsedError = {
  status?: number;
  headers: Record<string, string>;
  code?: string;
  message: string;
};

const SUMMARY_BY_REASON: Record<CreateErrorReason, string> = {
  throttle: "作成（Create）テストが一時的に制限されています。",
  auth: "作成（Create）権限がありません。【要管理者対応】",
  duplicate: "作成（Create）テストが一意制約で失敗しました。",
  drift: "作成（Create）テストがスキーマ不整合で失敗しました。",
  unknown: "作成（Create）テストに失敗しました。原因を確認してください。",
};

const AUTH_STATUS = new Set([401, 403]);
const THROTTLE_STATUS = new Set([429]);
const DRIFT_HINTS = [
  "fieldnotfound",
  "does not exist on list",
  "column '",
  "column \"",
  "field not found",
  "internal name",
  "cannot find resource for the request",
  "無効な列名",
  "列が存在しません",
  "フィールドが見つかりません",
  "フィールドが存在しません",
];
const DUPLICATE_HINTS = [
  "duplicate value",
  "unique value",
  "already exists",
  "-2130575214",
  "一意な値",
  "重複する値",
  "この値を持つアイテムが存在",
];

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function extractStatus(err: unknown, message: string): number | undefined {
  const rec = toRecord(err);
  const raw = rec?.status;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;

  const match = /\((\d{3})\s/i.exec(message);
  if (!match) return undefined;
  const status = Number(match[1]);
  return Number.isFinite(status) ? status : undefined;
}

function extractHeaders(err: unknown): Record<string, string> {
  const rec = toRecord(err);
  const raw = rec?.headers;
  if (!raw) return {};

  const out: Record<string, string> = {};

  if (typeof Headers !== "undefined" && raw instanceof Headers) {
    raw.forEach((v, k) => {
      out[k.toLowerCase()] = String(v);
    });
    return out;
  }

  if (Array.isArray(raw)) {
    for (const h of raw) {
      if (Array.isArray(h) && h.length >= 2) {
        out[String(h[0]).toLowerCase()] = String(h[1]);
      }
    }
    return out;
  }

  const rawRecord = toRecord(raw);
  if (!rawRecord) return {};
  for (const [k, v] of Object.entries(rawRecord)) {
    if (typeof v === "string" || typeof v === "number") {
      out[k.toLowerCase()] = String(v);
    }
  }
  return out;
}

function tryParseJsonPayload(message: string): Record<string, unknown> | null {
  const trimmed = message.trim();
  const candidates = [trimmed];
  const start = trimmed.indexOf("{");
  if (start > 0) candidates.push(trimmed.slice(start));

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      const rec = toRecord(parsed);
      if (rec) return rec;
    } catch {
      // noop
    }
  }
  return null;
}

function extractCodeFromPayload(payload: Record<string, unknown>): string | undefined {
  const odataError = toRecord(payload["odata.error"]);
  const odataCode = odataError?.code;
  if (typeof odataCode === "string" && odataCode.trim()) return odataCode;

  const errorObj = toRecord(payload.error);
  const graphCode = errorObj?.code;
  if (typeof graphCode === "string" && graphCode.trim()) return graphCode;

  return undefined;
}

function parseRetryAfterSeconds(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const sec = Number(value);
  if (Number.isFinite(sec) && sec >= 0) return sec;

  const at = Date.parse(value);
  if (!Number.isNaN(at)) {
    const deltaSec = Math.ceil((at - Date.now()) / 1000);
    return deltaSec >= 0 ? deltaSec : 0;
  }

  return undefined;
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((p) => text.includes(p));
}

function parseError(err: unknown): ParsedError {
  const message = extractMessage(err);
  const headers = extractHeaders(err);
  const payload = tryParseJsonPayload(message);
  const code = payload ? extractCodeFromPayload(payload) : undefined;

  return {
    status: extractStatus(err, message),
    headers,
    code,
    message,
  };
}

export function classifyCreateError(err: unknown): ClassifiedCreateError {
  const parsed = parseError(err);
  const messageLower = parsed.message.toLowerCase();
  const codeLower = parsed.code?.toLowerCase();
  const retryAfterSeconds = parseRetryAfterSeconds(parsed.headers["retry-after"]);

  const throttleByHeader = retryAfterSeconds !== undefined;
  const throttleByStatus = parsed.status !== undefined && THROTTLE_STATUS.has(parsed.status);
  const throttleByCode = codeLower?.includes("throttl") || false;
  if (throttleByHeader || throttleByStatus || throttleByCode) {
    const matchedOn: ClassificationSignal[] = [];
    if (throttleByHeader) matchedOn.push("header");
    if (throttleByStatus) matchedOn.push("status");
    if (!throttleByStatus && throttleByCode) matchedOn.push("code");
    return {
      reason: "throttle",
      summaryPhrase: SUMMARY_BY_REASON.throttle,
      rawDetail: parsed.message,
      matchedOn,
      retryAfterSeconds,
    };
  }

  const authByStatus = parsed.status !== undefined && AUTH_STATUS.has(parsed.status);
  if (authByStatus) {
    return {
      reason: "auth",
      summaryPhrase: SUMMARY_BY_REASON.auth,
      rawDetail: parsed.message,
      matchedOn: ["status"],
    };
  }

  const duplicateByStatus = parsed.status === 412;
  const duplicateByCode =
    codeLower === "-2130575214" ||
    codeLower?.includes("duplicate") ||
    codeLower?.includes("unique");
  const duplicateByMessage = includesAny(messageLower, DUPLICATE_HINTS);
  if (duplicateByStatus || duplicateByCode || duplicateByMessage) {
    const matchedOn: ClassificationSignal[] = [];
    if (duplicateByStatus) matchedOn.push("status");
    if (!duplicateByStatus && duplicateByCode) matchedOn.push("code");
    if (!duplicateByStatus && !duplicateByCode && duplicateByMessage) matchedOn.push("message");
    return {
      reason: "duplicate",
      summaryPhrase: SUMMARY_BY_REASON.duplicate,
      rawDetail: parsed.message,
      matchedOn,
    };
  }

  const driftByCode = codeLower?.includes("fieldnotfound") || false;
  const driftByMessage = includesAny(messageLower, DRIFT_HINTS);
  if (driftByCode || driftByMessage) {
    return {
      reason: "drift",
      summaryPhrase: SUMMARY_BY_REASON.drift,
      rawDetail: parsed.message,
      matchedOn: [driftByCode ? "code" : "message"],
    };
  }

  return {
    reason: "unknown",
    summaryPhrase: SUMMARY_BY_REASON.unknown,
    rawDetail: parsed.message,
    matchedOn: [],
  };
}
