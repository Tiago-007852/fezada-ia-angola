import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <Link to="/" className="mb-6 inline-block font-display text-xl font-bold">
        Fezada<span className="text-primary"> IA</span>
      </Link>
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>
      <p className="mb-6 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        Rascunho de modelo: preenche os campos entre [parênteses rectos] e faz rever este texto por
        um jurista angolano antes de o publicares.
      </p>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}
