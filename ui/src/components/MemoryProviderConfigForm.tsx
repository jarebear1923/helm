import { useEffect, useId, useMemo, useState } from "react";
import type { MemoryProviderConfigFieldMetadata, MemoryProviderDescriptor } from "@paperclipai/shared";
import { ChevronDown, Database, Eye, EyeOff, FileSearch, RotateCcw } from "lucide-react";
import {
  getMemoryConfigFields,
  parseMemoryConfigJson,
  prettyMemoryConfig,
  validateMemoryProviderConfig,
} from "../lib/memory-config-schema";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { cn } from "../lib/utils";

function fieldValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function coerceNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function coerceSelectValue(field: MemoryProviderConfigFieldMetadata, value: string) {
  const option = (field.options ?? []).find((entry) => String(entry.value) === value);
  return option ? option.value : value;
}

function healthStatus(status: string) {
  if (status === "ok") return "active";
  if (status === "error") return "failed";
  return "idle";
}

function fieldDomId(prefix: string, key: string, suffix?: string) {
  return `${prefix}-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}${suffix ? `-${suffix}` : ""}`;
}

function fieldGridClass(fields: MemoryProviderConfigFieldMetadata[]) {
  return fields.some((field) => field.input === "boolean")
    ? "grid gap-3 lg:grid-cols-2"
    : "grid gap-3 md:grid-cols-2";
}

export function MemoryProviderConfigForm({
  provider,
  value,
  onChange,
  onValidationChange,
}: {
  provider?: MemoryProviderDescriptor;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  onValidationChange?: (valid: boolean) => void;
}) {
  const fields = useMemo(() => getMemoryConfigFields(provider), [provider]);
  const validation = useMemo(() => validateMemoryProviderConfig(provider, value), [provider, value]);
  const fieldIdPrefix = useId();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [jsonText, setJsonText] = useState(() => prettyMemoryConfig(value));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  const hasSuggestedDivergence = useMemo(
    () => fields.some((field) => field.suggestedValue !== undefined && !Object.is(value[field.key], field.suggestedValue)),
    [fields, value],
  );

  useEffect(() => {
    setJsonText(prettyMemoryConfig(value));
    setJsonError(null);
  }, [value]);

  useEffect(() => {
    onValidationChange?.(validation.valid && !jsonError);
  }, [jsonError, onValidationChange, validation.valid]);

  function updateField(key: string, nextValue: unknown) {
    onChange({ ...value, [key]: nextValue });
  }

  function resetSuggestedFields() {
    const nextValue = { ...value };
    for (const field of fields) {
      if (field.suggestedValue !== undefined) {
        nextValue[field.key] = field.suggestedValue;
      }
    }
    onChange(nextValue);
  }

  function applyJsonText() {
    try {
      onChange(parseMemoryConfigJson(jsonText));
      setJsonError(null);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "Config must be valid JSON");
    }
  }

  function renderField(field: MemoryProviderConfigFieldMetadata) {
    const error = validation.fieldErrors[field.key];
    const fieldId = fieldDomId(fieldIdPrefix, field.key);
    const descriptionId = field.description ? fieldDomId(fieldIdPrefix, field.key, "description") : undefined;
    const errorId = error ? fieldDomId(fieldIdPrefix, field.key, "error") : undefined;
    const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
    const common = (
      <>
        <Label htmlFor={fieldId} className="text-xs text-muted-foreground">{field.label}</Label>
        {field.description ? (
          <p id={descriptionId} className="text-xs text-muted-foreground">{field.description}</p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-destructive">{error}</p>
        ) : null}
      </>
    );

    if (field.input === "boolean") {
      return (
        <div key={field.key} className="rounded-md border border-border bg-card/40 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">{common}</div>
            <ToggleSwitch
              id={fieldId}
              aria-describedby={describedBy}
              aria-invalid={Boolean(error)}
              checked={Boolean(value[field.key])}
              onCheckedChange={(checked) => updateField(field.key, checked)}
            />
          </div>
        </div>
      );
    }

    if (field.input === "select") {
      return (
        <div key={field.key} className="space-y-1">
          {common}
          <Select
            value={fieldValue(value[field.key])}
            onValueChange={(nextValue) => updateField(field.key, coerceSelectValue(field, nextValue))}
          >
            <SelectTrigger
              id={fieldId}
              aria-describedby={describedBy}
              aria-invalid={Boolean(error)}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option) => (
                <SelectItem key={String(option.value)} value={fieldValue(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    const isSecret = field.input === "secret";
    const secretVisible = Boolean(visibleSecrets[field.key]);

    return (
      <div key={field.key} className="space-y-1">
        {common}
        <div className="relative">
          <Input
            id={fieldId}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            type={field.input === "number" ? "number" : isSecret && !secretVisible ? "password" : "text"}
            min={field.min ?? undefined}
            max={field.max ?? undefined}
            value={fieldValue(value[field.key])}
            placeholder={field.placeholder ?? undefined}
            className={cn(isSecret && "pr-10")}
            onChange={(event) => {
              const raw = event.target.value;
              if (field.input === "number") {
                updateField(field.key, coerceNumber(raw));
              } else {
                updateField(field.key, raw.trim() === "" && field.defaultValue === null ? null : raw);
              }
            }}
          />
          {isSecret ? (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label={secretVisible ? `Hide ${field.label}` : `Show ${field.label}`}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setVisibleSecrets((current) => ({ ...current, [field.key]: !secretVisible }))}
            >
              {secretVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {provider?.configMetadata?.healthChecks?.length ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            Status
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {provider.configMetadata.healthChecks.map((check) => (
              <div key={check.key} className="rounded-md border border-border bg-card px-3 py-3 text-xs">
                <div className="flex items-center justify-between gap-2 font-medium">
                  <span>{check.label}</span>
                  <StatusBadge status={healthStatus(check.status)} />
                </div>
                {check.message ? <div className="mt-1 text-muted-foreground">{check.message}</div> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasSuggestedDivergence ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={resetSuggestedFields}>
            <RotateCcw className="size-3.5" />
            Reset to suggested
          </Button>
        </div>
      ) : null}

      {fields.length > 0 ? (
        <div className={fieldGridClass(fields)}>{fields.map((field) => renderField(field))}</div>
      ) : (
        <div className="rounded-md border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
          This provider does not publish schema fields yet. Use advanced JSON for its config.
        </div>
      )}

      {provider?.configMetadata?.pathSuggestions?.length ? (
        <section className="space-y-2">
          <Separator />
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileSearch className="h-3.5 w-3.5" />
            Common paths
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {provider.configMetadata.pathSuggestions.map((suggestion) => (
              <div key={suggestion.key} className="rounded-md border border-dashed border-border px-3 py-2 text-xs">
                <div className="font-medium">{suggestion.label}</div>
                <div className="mt-1 break-all font-mono text-muted-foreground">{suggestion.path}</div>
                {suggestion.description ? <div className="mt-1 text-muted-foreground">{suggestion.description}</div> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Collapsible
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        className="rounded-md border border-border"
      >
        <CollapsibleTrigger
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-accent/30"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !advancedOpen && "-rotate-90")} />
          Advanced JSON
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 border-t border-border px-3 py-3">
          <Textarea
            value={jsonText}
            onChange={(event) => {
              setJsonText(event.target.value);
              if (jsonError) setJsonError(null);
            }}
            onBlur={applyJsonText}
            className="min-h-40 font-mono text-xs"
          />
          {jsonError ? <p role="alert" className="text-xs text-destructive">{jsonError}</p> : null}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
