import { toDisplayHtml } from "@/lib/doc-html";
import { cn } from "@/lib/utils";

/** Hujjat matnini faqat o'qish uchun ko'rsatadi (HTML yoki oddiy matn — ikkalasi ham). */
export function DocumentView({ body, className }: { body: string; className?: string }) {
  return (
    <div
      className={cn("prose-doc rounded-lg border border-border bg-background p-4 text-[13.5px] leading-relaxed", className)}
      dangerouslySetInnerHTML={{ __html: toDisplayHtml(body) }}
    />
  );
}
