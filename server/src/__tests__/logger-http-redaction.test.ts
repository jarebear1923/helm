import { createServer, request } from "node:http";
import type { Server } from "node:http";
import { Writable } from "node:stream";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { describe, expect, it } from "vitest";
import { REDACTED_EVENT_VALUE } from "../redaction.js";

const HTTP_LOG_REDACT_PATHS = [
  "err",
  "req.headers",
  "req.url",
  "req.query",
  "req.params",
  "res.headers",
];

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected ephemeral TCP server address");
  }
  return address.port;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

describe("http logger redaction", () => {
  it("redacts default pino-http serializer fields from emitted log objects", async () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(String(chunk));
        callback();
      },
    });
    const testLogger = pino({
      level: "info",
      redact: {
        paths: HTTP_LOG_REDACT_PATHS,
        censor: REDACTED_EVENT_VALUE,
      },
    }, stream);
    const middleware = pinoHttp({
      logger: testLogger,
      customSuccessMessage: () => "request completed",
    });
    const server = createServer((req, res) => {
      (req as typeof req & { query: unknown }).query = {
        token: "do-not-log-query-token",
      };
      (req as typeof req & { params: unknown }).params = {
        session: "do-not-log-param-session",
      };
      res.setHeader("Set-Cookie", "session=do-not-log-response-cookie; Path=/");
      middleware(req, res);
      res.statusCode = 200;
      res.end("ok");
    });

    const port = await listen(server);
    try {
      await new Promise<void>((resolve, reject) => {
        const req = request({
          hostname: "127.0.0.1",
          port,
          path: "/api/auth/sign-in/email?token=do-not-log-url-token",
          headers: {
            authorization: "Bearer do-not-log-authorization",
          },
        }, (res) => {
          res.resume();
          res.on("end", resolve);
        });
        req.on("error", reject);
        req.end();
      });
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      await close(server);
    }

    const output = chunks.join("");
    expect(output).toContain(REDACTED_EVENT_VALUE);
    expect(output).not.toContain("do-not-log-url-token");
    expect(output).not.toContain("do-not-log-query-token");
    expect(output).not.toContain("do-not-log-param-session");
    expect(output).not.toContain("do-not-log-response-cookie");
    expect(output).not.toContain("do-not-log-authorization");
  });

  it("redacts pino-http error objects from emitted 500 logs", async () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(String(chunk));
        callback();
      },
    });
    const testLogger = pino({
      level: "info",
      redact: {
        paths: HTTP_LOG_REDACT_PATHS,
        censor: REDACTED_EVENT_VALUE,
      },
    }, stream);
    const middleware = pinoHttp({
      logger: testLogger,
      customErrorMessage: () => "request errored",
    });
    const server = createServer((req, res) => {
      middleware(req, res);
      (res as typeof res & { err: Error }).err = new Error("password=do-not-log-error-password");
      res.statusCode = 500;
      res.end("fail");
    });

    const port = await listen(server);
    try {
      await new Promise<void>((resolve, reject) => {
        const req = request({
          hostname: "127.0.0.1",
          port,
          path: "/api/auth/sign-in/email",
        }, (res) => {
          res.resume();
          res.on("end", resolve);
        });
        req.on("error", reject);
        req.end();
      });
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      await close(server);
    }

    const output = chunks.join("");
    expect(output).toContain(REDACTED_EVENT_VALUE);
    expect(output).not.toContain("do-not-log-error-password");
    expect(output).not.toContain("password=do-not-log-error-password");
  });
});
