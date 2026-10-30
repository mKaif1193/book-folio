"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  SeparatorHorizontal,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  active?: (e: Editor) => boolean;
  disabled?: (e: Editor) => boolean;
  run: (e: Editor) => void;
};

const GROUPS: Item[][] = [
  [
    { icon: Undo2, label: "Undo", shortcut: "Ctrl+Z", disabled: (e) => !e.can().undo(), run: (e) => e.chain().focus().undo().run() },
    { icon: Redo2, label: "Redo", shortcut: "Ctrl+Shift+Z", disabled: (e) => !e.can().redo(), run: (e) => e.chain().focus().redo().run() },
  ],
  [
    { icon: Pilcrow, label: "Paragraph", shortcut: "Ctrl+Alt+0", active: (e) => e.isActive("paragraph"), run: (e) => e.chain().focus().setParagraph().run() },
    { icon: Heading2, label: "Heading", shortcut: "Ctrl+Alt+2", active: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { icon: Heading3, label: "Subheading", shortcut: "Ctrl+Alt+3", active: (e) => e.isActive("heading", { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  ],
  [
    { icon: Bold, label: "Bold", shortcut: "Ctrl+B", active: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
    { icon: Italic, label: "Italic", shortcut: "Ctrl+I", active: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
    { icon: Underline, label: "Underline", shortcut: "Ctrl+U", active: (e) => e.isActive("underline"), run: (e) => e.chain().focus().toggleUnderline().run() },
    { icon: Strikethrough, label: "Strikethrough", shortcut: "Ctrl+Shift+S", active: (e) => e.isActive("strike"), run: (e) => e.chain().focus().toggleStrike().run() },
    {
      icon: Link2,
      label: "Link",
      active: (e) => e.isActive("link"),
      run: (e) => {
        if (e.isActive("link")) return void e.chain().focus().unsetLink().run();
        const href = window.prompt("Link address", "https://");
        if (href && href !== "https://") e.chain().focus().extendMarkRange("link").setLink({ href }).run();
      },
    },
  ],
  [
    { icon: Quote, label: "Block quote", shortcut: "Ctrl+Shift+B", active: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
    { icon: List, label: "Bulleted list", shortcut: "Ctrl+Shift+8", active: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
    { icon: ListOrdered, label: "Numbered list", shortcut: "Ctrl+Shift+7", active: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
    { icon: SeparatorHorizontal, label: "Scene break", run: (e) => e.chain().focus().setHorizontalRule().run() },
  ],
  [
    { icon: AlignLeft, label: "Align left", active: (e) => e.isActive({ textAlign: "left" }), run: (e) => e.chain().focus().setTextAlign("left").run() },
    { icon: AlignCenter, label: "Align center", active: (e) => e.isActive({ textAlign: "center" }), run: (e) => e.chain().focus().setTextAlign("center").run() },
    { icon: AlignRight, label: "Align right", active: (e) => e.isActive({ textAlign: "right" }), run: (e) => e.chain().focus().setTextAlign("right").run() },
    { icon: AlignJustify, label: "Justify", active: (e) => e.isActive({ textAlign: "justify" }), run: (e) => e.chain().focus().setTextAlign("justify").run() },
  ],
];

const ITEMS = GROUPS.flat();

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  // Re-render only when button states actually change.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e ? ITEMS.map((item) => [item.active?.(e) ?? false, item.disabled?.(e) ?? false]).flat().join("") : "",
  });

  let index = 0;
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1" data-state={state}>
      {GROUPS.map((group, g) => (
        <div key={g} className="flex items-center gap-0.5 border-r pr-1 last:border-r-0">
          {group.map((item) => {
            index++;
            const active = editor ? (item.active?.(editor) ?? false) : false;
            const disabled = !editor || (item.disabled?.(editor) ?? false);
            const Icon = item.icon;
            return (
              <button
                key={`${g}-${index}`}
                type="button"
                title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
                aria-label={item.label}
                aria-pressed={item.active ? active : undefined}
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()} // keep the editor's selection
                onClick={() => editor && item.run(editor)}
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
                  active && "bg-accent text-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
