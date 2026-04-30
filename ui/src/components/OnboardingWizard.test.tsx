// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { getBlockingAdapterEnvironmentMessage } from "./OnboardingWizard";
import type { AdapterEnvironmentTestResult } from "@paperclipai/shared";

describe("getBlockingAdapterEnvironmentMessage", () => {
  it("allows passing and warning adapter environment results", () => {
    const base = {
      adapterType: "codex_local",
      checks: [],
      testedAt: "2026-04-29T00:00:00.000Z",
    } satisfies Omit<AdapterEnvironmentTestResult, "status">;

    expect(
      getBlockingAdapterEnvironmentMessage({ ...base, status: "pass" }),
    ).toBeNull();
    expect(
      getBlockingAdapterEnvironmentMessage({
        ...base,
        status: "warn",
        checks: [
          {
            code: "warning",
            level: "warn",
            message: "Adapter has a non-blocking warning.",
          },
        ],
      }),
    ).toBeNull();
  });

  it("blocks failed adapter environment results with the failing check message", () => {
    expect(
      getBlockingAdapterEnvironmentMessage({
        adapterType: "codex_local",
        status: "fail",
        testedAt: "2026-04-29T00:00:00.000Z",
        checks: [
          {
            code: "command_missing",
            level: "error",
            message: "Command not found in PATH: codex.",
            hint: "Install Codex or choose another adapter.",
          },
        ],
      }),
    ).toBe(
      "Command not found in PATH: codex. Install Codex or choose another adapter.",
    );
  });
});
