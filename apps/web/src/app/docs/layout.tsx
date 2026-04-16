import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { DocsSidebar, getAllSections } from "@/lib/mdx";
import { cn } from "@/lib/utils";

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sections = await getAllSections("docs");

  return (
    <main className="container mx-auto flex min-h-screen w-full flex-col gap-6 p-4 sm:p-6 xl:gap-8 xl:p-8">
      <Header page="docs" sections={sections} />
      <div className="border-border border-b border-dashed" />
      <div
        className={cn(
          "relative mx-auto w-full max-w-6xl flex-1",
          "md:grid md:grid-cols-[220px_1fr] md:gap-8",
          "xl:grid-cols-[220px_1fr_220px]",
        )}
      >
        <DocsSidebar sections={sections} />
        {children}
      </div>
      <div className="border-border border-b border-dashed" />
      <Footer />
    </main>
  );
}
