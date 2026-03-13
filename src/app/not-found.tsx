import { Link } from "@/components/custom/link";

const links = [
  { href: "/", label: "Homepage" },
  { href: "/docs/introduction", label: "Documentation" },
  { href: "/infinite", label: "Infinite Scrolling" },
  { href: "/drizzle", label: "Drizzle ORM" },
  { href: "/builder", label: "Schema Builder" },
];

export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-screen flex-col justify-center gap-4 p-8 sm:p-16">
      <h1 className="text-foreground font-mono text-6xl font-bold tracking-tight">
        404
      </h1>
      <p className="text-muted-foreground font-mono text-lg">Page not found.</p>
      <p className="text-muted-foreground font-mono text-base">
        We couldn&apos;t find the page you were looking for. <br />
        Try one of the following pages:
      </p>
      <ul className="text-muted-foreground grid list-inside list-disc gap-1 font-mono text-base">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
