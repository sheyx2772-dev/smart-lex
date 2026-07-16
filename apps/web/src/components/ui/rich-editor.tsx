"use client";

import { ListBullets, ListNumbers, TextB, TextHOne, TextHTwo, TextItalic } from "@phosphor-icons/react";
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
}: {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  onReady?: (editor: Editor) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: value,
    editorProps: {
      attributes: {
        class: "prose-doc min-h-full p-4 text-[13.5px] leading-relaxed outline-none",
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
      </div>
      <EditorContent editor={editor} className="scroll-clean min-h-0 flex-1 overflow-y-auto" />
    </div>
  );
}
