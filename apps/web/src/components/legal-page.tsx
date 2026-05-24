import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LegalFooter } from "@/components/legal-footer";
import { cn } from "@/lib/utils";

export function LegalPage({
  eyebrow = "Legal",
  title,
  intro,
  maxWidth = "max-w-[820px]",
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  intro: string;
  maxWidth?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FFFBF7] text-[#0B1220]">
      <header className="border-b border-[#EEE7DF] bg-white">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandLogo />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[12px] font-bold text-[#9CA3AF] hover:text-[#0B1220]"
          >
            <ArrowLeft className="size-3.5" /> Back to site
          </Link>
        </div>
      </header>

      <main className={cn("mx-auto px-6 py-14", maxWidth)}>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9CA3AF]">
          {eyebrow}
        </p>
        <h1
          className="mt-2 text-[40px] font-extrabold md:text-[52px]"
          style={{ letterSpacing: "-0.03em", lineHeight: "1.04" }}
        >
          {title}
        </h1>
        <p className="mt-4 text-[14px] leading-[1.65] text-[#6B7280]">
          {intro}
        </p>

        {children}
      </main>

      <LegalFooter />
    </div>
  );
}

export function LegalProse({ children }: { children: ReactNode }) {
  return (
    <div className="legal-prose mt-8">
      {children}
    </div>
  );
}

export function Toc({
  items,
}: {
  items: Array<{ href: string; label: string }>;
}) {
  return (
    <nav className="mt-8 rounded-2xl border border-[#EEE7DF] bg-white p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
        On this page
      </p>
      <ol className="mt-3 grid list-decimal gap-1.5 pl-5 marker:text-[#9CA3AF] sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="text-[13px] font-bold text-[#374151] hover:text-[#FF5F63]"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function LegalTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-[#EEE7DF] bg-white">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="border-b border-[#EEE7DF] bg-[#FFFBF7] px-3 py-2.5 text-left text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9CA3AF]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="border-b border-[#EEE7DF] px-3 py-3 align-top text-[#374151] last:border-b-0"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
