import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { getAllSections } from "@/lib/mdx";

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sections = await getAllSections("docs");

  return (
    <main className="container mx-auto flex min-h-screen w-full flex-col gap-6 p-4 sm:p-6 xl:gap-8 xl:p-8">
      <Header page="home" sections={sections} />
      <div className="border-border border-b border-dashed" />
      <div>{children}</div>
      <div className="border-border border-b border-dashed" />
      <Footer />
    </main>
  );
}
