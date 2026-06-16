import path from "node:path";
import fs from "node:fs";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { readConfigFile } from "../config-file.js";
import { resolveDefaultLogsDir, resolveHomeAwarePath } from "../home-paths.js";
import { REDACTED_EVENT_VALUE, redactSensitiveText, sanitizeRecord } from "../redaction.js";
import { shouldSilenceHttpSuccessLog } from "./http-log-policy.js";

function resolveServerLogDir(): string {
  const envOverride = process.env.PAPERCLIP_LOG_DIR?.trim();
  if (envOverride) return resolveHomeAwarePath(envOverride);

  const fileLogDir = readConfigFile()?.logging.logDir?.trim();
  if (fileLogDir) return resolveHomeAwarePath(fileLogDir);

  return resolveDefaultLogsDir();
}

const logDir = resolveServerLogDir();
fs.mkdirSync(logDir, { recursive: true });

const logFile = path.join(logDir, "server.log");

const sharedOpts = {
  translateTime: "SYS:HH:MM:ss",
  ignore: "pid,hostname",
  singleLine: true,
};

const HTTP_LOG_SECRET_KEY_RE =
  /^code$|token|session|cookie|password|passwd|secret|credential|authorization|api[-_]?key/i;
const HTTP_LOG_REDACT_PATHS = [
  "err",
  "req.headers",
  "req.url",
  "req.query",
  "req.params",
  "res.headers",
];

function redactHttpLogValue(value: unknown): unknown {
  if (typeof value === "string") return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map((entry) => redactHttpLogValue(entry));
  if (!value || typeof value !== "object") return value;

  const sanitized = sanitizeRecord(value as Record<string, unknown>);
  return Object.fromEntries(
    Object.entries(sanitized).map(([key, entry]) => [
      key,
      HTTP_LOG_SECRET_KEY_RE.test(key) ? REDACTED_EVENT_VALUE : redactHttpLogValue(entry),
    ]),
  );
}

function redactHttpLogPathname(pathname: string): string {
  return redactSensitiveText(pathname).replace(
    /(\/board-claim\/)[^/]+/g,
    `$1${REDACTED_EVENT_VALUE}`,
  );
}

function redactHttpLogUrl(value: unknown): string {
  const raw = String(value ?? "");
  if (!raw) return raw;

  const isAbsoluteUrl = /^[a-z][a-z\d+\-.]*:/i.test(raw);
  if (!raw.startsWith("/") && !isAbsoluteUrl) {
    return redactSensitiveText(raw);
  }

  try {
    const baseUrl = "http://paperclip.local";
    const url = new URL(raw, baseUrl);
    const redactedParams = new URLSearchParams();
    url.searchParams.forEach((entry, key) => {
      redactedParams.append(
        key,
        HTTP_LOG_SECRET_KEY_RE.test(key) ? REDACTED_EVENT_VALUE : redactSensitiveText(entry),
      );
    });
    const redactedSearch = redactedParams.toString();
    url.search = redactedSearch ? `?${redactedSearch}` : "";

    const redactedPath = redactHttpLogPathname(url.pathname);
    const redactedHash = redactSensitiveText(url.hash);
    if (!isAbsoluteUrl) {
      return `${redactedPath}${url.search}${redactedHash}`;
    }

    url.pathname = redactedPath;
    url.hash = redactedHash;
    return url.toString();
  } catch {
    return redactSensitiveText(raw);
  }
}

export const logger = pino({
  level: "debug",
  redact: {
    paths: HTTP_LOG_REDACT_PATHS,
    censor: REDACTED_EVENT_VALUE,
  },
}, pino.transport({
  targets: [
    {
      target: "pino-pretty",
      options: { ...sharedOpts, ignore: "pid,hostname,req,res,responseTime", colorize: true, destination: 1 },
      level: "info",
    },
    {
      target: "pino-pretty",
      options: { ...sharedOpts, colorize: false, destination: logFile, mkdir: true },
      level: "debug",
    },
  ],
}));

export const httpLogger = pinoHttp({
  logger,
  customLogLevel(_req, res, err) {
    if (shouldSilenceHttpSuccessLog(_req.method, _req.url, res.statusCode)) {
      return "silent";
    }
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage(req, res) {
    return `${req.method} ${redactHttpLogUrl(req.url)} ${res.statusCode}`;
  },
  customErrorMessage(req, res, err) {
    const ctx = (res as any).__errorContext;
    const rawErrMsg = ctx?.error?.message || err?.message || (res as any).err?.message || "unknown error";
    const errMsg = redactSensitiveText(String(rawErrMsg));
    return `${req.method} ${redactHttpLogUrl(req.url)} ${res.statusCode} — ${errMsg}`;
  },
  customProps(req, res) {
    if (res.statusCode >= 400) {
      const ctx = (res as any).__errorContext;
      if (ctx) {
        return {
          errorContext: redactHttpLogValue(ctx.error),
          reqBody: redactHttpLogValue(ctx.reqBody),
          reqParams: redactHttpLogValue(ctx.reqParams),
          reqQuery: redactHttpLogValue(ctx.reqQuery),
        };
      }
      const props: Record<string, unknown> = {};
      const { body, params, query } = req as any;
      if (body && typeof body === "object" && Object.keys(body).length > 0) {
        props.reqBody = redactHttpLogValue(body);
      }
      if (params && typeof params === "object" && Object.keys(params).length > 0) {
        props.reqParams = redactHttpLogValue(params);
      }
      if (query && typeof query === "object" && Object.keys(query).length > 0) {
        props.reqQuery = redactHttpLogValue(query);
      }
      if ((req as any).route?.path) {
        props.routePath = (req as any).route.path;
      }
      return props;
    }
    return {};
  },
});
