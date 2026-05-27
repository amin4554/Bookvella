import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

const LEGAL_LINKS = [
  { href: "/legal/impressum", label: "Impressum" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/cookies", label: "Cookie settings" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/contact", label: "Contact / Report" },
];

export function LegalFooter({
  className,
  note,
}: {
  className?: string;
  note?: string;
}) {
  return (
    <footer className={cn("border-t border-line-cream bg-surface-page", className)}>
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-6 text-[12px] text-ink-soft">
        <div className="flex items-center gap-2">
          <BrandLogo variant="icon" size="sm" />
          <span className="font-bold text-ink-strong">Bookvella</span>
          <span className="text-ink-muted">Copyright 2026</span>
          {note ? <span className="hidden text-ink-muted sm:inline">{note}</span> : null}
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-semibold hover:text-ink-strong"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function LegalInlineLinks({ className }: { className?: string }) {
  return (
    <nav
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-ink-muted",
        className,
      )}
    >
      {LEGAL_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="font-semibold hover:text-ink-strong"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
