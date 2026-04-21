// @vitest-environment jsdom

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { CompanyDeliverablesResponse } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Artifacts } from "./Artifacts";

const listCompanyDeliverablesMock = vi.hoisted(() => vi.fn());
const listProjectsMock = vi.hoisted(() => vi.fn());
const setBreadcrumbsMock = vi.hoisted(() => vi.fn());

vi.mock("../api/issues", () => ({
  issuesApi: {
    listCompanyDeliverables: listCompanyDeliverablesMock,
  },
}));

vi.mock("../api/projects", () => ({
  projectsApi: {
    list: listProjectsMock,
  },
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: "company-1",
  }),
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({
    setBreadcrumbs: setBreadcrumbsMock,
  }),
}));

vi.mock("@/lib/router", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
      <a href={to} className={className}>{children}</a>
    ),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function createWorkProductResponse(items: CompanyDeliverablesResponse["items"]): CompanyDeliverablesResponse {
  return {
    items,
    summary: {
      totalCount: items.length,
      issueCount: new Set(items.map((item) => item.issueId)).size,
      primaryCount: items.filter((item) => item.isPrimary).length,
      previewCount: items.filter((item) => item.kind === "preview_url" || item.kind === "runtime_service").length,
      pullRequestCount: items.filter((item) => item.kind === "pull_request").length,
      branchCount: items.filter((item) => item.kind === "branch").length,
      commitCount: items.filter((item) => item.kind === "commit").length,
      documentCount: items.filter((item) => item.kind === "document").length,
      fileCount: items.filter((item) => item.kind === "artifact" || item.kind === "attachment").length,
    },
  };
}

function createItem(overrides: Partial<CompanyDeliverablesResponse["items"][number]> = {}): CompanyDeliverablesResponse["items"][number] {
  return {
    id: "item-1",
    sourceType: "attachment",
    kind: "attachment",
    title: "mockup.png",
    url: "/api/attachments/attachment-1/content",
    summary: null,
    status: null,
    reviewState: null,
    healthStatus: null,
    provider: "paperclip",
    updatedAt: new Date("2026-04-01T12:00:00.000Z"),
    createdAt: new Date("2026-04-01T12:00:00.000Z"),
    isPrimary: false,
    metadata: null,
    documentKey: null,
    revisionNumber: null,
    contentType: "image/png",
    byteSize: 1024,
    isOperatorContext: false,
    issueId: "issue-1",
    issueIdentifier: "PAP-10",
    issueTitle: "Create mockup",
    issueStatus: "done",
    projectId: "project-1",
    ...overrides,
  };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Artifacts", () => {
  let container: HTMLDivElement;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    listProjectsMock.mockResolvedValue([{ id: "project-1", name: "Paperclip App" }]);
    listCompanyDeliverablesMock.mockResolvedValue(
      createWorkProductResponse([
        createItem(),
        createItem({
          id: "doc-1",
          sourceType: "document",
          kind: "document",
          title: "Launch brief",
          url: "#document-brief",
          contentType: "text/markdown",
          byteSize: null,
          documentKey: "brief",
        }),
      ]),
    );
  });

  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  it("hydrates search, filter, project, and operator-context state from the URL", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/PAP/work-product?filter=files&q=mock&projectId=project-1&operatorContext=true"]}>
          <QueryClientProvider client={queryClient}>
            <Artifacts />
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });
    await flush();

    expect(listCompanyDeliverablesMock).toHaveBeenCalledWith("company-1", { includeOperatorContext: true });
    expect(setBreadcrumbsMock).toHaveBeenCalledWith([{ label: "Work Product" }]);
    expect(container.textContent).toContain("mockup.png");
    expect(container.textContent).not.toContain("Launch brief");
    expect((container.querySelector('input[placeholder="Search titles, issues, providers..."]') as HTMLInputElement).value).toBe("mock");
  });

  it("does not render Spotlight when the filtered set has no primary or auto-promoted output", async () => {
    listCompanyDeliverablesMock.mockResolvedValue(
      createWorkProductResponse([
        createItem({
          id: "doc-1",
          sourceType: "document",
          kind: "document",
          title: "Launch brief",
          url: "#document-brief",
          contentType: "text/markdown",
          byteSize: null,
          documentKey: "brief",
        }),
      ]),
    );

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/PAP/work-product"]}>
          <QueryClientProvider client={queryClient}>
            <Artifacts />
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });
    await flush();

    expect(container.textContent).not.toContain("Spotlight");
    expect(container.textContent).toContain("Latest Work Product");
  });
});
