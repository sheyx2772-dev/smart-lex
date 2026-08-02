"use client";

import {
  ArrowUUpLeft,
  ArrowUUpRight,
  ListBullets,
  ListNumbers,
  Quotes,
  Table as TableIcon,
  TextAlignCenter,
  TextAlignJustify,
  TextAlignLeft,
  TextAlignRight,
  TextB,
  TextHOne,
  TextHTwo,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
} from "@phosphor-icons/react";
import { Highlight } from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const FONTS = ["Times New Roman", "Arial", "Georgia", "Calibri", "Verdana", "Courier New"];
const SIZES = ["10", "11", "12", "14", "16", "18", "20", "24", "28", "36", "48"];
const SPACING = [
  { label: "1.0", v: "1.2" },
  { label: "1.15", v: "1.4" },
  { label: "1.5", v: "1.65" },
  { label: "2.0", v: "2.1" },
];

/** Word-darajali hujjat editori (TipTap v3): font, o'lcham, rang, tekislash, jadval, A4 qog'oz. */
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
  paper?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyleKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      TableKit.configure({ table: { resizable: true } }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: paper
          ? "prose-doc a4-sheet mx-auto my-8 w-[210mm] min-h-[297mm] bg-white px-[22mm] py-[20mm] text-[11.5pt] leading-[1.6] text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.14),0_14px_34px_-12px_rgba(0,0,0,0.3)] outline-none [font-family:'Times_New_Roman','PT_Serif',Georgia,serif] print:my-0 print:w-full print:shadow-none"
          : "prose-doc min-h-full p-4 text-[13.5px] leading-relaxed outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (editor && onReady) onReady(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  const Btn = ({ active, onClick, children, title, disabled }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string; disabled?: boolean }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
        active && "bg-primary-soft text-primary",
      )}
    >
      {children}
    </button>
  );
  const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-border" />;
  const selCls = "h-8 rounded-md border border-border bg-card px-1.5 text-xs outline-none hover:border-muted-foreground/30 focus:border-primary/50";

  const curFont = editor.getAttributes("textStyle").fontFamily ?? "";
  const curSize = (editor.getAttributes("textStyle").fontSize ?? "").replace(/px|pt/, "");

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background", className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-1.5 py-1">
        <Btn title="Orqaga" onClick={() => editor.chain().focus().undo().run()}>
          <ArrowUUpLeft className="size-4" />
        </Btn>
        <Btn title="Oldinga" onClick={() => editor.chain().focus().redo().run()}>
          <ArrowUUpRight className="size-4" />
        </Btn>
        <Sep />
        <select className={selCls} title="Shrift" value={curFont} onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}>
          <option value="">Shrift</option>
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select className={selCls} title="O'lcham" value={curSize} onChange={(e) => editor.chain().focus().setFontSize(`${e.target.value}pt`).run()}>
          <option value="">O'lcham</option>
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Sep />
        <Btn title="Qalin (Bold)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <TextB weight="bold" className="size-4" />
        </Btn>
        <Btn title="Kursiv (Italic)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <TextItalic className="size-4" />
        </Btn>
        <Btn title="Tag chizish (Underline)" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <TextUnderline className="size-4" />
        </Btn>
        <Btn title="O'chirilgan (Strike)" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <TextStrikethrough className="size-4" />
        </Btn>
        {/* Matn rangi */}
        <label className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted" title="Matn rangi">
          <span className="text-[13px] font-bold leading-none">A</span>
          <span className="-mt-0.5 h-1 w-4 rounded-sm bg-red-500" />
          <input type="color" className="sr-only" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
        </label>
        {/* Ajratib ko'rsatish (highlight) */}
        <label className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted" title="Ajratib ko'rsatish">
          <span className="rounded-sm bg-yellow-300 px-1 text-[12px] font-bold leading-tight text-neutral-800">H</span>
          <input type="color" className="sr-only" defaultValue="#fef08a" onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()} />
        </label>
        <Sep />
        <Btn title="Chapga" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <TextAlignLeft className="size-4" />
        </Btn>
        <Btn title="Markazga" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <TextAlignCenter className="size-4" />
        </Btn>
        <Btn title="O'ngga" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <TextAlignRight className="size-4" />
        </Btn>
        <Btn title="Kenglikka" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
          <TextAlignJustify className="size-4" />
        </Btn>
        <select className={selCls} title="Chiziq oralig'i" onChange={(e) => e.target.value && editor.chain().focus().setLineHeight(e.target.value).run()} value="">
          <option value="">↕</option>
          {SPACING.map((s) => (
            <option key={s.v} value={s.v}>
              {s.label}
            </option>
          ))}
        </select>
        <Sep />
        <Btn title="Sarlavha" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <TextHOne className="size-4" />
        </Btn>
        <Btn title="Kichik sarlavha" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <TextHTwo className="size-4" />
        </Btn>
        <Btn title="Belgili ro'yxat" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <ListBullets className="size-4" />
        </Btn>
        <Btn title="Raqamli ro'yxat" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListNumbers className="size-4" />
        </Btn>
        <Btn title="Iqtibos" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quotes className="size-4" />
        </Btn>
        <Btn title="Jadval qo'shish" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <TableIcon className="size-4" />
        </Btn>
      </div>
      <EditorContent editor={editor} className={cn("scroll-clean min-h-0 flex-1 overflow-auto", paper && "bg-neutral-200/70 dark:bg-neutral-950/60")} />
    </div>
  );
}
