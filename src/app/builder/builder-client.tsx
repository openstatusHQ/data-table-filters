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
import { Sparkle } from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { BuilderTable } from "./builder-table";
import { PLACEHOLDER_DATA, PLACEHOLDER_DATA_JSON } from "./placeholder-data";

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

type DataFormValues = z.infer<typeof dataFormSchema>;

export function BuilderClient() {
  const [parsedData, setParsedData] =
    React.useState<Record<string, unknown>[]>(PLACEHOLDER_DATA);
  const [schemaJson, setSchemaJson] = React.useState<SchemaJSON | null>(
    INITIAL_SCHEMA,
  );
  const [schemaText, setSchemaText] = React.useState(
    JSON.stringify(INITIAL_SCHEMA, null, 2),
  );
  const [schemaVersion, setSchemaVersion] = React.useState(0);
  const [schemaError, setSchemaError] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const { isCopied, copy } = useCopyToClipboard();

  const dataForm = useForm<DataFormValues>({
    resolver: zodResolver(dataFormSchema),
    defaultValues: { json: PLACEHOLDER_DATA_JSON },
    mode: "onChange",
  });

  // Generate schema via API
  const handleGenerate = dataForm.handleSubmit(async ({ json }) => {
    const data = JSON.parse(json) as Record<string, unknown>[];
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
      setSchemaText(JSON.stringify(schema, null, 2));
      setSchemaVersion((v) => v + 1);
      setSchemaError(null);
    } catch (e) {
      dataForm.setError("json", {
        message: e instanceof Error ? e.message : "Network error",
      });
    } finally {
      setGenerating(false);
    }
  });

  // Apply edited schema text
  const handleApply = () => {
    setSchemaError(null);
    try {
      const parsed = JSON.parse(schemaText) as SchemaJSON;
      const definition = deserializeSchema(parsed);
      validateSchema(definition);
      setSchemaJson(parsed);
      setSchemaVersion((v) => v + 1);
    } catch (e) {
      setSchemaError(e instanceof Error ? e.message : "Invalid schema JSON");
    }
  };

  // Export TypeScript
  const handleExport = async () => {
    if (!schemaJson) return;
    await copy(schemaToTypeScript(schemaJson), { withToast: true });
  };

  return (
    <div className="flex h-screen max-h-screen w-full max-w-full flex-row">
      {/* Left panel */}
      <div className="flex max-w-[300px] shrink-0 flex-col gap-3 overflow-y-auto p-2">
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
                    <FieldLabel htmlFor="json" className="sr-only">
                      JSON Data
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id={field.name}
                      className={cn(
                        "font-mono text-xs",
                        fieldState.invalid && "border-destructive",
                      )}
                      rows={10}
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
            <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
              <Input placeholder="Describe your table…" disabled />
              <p className="text-xs text-muted-foreground">
                AI-powered schema generation coming soon.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Schema editor — always visible below tabs */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Schema JSON</p>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={!schemaJson}
              >
                {isCopied ? "Copied!" : "Export TS"}
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!schemaText}
                variant="secondary"
              >
                Apply
              </Button>
            </div>
          </div>
          <Textarea
            className={cn(
              "h-72 resize-none font-mono text-xs",
              schemaError && "border-destructive",
            )}
            placeholder='{ "columns": [] }'
            value={schemaText}
            onChange={(e) => {
              setSchemaText(e.target.value);
              setSchemaError(null);
            }}
            spellCheck={false}
          />
          {schemaError && (
            <p className="text-xs text-destructive">{schemaError}</p>
          )}
        </div>
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
