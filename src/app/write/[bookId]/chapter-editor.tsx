"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { EditorToolbar } from "./editor-toolbar";

export type SaveState = "saved" | "saving" | "unsaved";

export type ChapterEditorHandle = { flush: () => Promise<void> };

type Props = {
  initialContent: JSONContent | null;
  onSave: (content: JSONContent, wordCount: number) => Promise<void>;
  onSaveStateChange: (state: SaveState) => void;
  onWordCountChange: (words: number) => void;
  focusMode: boolean;
};

const SAVE_DELAY_MS = 600;

export const ChapterEditor = forwardRef<ChapterEditorHandle, Props>(function ChapterEditor(
  { initialContent, onSave, onSaveStateChange, onWordCountChange, focusMode },
  ref,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  // Keep the latest callbacks without re-creating the editor.
  const callbacks = useRef({ onSave, onSaveStateChange, onWordCountChange });
  callbacks.current = { onSave, onSaveStateChange, onWordCountChange };

  const save = async (editor: Editor) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    callbacks.current.onSaveStateChange("saving");
    await callbacks.current.onSave(editor.getJSON(), editor.storage.characterCount.words());
    if (!dirty.current) callbacks.current.onSaveStateChange("saved");
  };

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Typography, // smart quotes, em dashes, ellipses as you type
      CharacterCount,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: initialContent ?? "",
    editorProps: {
      attributes: {
        class: "manuscript",
        spellcheck: "true",
        // Grammarly rewrites contenteditable DOM and fights the editor; keep it out of the writing area.
        "data-gramm": "false",
        "data-gramm_editor": "false",
        "data-enable-grammarly": "false",
      },
    },
    onCreate: ({ editor }) => callbacks.current.onWordCountChange(editor.storage.characterCount.words()),
    onUpdate: ({ editor }) => {
      dirty.current = true;
      callbacks.current.onSaveStateChange("unsaved");
      callbacks.current.onWordCountChange(editor.storage.characterCount.words());
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(editor), SAVE_DELAY_MS);
    },
  });

  useImperativeHandle(ref, () => ({ flush: async () => (editor ? save(editor) : undefined) }), [editor]);

  // Save pending text when switching chapters, leaving the page, or hiding the tab.
  useEffect(() => {
    if (!editor) return;
    const flush = () => void save(editor);
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [editor]);

  return (
    <div className="flex flex-col">
      <div
        className={`sticky top-0 z-10 -mx-2 bg-background/90 px-2 py-2 backdrop-blur transition-opacity ${
          focusMode ? "opacity-0 hover:opacity-100 focus-within:opacity-100" : ""
        }`}
      >
        <EditorToolbar editor={editor} />
      </div>
      <EditorContent editor={editor} className="pt-4" />
    </div>
  );
});
