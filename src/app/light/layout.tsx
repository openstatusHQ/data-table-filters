"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ChevronRight, Database } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Button
        className="fixed left-1.5 top-1.5 z-[100] -translate-y-12 opacity-0 transition-all focus-visible:translate-y-0 focus-visible:opacity-100"
        asChild
      >
        <Link id="skip-to-content" href="#content">
          Skip to content
        </Link>
      </Button>
      {children}
      <div className="fixed bottom-4 left-4 z-50">
        <APIDialog />
      </div>
      <div className="fixed bottom-4 right-4 z-50">
        <ButtonPile />
      </div>
    </>
  );
}

function ButtonPile() {
  return (
    <div className="group/pile relative pt-1.5">
      <Button asChild className="group">
        <a
          href="https://github.com/openstatusHQ/data-table-filters"
          target="_blank"
          rel="noreferrer"
        >
          <span className="mr-1">View GitHub Repo</span>
          <ArrowRight className="relative mb-[1px] inline h-4 w-0 transition-all group-hover:w-4" />
          <ChevronRight className="relative mb-[1px] inline h-4 w-4 transition-all group-hover:w-0" />
        </a>
      </Button>
      <Button
        asChild
        className="group absolute -right-1.5 top-0 -z-10 opacity-70 transition-transform group-hover/pile:-translate-x-1.5 group-hover/pile:-translate-y-10 group-hover/pile:opacity-100"
      >
        <a href="https://light.openstatus.dev" target="_blank" rel="noreferrer">
          <span className="mr-1">Explore Light OS</span>
          <ArrowRight className="relative mb-[1px] inline h-4 w-0 transition-all group-hover:w-4" />
          <ChevronRight className="relative mb-[1px] inline h-4 w-4 transition-all group-hover:w-0" />
        </a>
      </Button>
    </div>
  );
}

function APIDialog() {
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState("https://light.openstatus.dev");

  useEffect(() => {
    const cookieList = document.cookie.split(";");
    const tbEndpoint = cookieList.find((cookie) =>
      cookie.startsWith("tb_endpoint="),
    );
    console.log(tbEndpoint);
    if (tbEndpoint) {
      setEndpoint(decodeURIComponent(tbEndpoint.split("=")[1]));
    }
  }, []);

  const handleSave = () => {
    document.cookie = `tb_endpoint=${encodeURIComponent(endpoint)}; path=/; max-age=${60 * 60 * 24 * 365}`;
    window.location.reload();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon">
          <Database className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tinybird Pipes</DialogTitle>
          <DialogDescription>
            Update the API endpoint to use a different OpenStatus instance.
            Defaults to <code>https://light.openstatus.dev</code>
          </DialogDescription>
        </DialogHeader>
        <Input
          id="endpoint"
          placeholder="https://light.openstatus.dev"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
        />
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
