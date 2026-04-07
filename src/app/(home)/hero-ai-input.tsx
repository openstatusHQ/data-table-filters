"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import * as React from "react";

export function HeroAIInput({
  className,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit">) {
  const [description, setDescription] = React.useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) return;
    const params = new URLSearchParams({ prompt: trimmed });
    router.push(`/builder?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex gap-2", className)}
      {...props}
    >
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe a table... e.g. API logs with status, latency, region"
        className="flex-1 shadow-none"
        maxLength={500}
      />
      <Button
        type="submit"
        disabled={!description.trim()}
        className="shadow-none"
      >
        Generate Table
      </Button>
    </form>
  );
}
