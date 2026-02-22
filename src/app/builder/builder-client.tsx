"use client";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { type SchemaJSON } from "@/lib/table-schema";
import { inferSchemaFromJSON } from "@/lib/table-schema/infer";
import { deserializeSchema } from "@/lib/table-schema/serialize";
import { schemaToTypeScript } from "@/lib/table-schema/to-typescript";
import { validateSchema } from "@/lib/table-schema/validate";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Shuffle, Sparkle } from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { BuilderTable } from "./builder-table";
import {
  EXAMPLE_DATASETS,
  PLACEHOLDER_DATA,
  PLACEHOLDER_DATA_JSON,
} from "./placeholder-data";

const INITIAL_SCHEMA = inferSchemaFromJSON(PLACEHOLDER_DATA);

const dataFormSchema = z.object({
  json: z.string().superRefine((val, ctx) => {
    try {
      const parsed = JSON.parse(val);
      if (!Array.isArray(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Expected a JSON array.",
        });
      }
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: e instanceof Error ? e.message : "Invalid JSON",
      });
    }
  }),
});

const schemaFormSchema = z.object({
  schema: z.string().superRefine((val, ctx) => {
    try {
      const parsed = JSON.parse(val);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray((parsed as { columns?: unknown }).columns)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Expected an object with a 'columns' array.",
        });
      }
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: e instanceof Error ? e.message : "Invalid JSON",
      });
    }
  }),
});

type DataFormValues = z.infer<typeof dataFormSchema>;
type SchemaFormValues = z.infer<typeof schemaFormSchema>;

export function BuilderClient() {
  const [parsedData, setParsedData] =
    React.useState<Record<string, unknown>[]>(PLACEHOLDER_DATA);
  const [schemaJson, setSchemaJson] = React.useState<SchemaJSON | null>(
    INITIAL_SCHEMA,
  );
  const [schemaVersion, setSchemaVersion] = React.useState(0);
  const [generating, setGenerating] = React.useState(false);
  const { isCopied, copy } = useCopyToClipboard();
  const [currentDatasetLabel, setCurrentDatasetLabel] = React.useState(
    EXAMPLE_DATASETS[0].label,
  );

  const dataForm = useForm<DataFormValues>({
    resolver: zodResolver(dataFormSchema),
    defaultValues: { json: PLACEHOLDER_DATA_JSON },
    mode: "onChange",
  });

  const schemaForm = useForm<SchemaFormValues>({
    resolver: zodResolver(schemaFormSchema),
    defaultValues: { schema: JSON.stringify(INITIAL_SCHEMA, null, 2) },
    mode: "onChange",
  });

  const generateSchema = React.useCallback(
    async (data: Record<string, unknown>[]) => {
      setGenerating(true);
      try {
        const res = await fetch("/api/builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          dataForm.setError("json", { message: err.error ?? "Request failed" });
          return;
        }
        const { schema } = (await res.json()) as { schema: SchemaJSON };
        setParsedData(data);
        setSchemaJson(schema);
        schemaForm.setValue("schema", JSON.stringify(schema, null, 2), {
          shouldValidate: true,
        });
        setSchemaVersion((v) => v + 1);
      } catch (e) {
        dataForm.setError("json", {
          message: e instanceof Error ? e.message : "Network error",
        });
      } finally {
        setGenerating(false);
      }
    },
    [dataForm, schemaForm],
  );

  const handleRandom = async () => {
    const current = EXAMPLE_DATASETS.findIndex(
      (d) => d.label === currentDatasetLabel,
    );
    const next = (current + 1) % EXAMPLE_DATASETS.length;
    const dataset = EXAMPLE_DATASETS[next];
    dataForm.setValue("json", JSON.stringify(dataset.data, null, 2), {
      shouldValidate: true,
    });
    setCurrentDatasetLabel(dataset.label);
    await generateSchema(dataset.data as Record<string, unknown>[]);
  };

  // Generate schema via API
  const handleGenerate = dataForm.handleSubmit(async ({ json }) => {
    const data = JSON.parse(json) as Record<string, unknown>[];
    await generateSchema(data);
  });

  // Apply edited schema text
  const handleApply = schemaForm.handleSubmit(({ schema }) => {
    try {
      const parsed = JSON.parse(schema) as SchemaJSON;
      const definition = deserializeSchema(parsed);
      validateSchema(definition);
      setSchemaJson(parsed);
      setSchemaVersion((v) => v + 1);
    } catch (e) {
      schemaForm.setError("schema", {
        message: e instanceof Error ? e.message : "Invalid schema JSON",
      });
    }
  });

  // Export TypeScript
  const handleExport = async () => {
    if (!schemaJson) return;
    await copy(schemaToTypeScript(schemaJson), { withToast: true });
  };

  return (
    <div className="flex h-screen max-h-screen w-full max-w-full flex-row">
      {/* Left panel */}
      <div className="flex w-[380px] shrink-0 flex-col gap-4 overflow-y-auto p-2">
        <Tabs defaultValue="data" className="flex flex-col gap-3">
          <TabsList className="w-full">
            <TabsTrigger value="data" className="flex-1">
              Data
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex-1" disabled>
              AI <Sparkle className="ml-1 h-3 w-3" />
            </TabsTrigger>
          </TabsList>

          {/* Data tab */}
          <TabsContent value="data" className="mt-0">
            <form onSubmit={handleGenerate} className="flex flex-col gap-2">
              <Controller
                name="json"
                control={dataForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="flex items-center justify-between">
                      <FieldLabel
                        htmlFor="json"
                        className="text-sm font-medium"
                      >
                        JSON Data
                      </FieldLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1.5 px-2 text-xs text-muted-foreground"
                        onClick={handleRandom}
                      >
                        <Shuffle className="h-3 w-3" />
                        {currentDatasetLabel}
                      </Button>
                    </div>
                    <Textarea
                      {...field}
                      id={field.name}
                      className={cn(
                        "font-mono text-xs",
                        fieldState.invalid && "border-destructive",
                      )}
                      rows={7}
                      placeholder={PLACEHOLDER_DATA_JSON}
                      spellCheck={false}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                    <FieldDescription>
                      Paste your JSON data here to generate a live table with an
                      auto-inferred schema.
                    </FieldDescription>
                  </Field>
                )}
              />
              <Button
                type="submit"
                disabled={generating || !dataForm.formState.isValid}
                size="sm"
                className="w-full"
              >
                {generating ? "Generating…" : "Generate Schema"}
              </Button>
            </form>
          </TabsContent>

          {/* AI tab (stub) */}
          <TabsContent value="ai" className="mt-0">
            <div className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">AI Schema Generation</p>
                <p className="text-xs text-muted-foreground">
                  Describe your data in plain English and get a schema generated
                  automatically — no JSON needed.
                </p>
              </div>
              <Input
                placeholder="e.g. A table of HTTP logs with method, status, latency and timestamp…"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Coming soon. Until then, use the{" "}
                <strong className="font-medium text-foreground">Data</strong>{" "}
                tab to paste JSON and infer a schema automatically.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Schema editor — always visible below tabs */}
        <form onSubmit={handleApply} className="flex flex-col gap-2">
          <Controller
            name="schema"
            control={schemaForm.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="schema" className="text-sm font-medium">
                    Schema JSON
                  </FieldLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleExport}
                    disabled={!schemaJson}
                    className="h-6 gap-1.5 px-2 text-xs text-muted-foreground"
                  >
                    {isCopied ? "Copied!" : "Export TS"}
                  </Button>
                </div>
                <Textarea
                  {...field}
                  id={field.name}
                  rows={7}
                  className={cn(
                    "resize-none font-mono text-xs",
                    fieldState.invalid && "border-destructive",
                  )}
                  placeholder='{ "columns": [] }'
                  spellCheck={false}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Button
            type="submit"
            disabled={!schemaForm.formState.isValid}
            size="sm"
            className="w-full"
          >
            Apply
          </Button>
        </form>
      </div>

      {/* Right panel — live table */}
      <div className="min-w-0 flex-1 overflow-auto border-l">
        {schemaJson && parsedData.length > 0 ? (
          <BuilderTable
            data={parsedData}
            schemaJson={schemaJson}
            schemaVersion={schemaVersion}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Paste JSON data and click{" "}
              <strong className="font-medium text-foreground">
                Generate Schema
              </strong>{" "}
              to see a live table here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
