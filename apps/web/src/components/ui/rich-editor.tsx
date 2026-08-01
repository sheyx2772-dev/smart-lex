"use client";

import { ArrowUUpLeft, ArrowUUpRight, ListBullets, ListNumbers, Quotes, TextB, TextHOne, TextHTwo, TextItalic } from "@phosphor-icons/react";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

/** Professional hujjat editori (TipTap). HTML qaytaradi — bold/sarlavha/ro'yxat. */
export function RichEditor({
  value,
  onChange,
  className,
  onReady,
  paper,
}: {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  onReady?: (editor: Editor) => void;
  /** A4 "qog'oz" rejimi — hujjatni xuddi Microsoft Word ekranidek (oq A4 list) ko'rsatadi. */
  paper?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: value,
    editorProps: {
      attributes: {
        class: paper
          ? "prose-doc a4-sheet mx-auto my-8 w-[210mm] max-w-full min-h-[297mm] bg-white px-[22mm] py-[20mm] text-[11.5pt] leading-[1.6] text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.14),0_14px_34px_-12px_rgba(0,0,0,0.3)] outline-none [font-family:'Times_New_Roman','PT_Serif',Georgia,serif] print:my-0 print:w-full print:shadow-none"
          : "prose-doc min-h-full p-4 text-[13.5px] leading-relaxed outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Tashqaridan value o'zgarsa (masalan boshqa hujjat tanlansa) sinxronlash.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (editor && onReady) onReady(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  const Btn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-primary-soft text-primary",
      )}
    >
      {children}
    </button>
  );

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background", className)}>
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border bg-muted/30 px-1.5 py-1">
        <Btn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <TextB weight="bold" className="size-4" />
        </Btn>
        <Btn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <TextItalic className="size-4" />
        </Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn title="Sarlavha" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <TextHOne className="size-4" />
        </Btn>
        <Btn title="Kichik sarlavha" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <TextHTwo className="size-4" />
        </Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn title="Ro'yxat" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <ListBullets className="size-4" />
        </Btn>
        <Btn title="Raqamli ro'yxat" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListNumbers className="size-4" />
        </Btn>
        <Btn title="Iqtibos" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quotes className="size-4" />
        </Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn title="Orqaga" onClick={() => editor.chain().focus().undo().run()}>
          <ArrowUUpLeft className="size-4" />
        </Btn>
        <Btn title="Oldinga" onClick={() => editor.chain().focus().redo().run()}>
          <ArrowUUpRight className="size-4" />
        </Btn>
      </div>
      <EditorContent editor={editor} className={cn("scroll-clean min-h-0 flex-1 overflow-auto", paper && "bg-neutral-200/70 dark:bg-neutral-950/60")} />
    </div>
  );
}
