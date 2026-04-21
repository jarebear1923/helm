import type { IssueDeliverablesSummary } from "@paperclipai/shared";
import { Badge } from "@/components/ui/badge";

function labelize(value: string) {
  return value.replace(/_/g, " ");
}

function workspaceModeLabel(mode: string) {
  switch (mode) {
    case "shared_workspace":
      return "Shared";
    case "isolated_workspace":
      return "Isolated";
    case "operator_branch":
      return "Operator branch";
    case "adapter_managed":
      return "Adapter managed";
    case "cloud_sandbox":
      return "Cloud sandbox";
    default:
      return labelize(mode);
  }
}

type Chip = {
  key: string;
  label: string;
  section: string;
};

export function IssueDeliverablesSummaryChips({
  summary,
  onOpenDocuments,
  onOpenWorkProduct,
}: {
  summary: IssueDeliverablesSummary | null | undefined;
  onOpenDocuments?: () => void;
  onOpenWorkProduct?: (sectionId: string) => void;
}) {
  if (!summary) return null;

  const chips: Chip[] = [];
  if (summary.workspaceMode) {
    chips.push({
      key: "workspace",
      label: `Workspace: ${workspaceModeLabel(summary.workspaceMode)}`,
      section: "issue-work-product-workspace",
    });
  }
  if (summary.pullRequestCount > 0) {
    if (summary.pullRequestCount === 1) {
      const prState = summary.pullRequestReviewState && summary.pullRequestReviewState !== "none"
        ? summary.pullRequestReviewState
        : summary.pullRequestStatus;
      chips.push({
        key: "pull-requests",
        label: `PR: ${prState ? labelize(prState) : "1"}`,
        section: "issue-work-product-pull-requests",
      });
    } else {
      chips.push({
        key: "pull-requests",
        label: `PRs: ${summary.pullRequestCount}`,
        section: "issue-work-product-pull-requests",
      });
    }
  }
  if (summary.previewCount > 0) {
    if (summary.previewCount === 1 && summary.previewHealth) {
      chips.push({
        key: "previews",
        label: `Preview: ${labelize(summary.previewHealth)}`,
        section: "issue-work-product-previews",
      });
    } else {
      chips.push({
        key: "previews",
        label: `Previews: ${summary.previewCount}`,
        section: "issue-work-product-previews",
      });
    }
  }
  if (summary.documentCount > 0) {
    chips.push({ key: "documents", label: `Docs: ${summary.documentCount}`, section: "issue-documents" });
  }
  if (summary.fileCount > 0) {
    chips.push({ key: "files", label: `Files: ${summary.fileCount}`, section: "issue-work-product-files" });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="text-[11px] font-medium">
          <button
            type="button"
            className="hover:underline"
            onClick={() => {
              if (chip.section === "issue-documents") {
                onOpenDocuments?.();
                return;
              }
              onOpenWorkProduct?.(chip.section);
            }}
          >
            {chip.label}
          </button>
        </Badge>
      ))}
    </div>
  );
}
