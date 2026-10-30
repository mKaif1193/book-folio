"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CHAPTER_TYPES, type Chapter, type ChapterSection, type ChapterType } from "@/lib/library/db";
import { cn } from "@/lib/utils";

const SECTIONS: { id: ChapterSection; label: string; types: ChapterType[] }[] = [
  { id: "front", label: "Front matter", types: ["dedication", "epigraph", "foreword", "preface", "introduction", "copyright", "custom"] },
  { id: "body", label: "Chapters", types: ["chapter", "prologue", "epilogue", "part"] },
  { id: "back", label: "Back matter", types: ["acknowledgments", "afterword", "about-author", "also-by", "custom"] },
];

type Props = {
  chapters: Chapter[];
  activeId: string | null;
  activeWords: number;
  onSelect: (id: string) => void;
  onAdd: (section: ChapterSection, type: ChapterType) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDelete: (chapter: Chapter) => void;
};

export function ChapterSidebar({ chapters, activeId, activeWords, onSelect, onAdd, onMove, onDelete }: Props) {
  let chapterNumber = 0;

  return (
    <nav aria-label="Chapters" className="flex flex-col gap-5 p-3">
      {SECTIONS.map((section) => {
        const items = chapters.filter((c) => c.section === section.id);
        return (
          <section key={section.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-2">
              <h2 className="font-sans text-xs font-medium tracking-wide text-muted-foreground uppercase">{section.label}</h2>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Add to ${section.label.toLowerCase()}`}
                >
                  <Plus className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {section.types.map((type) => (
                    <DropdownMenuItem key={type} onClick={() => onAdd(section.id, type)}>
                      {CHAPTER_TYPES[type]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {items.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground/70">Nothing here yet</p>}

            <ul className="flex flex-col">
              {items.map((chapter, i) => {
                const active = chapter.id === activeId;
                const number = chapter.type === "chapter" ? ++chapterNumber : null;
                const words = active ? activeWords : chapter.wordCount;
                return (
                  <li key={chapter.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onSelect(chapter.id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-muted",
                        active && "bg-accent font-medium text-foreground",
                      )}
                    >
                      <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{number ?? ""}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {chapter.title || <span className="text-muted-foreground italic">Untitled</span>}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums group-hover:invisible group-focus-within:invisible">
                        {words ? words.toLocaleString() : ""}
                      </span>
                    </button>
                    <div className="absolute top-1/2 right-1 hidden -translate-y-1/2 items-center gap-0.5 rounded-md bg-muted group-focus-within:flex group-hover:flex">
                      <IconButton label="Move up" disabled={i === 0} onClick={() => onMove(chapter.id, -1)} icon={ArrowUp} />
                      <IconButton label="Move down" disabled={i === items.length - 1} onClick={() => onMove(chapter.id, 1)} icon={ArrowDown} />
                      <IconButton label="Delete" onClick={() => onDelete(chapter)} icon={Trash2} destructive />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}

function IconButton(props: {
  label: string;
  icon: typeof Plus;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn(
        "rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30",
        props.destructive && "hover:text-destructive",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
