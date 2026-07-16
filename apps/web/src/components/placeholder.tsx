import { Construction } from "lucide-react";

export function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <div className="w-full">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-20 text-center">
        <div className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Construction className="size-6" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{note ?? "Tez orada — birin-ketin quramiz."}</p>
      </div>
    </div>
  );
}
