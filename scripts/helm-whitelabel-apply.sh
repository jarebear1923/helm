#!/usr/bin/env bash
# helm-whitelabel-apply.sh
# Apply SAFE_TO_PATCH white-label text substitutions.
# Run from the root of the helm fork checkout.
# Requires: perl (available on macOS and all Linux distros)
# Does NOT handle: logo SVG replacement, favicon PNG regeneration,
#   CompanyRail icon component swap.

set -euo pipefail

echo "Applying Helm white-label text patches..."

# ui/index.html
perl -i -pe 's{content="Paperclip"}{content="Helm"}g;
             s{<title>Paperclip</title>}{<title>Helm</title>}' \
  ui/index.html

# ui/public/site.webmanifest
perl -i -pe 's{"name": "Paperclip"}{"name": "Helm"}g;
             s{"short_name": "Paperclip"}{"short_name": "Helm"}g' \
  ui/public/site.webmanifest

# BreadcrumbContext — page title
perl -i -pe 's{document\.title = "Paperclip"}{document.title = "Helm"}g;
             s{ \· Paperclip`}{ \· Helm`}g' \
  ui/src/context/BreadcrumbContext.tsx

# Auth page
perl -i -pe 's{>Paperclip<}{>Helm<}g;
             s{Sign in to Paperclip}{Sign in to Helm}g;
             s{Create your Paperclip account}{Create your Helm account}g' \
  ui/src/pages/Auth.tsx

# Dashboard
perl -i -pe 's{Welcome to Paperclip\.}{Welcome to Helm.}g' \
  ui/src/pages/Dashboard.tsx

# CliAuth
perl -i -pe 's{The Paperclip CLI}{The Helm CLI}g;
             s{Approve Paperclip CLI access}{Approve Helm CLI access}g;
             s{A local Paperclip CLI process}{A local Helm CLI process}g' \
  ui/src/pages/CliAuth.tsx

# InviteLanding
perl -i -pe 's{existing Paperclip account}{existing Helm account}g;
             s{this Paperclip company}{this Helm company}g;
             s{join Paperclip}{join Helm}g;
             s{Set up Paperclip}{Set up Helm}g;
             s{your Paperclip account}{your Helm account}g;
             s{Create your Paperclip account}{Create your Helm account}g;
             s{Paperclip board}{Helm}g;
             s{a Paperclip account}{a Helm account}g;
             s{the Paperclip account}{the Helm account}g;
             s{right Paperclip user}{right Helm user}g;
             s{finish setting up Paperclip}{finish setting up Helm}g' \
  ui/src/pages/InviteLanding.tsx

# CloudAccessGate
perl -i -pe 's{your Paperclip startup logs}{your Helm startup logs}g;
             s{your Paperclip environment}{your Helm environment}g;
             s{this Paperclip instance}{this Helm instance}g' \
  ui/src/components/CloudAccessGate.tsx

# SidebarAccountMenu
perl -i -pe 's{Paperclip v\{version\}}{Helm v{version}}g;
             s{Open Paperclip docs in a new tab\.}{Open Helm docs in a new tab.}g' \
  ui/src/components/SidebarAccountMenu.tsx

# InstanceGeneralSettings
perl -i -pe 's{Paperclip Labs\. Votes are always saved locally\.}{Helm. Votes are always saved locally.}g;
             s{Sign out of this Paperclip instance\.}{Sign out of this Helm instance.}g' \
  ui/src/pages/InstanceGeneralSettings.tsx

# OutputFeedbackButtons
perl -i -pe 's{shared with Paperclip Labs\.}{shared with Helm.}g' \
  ui/src/components/OutputFeedbackButtons.tsx

# IssueChatThread (same text as OutputFeedbackButtons)
perl -i -pe 's{shared with Paperclip Labs\.}{shared with Helm.}g' \
  ui/src/components/IssueChatThread.tsx

# agent-config-primitives
perl -i -pe 's{How Paperclip should realize}{How Helm should realize}g;
             s{when Paperclip starts a fresh session}{when Helm starts a fresh session}g;
             s{before Paperclip adds its standard}{before Helm adds its standard}g' \
  ui/src/components/agent-config-primitives.tsx

# AgentDetail
perl -i -pe 's{Managed: Paperclip stores}{Managed: Helm stores}g;
             s{this is set by Paperclip automatically}{this is set by Helm automatically}g;
             s{Paperclip cannot manage OpenClaw skills here}{Helm cannot manage OpenClaw skills here}g;
             s{Paperclip cannot manage skills for this adapter yet}{Helm cannot manage skills for this adapter yet}g;
             s{Required by Paperclip}{Required by Helm}g;
             s{not managed by Paperclip}{not managed by Helm}g;
             s{authenticate calls to the Paperclip server}{authenticate calls to the Helm server}g' \
  ui/src/pages/AgentDetail.tsx

# openclaw-gateway config-fields
perl -i -pe 's{label="Paperclip API URL override"}{label="Helm API URL override"}g;
             s{Paperclip persists a device key}{Helm persists a device key}g' \
  ui/src/adapters/openclaw-gateway/config-fields.tsx

# codex-local config-fields
perl -i -pe 's{Paperclip will ignore this toggle}{Helm will ignore this toggle}g' \
  ui/src/adapters/codex-local/config-fields.tsx

# CompanySkills
perl -i -pe 's{sourceLabel \?\? "Paperclip", managedLabel: "Paperclip managed"}{sourceLabel ?? "Helm", managedLabel: "Helm managed"}g;
             s{editable in the Paperclip workspace}{editable in the Helm workspace}g' \
  ui/src/pages/CompanySkills.tsx

# WorkspaceRuntimeControls
perl -i -pe 's{commands that Paperclip can supervise}{commands that Helm can supervise}g' \
  ui/src/components/WorkspaceRuntimeControls.tsx

# ExecutionWorkspaceDetail
perl -i -pe 's{workspace that Paperclip reuses}{workspace that Helm reuses}g;
             s{Runs when Paperclip prepares}{Runs when Helm prepares}g' \
  ui/src/pages/ExecutionWorkspaceDetail.tsx

# ExecutionWorkspaceCloseDialog
perl -i -pe 's{Paperclip keeps the workspace record}{Helm keeps the workspace record}g' \
  ui/src/components/ExecutionWorkspaceCloseDialog.tsx

# ProjectProperties
perl -i -pe 's{Paperclip-managed folder\.}{Helm-managed folder.}g;
             s{Paperclip is using the primary workspace}{Helm is using the primary workspace}g' \
  ui/src/components/ProjectProperties.tsx

# IssueRunLedger
perl -i -pe 's{Paperclip queued an automatic retry}{Helm queued an automatic retry}g;
             s{Paperclip could not record the watchdog decision}{Helm could not record the watchdog decision}g' \
  ui/src/components/IssueRunLedger.tsx

# JsonSchemaForm
perl -i -pe 's{via the Paperclip secret provider\.}{via the Helm secret provider.}g' \
  ui/src/components/JsonSchemaForm.tsx

# Routines
perl -i -pe 's{Paperclip could not update the routine\.}{Helm could not update the routine.}g;
             s{Paperclip could not start the routine run\.}{Helm could not start the routine run.}g;
             s{Paperclip takes you straight to trigger setup\.}{Helm takes you straight to trigger setup.}g' \
  ui/src/pages/Routines.tsx

# AccountingModelCard
perl -i -pe 's{Paperclip now separates request-level inference}{Helm now separates request-level inference}g' \
  ui/src/components/AccountingModelCard.tsx

# CompanyExport — Helm branding while preserving upstream attribution link
perl -i -pe 's{Exported from \[Paperclip\]\(https://paperclip\.ing\)}{Exported from Helm (built on [Paperclip](https://paperclip.ing))}g' \
  ui/src/pages/CompanyExport.tsx

# private-hostname-guard server error message
perl -i -pe 's{this Paperclip instance\. }{this Helm instance. }g' \
  server/src/middleware/private-hostname-guard.ts

# CLI index.ts help text
perl -i -pe 's{"Paperclip CLI \x{2014} setup, diagnose, and configure your instance"}{"Helm CLI \x{2014} setup, diagnose, and configure your instance"}g;
             s{Start Paperclip immediately after saving config}{Start Helm immediately after saving config}g;
             s{Run diagnostic checks on your Paperclip setup}{Run diagnostic checks on your Helm setup}g;
             s{Bootstrap local setup \(onboard \+ doctor\) and run Paperclip}{Bootstrap local setup (onboard + doctor) and run Helm}g' \
  cli/src/index.ts

# CLI banner tagline (keep PAPERCLIP_ART constant name — internal; just change the art text and tagline)
perl -i -pe 's{Open-source orchestration for zero-human companies}{Helm — agent control plane}g' \
  cli/src/utils/banner.ts

echo "Text patches applied."
echo ""
echo "Remaining manual steps:"
echo "  1. Replace ASCII art in server/src/startup-banner.ts (PAPERCLIP art -> HELM art)"
echo "  2. Replace ASCII art in cli/src/utils/banner.ts (PAPERCLIP art -> HELM art)"
echo "  3. Create Helm logo SVG and replace ui/public/favicon.svg and ui/public/worktree-favicon.svg"
echo "  4. Regenerate PNG favicons from the new SVG"
echo "  5. Update CompanyRail icon component (ui/src/components/CompanyRail.tsx line ~205)"
echo "  6. Update SidebarAccountMenu DOCS_URL to Helm docs URL when available"
echo "  7. Add upstream attribution block to InstanceGeneralSettings or About modal"
