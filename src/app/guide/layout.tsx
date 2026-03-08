import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function MDXLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="container mx-auto px-4 py-8">
      <Button asChild variant="link" className="-ml-4">
        <Link href="/">
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Link>
      </Button>
      <Separator className="my-6" />
      {children}
    </main>
  );
}
