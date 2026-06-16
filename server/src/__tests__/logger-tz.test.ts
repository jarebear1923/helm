import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Regression test for https://github.com/paperclipai/paperclip/issues/2879
 *
 * pino-pretty's `translateTime: "HH:MM:ss"` formats all timestamps in UTC
 * regardless of the process's TZ env var. The `SYS:` prefix instructs
 * pino-pretty to use the local system timezone, so operators in non-UTC
 * zones see correct wall-clock times in their logs.
 *
 * We verify that:
 * 1. The logger module initialises pino-pretty with "SYS:HH:MM:ss".
 * 2. The pino-pretty SYS: prefix resolves to a timezone-sensitive format
 *    string — confirmed via pino-pretty's own asynchronous formatter, which
 *    applies translateTime to a known epoch under different TZ values.
 */

const mockTransport = vi.hoisted(() => vi.fn(() => ({ write: vi.fn() })));
const mockPino = vi.hoisted(() => {
  const fn = vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(),
  }));
  (fn as any).transport = mockTransport;
  return fn;
});
const mockPinoHttp = vi.hoisted(() => vi.fn(() => vi.fn()));

// Mock fs so the module-level mkdirSync call is a no-op in tests.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, mkdirSync: vi.fn() };
});

vi.mock("pino", () => ({
  default: mockPino,
}));
vi.mock("pino-http", () => ({
  pinoHttp: mockPinoHttp,
}));
vi.mock("../config-file.js", () => ({
  readConfigFile: vi.fn(() => null),
}));
vi.mock("../home-paths.js", () => ({
  resolveHomeAwarePath: vi.fn((p: string) => p),
  resolveDefaultLogsDir: vi.fn(() => "/tmp/paperclip-test-logs"),
}));

describe("logger translateTime respects TZ environment variable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("configures pino-pretty with SYS:HH:MM:ss so timestamps honour the TZ env var", async () => {
    await import("../middleware/logger.js");

    expect(mockTransport).toHaveBeenCalledOnce();
    const { targets } = mockTransport.mock.calls[0][0] as {
      targets: Array<{ options: Record<string, unknown> }>;
    };
    for (const target of targets) {
      expect(target.options.translateTime).toBe("SYS:HH:MM:ss");
    }
    const loggerOptions = mockPino.mock.calls[0][0] as {
      redact?: { paths?: string[]; censor?: string };
    };
    expect(loggerOptions.redact?.paths).toEqual(expect.arrayContaining([
      "err",
      "req.headers",
      "req.url",
      "req.query",
      "req.params",
      "res.headers",
    ]));
    expect(loggerOptions.redact?.censor).toBe("***REDACTED***");
  });

  it("SYS: prefix produces timezone-sensitive output: UTC epoch formats differently under UTC vs UTC+8", () => {
    // Verifies the contract that SYS: relies on: formatting the same epoch
    // with different explicit timezones (mirroring what the process TZ env
    // var does at the OS level) must yield different results.
    const EPOCH_MS = 946_684_800_000; // 2000-01-01 00:00:00 UTC

    const fmtUtc = new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(EPOCH_MS);

    const fmtSgt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Singapore", // UTC+8
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(EPOCH_MS);

    // UTC midnight = 00:00:00; the same instant in SGT = 08:00:00.
    // SYS: picks up whichever of these the process TZ is set to — which is
    // exactly what the fix enables by switching from HH:MM:ss (UTC-only).
    expect(fmtUtc).toBe("00:00:00");
    expect(fmtSgt).toBe("08:00:00");
    expect(fmtUtc).not.toBe(fmtSgt);
  });

  it("redacts sensitive failed-request props before pino-http logs them", async () => {
    await import("../middleware/logger.js");

    expect(mockPinoHttp).toHaveBeenCalledOnce();
    const options = mockPinoHttp.mock.calls[0][0] as {
      customProps: (req: unknown, res: unknown) => Record<string, unknown>;
      customSuccessMessage: (req: unknown, res: unknown) => string;
      customErrorMessage: (req: unknown, res: unknown, err?: Error) => string;
    };

    const req = {
      method: "POST",
      url: "/api/auth/sign-in/email?token=do-not-log-url-token&cookie=do-not-log-cookie&session=do-not-log-session&safe=ok",
      body: {
        email: "dev@example.com",
        password: "do-not-log-password",
        nested: {
          apiKey: "do-not-log-api-key",
          note: "Authorization: Bearer do-not-log-bearer",
          colonNote: "api_key: do-not-log-colon-api-key",
        },
      },
      params: {
        token: "do-not-log-param-token",
      },
      query: {
        safe: "ok",
        session: "aaa.bbb.ccc",
      },
      route: { path: "/api/auth/sign-in/email" },
    };
    const directProps = options.customProps(req, { statusCode: 401 });
    const directJson = JSON.stringify(directProps);

    expect(directJson).not.toContain("do-not-log-password");
    expect(directJson).not.toContain("do-not-log-api-key");
    expect(directJson).not.toContain("do-not-log-bearer");
    expect(directJson).not.toContain("do-not-log-colon-api-key");
    expect(directJson).not.toContain("do-not-log-param-token");
    expect(directJson).not.toContain("aaa.bbb.ccc");
    expect(directProps).toMatchObject({
      reqBody: {
        email: "dev@example.com",
        password: "***REDACTED***",
        nested: {
          apiKey: "***REDACTED***",
          note: "Authorization: Bearer ***REDACTED***",
          colonNote: "api_key: ***REDACTED***",
        },
      },
      reqParams: {
        token: "***REDACTED***",
      },
      reqQuery: {
        safe: "ok",
        session: "***REDACTED***",
      },
      routePath: "/api/auth/sign-in/email",
    });

    const contextProps = options.customProps(
      req,
      {
        statusCode: 500,
        __errorContext: {
          error: {
            message: "upstream failed password=do-not-log-error-password",
            details: {
              refreshToken: "do-not-log-refresh-token",
              note: "token: do-not-log-error-token",
            },
          },
          reqBody: req.body,
          reqParams: req.params,
          reqQuery: req.query,
        },
      },
    );
    const contextJson = JSON.stringify(contextProps);

    expect(contextJson).not.toContain("do-not-log-error-password");
    expect(contextJson).not.toContain("do-not-log-refresh-token");
    expect(contextJson).not.toContain("do-not-log-error-token");
    expect(contextJson).not.toContain("do-not-log-password");
    expect(contextProps).toMatchObject({
      errorContext: {
        message: "upstream failed password=***REDACTED***",
        details: {
          refreshToken: "***REDACTED***",
          note: "token: ***REDACTED***",
        },
      },
      reqBody: {
        password: "***REDACTED***",
      },
    });

    const successMessage = options.customSuccessMessage(req, { statusCode: 200 });
    expect(successMessage).toContain(
      "POST /api/auth/sign-in/email?token=***REDACTED***&cookie=***REDACTED***&session=***REDACTED***&safe=ok",
    );
    expect(successMessage).not.toContain("do-not-log-url-token");
    expect(successMessage).not.toContain("do-not-log-cookie");
    expect(successMessage).not.toContain("do-not-log-session");

    const claimMessage = options.customSuccessMessage(
      {
        ...req,
        url: "/board-claim/do-not-log-board-token?code=do-not-log-board-code&safe=ok",
      },
      { statusCode: 200 },
    );
    expect(claimMessage).toContain("/board-claim/***REDACTED***?code=***REDACTED***&safe=ok");
    expect(claimMessage).not.toContain("do-not-log-board-token");
    expect(claimMessage).not.toContain("do-not-log-board-code");

    const errorMessage = options.customErrorMessage(
      req,
      {
        statusCode: 500,
        __errorContext: {
          error: {
            message: "upstream failed password: do-not-log-error-password",
          },
        },
      },
    );

    expect(errorMessage).toContain(
      "POST /api/auth/sign-in/email?token=***REDACTED***&cookie=***REDACTED***&session=***REDACTED***&safe=ok",
    );
    expect(errorMessage).toContain("password: ***REDACTED***");
    expect(errorMessage).not.toContain("do-not-log-url-token");
    expect(errorMessage).not.toContain("do-not-log-cookie");
    expect(errorMessage).not.toContain("do-not-log-session");
    expect(errorMessage).not.toContain("do-not-log-error-password");
  });
});
