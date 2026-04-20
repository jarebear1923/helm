// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import type { MemoryProviderDescriptor } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryProviderConfigForm } from "./MemoryProviderConfigForm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const provider: MemoryProviderDescriptor = {
  key: "qmd_memory",
  displayName: "QMD Memory",
  description: "Markdown memory",
  kind: "plugin",
  pluginId: "paperclip.qmd-memory",
  capabilities: {
    browse: true,
    correction: false,
    asyncIngestion: false,
    providerManagedExtraction: false,
  },
  configSchema: null,
  configMetadata: {
    suggestedConfig: {
      searchMode: "query",
      topK: 5,
      apiToken: "",
      autoIndexOnWrite: true,
    },
    fields: [
      {
        key: "searchMode",
        label: "Search mode",
        description: "How QMD should retrieve matching memory files.",
        input: "select",
        suggestedValue: "query",
        options: [
          { value: "query", label: "Query" },
          { value: "search", label: "Search" },
        ],
      },
      {
        key: "topK",
        label: "Hydration snippets",
        description: "Maximum snippets to include in a run preamble.",
        input: "number",
        suggestedValue: 5,
        min: 1,
        max: 25,
      },
      {
        key: "apiToken",
        label: "API token",
        input: "secret",
        required: true,
        suggestedValue: "",
      },
      {
        key: "autoIndexOnWrite",
        label: "Auto-index on write",
        input: "boolean",
        suggestedValue: true,
      },
    ],
    pathSuggestions: [
      {
        key: "store",
        label: "Binding directory",
        path: "/tmp/paperclip/qmd/default",
        description: "Markdown records are stored here.",
      },
    ],
    healthChecks: [
      {
        key: "qmd",
        label: "QMD binary",
        status: "warning",
        message: "qmd was not found on PATH.",
      },
    ],
  },
};

/** Lets React detect a DOM value change on controlled textareas (see React #10140). */
function setNativeTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  const previous = textarea.value;
  valueSetter?.call(textarea, value);
  const tracker = (textarea as HTMLTextAreaElement & { _valueTracker?: { setValue: (v: string) => void } })
    ._valueTracker;
  tracker?.setValue(previous);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("MemoryProviderConfigForm", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
  });

  it("renders provider metadata fields, secret inputs, paths, health, and advanced JSON", async () => {
    const onChange = vi.fn();
    const onValidationChange = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryProviderConfigForm
          provider={provider}
          value={{
            searchMode: "query",
            topK: 5,
            apiToken: "secret-token",
            autoIndexOnWrite: true,
          }}
          onChange={onChange}
          onValidationChange={onValidationChange}
        />,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Search mode");
    expect(container.textContent).toContain("Hydration snippets");
    expect(container.textContent).toContain("Binding directory");
    expect(container.textContent).toContain("/tmp/paperclip/qmd/default");
    expect(container.textContent).toContain("QMD binary");
    expect(container.textContent).toContain("idle");
    expect(container.textContent).toContain("Common paths");
    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector('input[type="password"]')).not.toBeNull();

    const statusIndex = container.textContent?.indexOf("Status") ?? -1;
    const fieldIndex = container.textContent?.indexOf("Search mode") ?? -1;
    expect(statusIndex).toBeGreaterThanOrEqual(0);
    expect(fieldIndex).toBeGreaterThan(statusIndex);

    const showSecretButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.getAttribute("aria-label") === "Show API token"
    );
    expect(showSecretButton).toBeTruthy();

    await act(async () => {
      showSecretButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('input[type="text"]')?.getAttribute("id")).toContain("apiToken");

    const advancedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Advanced JSON")
    );
    expect(advancedButton).toBeTruthy();

    await act(async () => {
      advancedButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector("textarea")?.value).toContain('"topK": 5');

    await act(async () => {
      root.unmount();
    });
  });

  it("shows field-specific validation and reports invalid config state", async () => {
    const onChange = vi.fn();
    const onValidationChange = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryProviderConfigForm
          provider={provider}
          value={{
            searchMode: "missing",
            topK: 99,
            apiToken: "",
            autoIndexOnWrite: "yes",
          }}
          onChange={onChange}
          onValidationChange={onValidationChange}
        />,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Search mode must be one of the listed options.");
    expect(container.textContent).toContain("Hydration snippets must be at most 25.");
    expect(container.textContent).toContain("API token is required.");
    expect(container.textContent).toContain("Auto-index on write must be on or off.");
    expect(container.querySelectorAll('[role="alert"]').length).toBeGreaterThanOrEqual(4);
    expect(onValidationChange).toHaveBeenLastCalledWith(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("resets diverged fields to suggested values from one global action", async () => {
    const onChange = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryProviderConfigForm
          provider={provider}
          value={{
            searchMode: "search",
            topK: 10,
            apiToken: "custom-token",
            autoIndexOnWrite: false,
          }}
          onChange={onChange}
        />,
      );
      await Promise.resolve();
    });

    const resetButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Reset to suggested")
    );
    expect(resetButton).toBeTruthy();
    expect(container.textContent).not.toContain("Use suggested");

    await act(async () => {
      resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChange).toHaveBeenLastCalledWith({
      searchMode: "query",
      topK: 5,
      apiToken: "",
      autoIndexOnWrite: true,
    });

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps advanced JSON edits local until blur", async () => {
    const onChange = vi.fn();
    const onValidationChange = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryProviderConfigForm
          provider={provider}
          value={{
            searchMode: "query",
            topK: 5,
            apiToken: "secret-token",
            autoIndexOnWrite: true,
          }}
          onChange={onChange}
          onValidationChange={onValidationChange}
        />,
      );
      await Promise.resolve();
    });

    const advancedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Advanced JSON")
    );

    await act(async () => {
      advancedButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();

    await act(async () => {
      setNativeTextareaValue(textarea!, '{"topK":');
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Unexpected end");

    await act(async () => {
      textarea?.focus();
      textarea?.blur();
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Unexpected end");
    expect(onValidationChange).toHaveBeenLastCalledWith(false);

    await act(async () => {
      setNativeTextareaValue(textarea!, '{"topK": 7}');
      textarea?.focus();
      textarea?.blur();
    });

    expect(onChange).toHaveBeenLastCalledWith({ topK: 7 });

    await act(async () => {
      root.unmount();
    });
  });
});
