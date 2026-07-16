import { Construction } from "lucide-react";

export function PageStub({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        <Construction className="h-5 w-5 text-primary" />
        <span>Módulo em construção. Estrutura, RBAC e navegação já estão prontos — a implementação virá em próximas iterações.</span>
      </div>
    </div>
  );
}