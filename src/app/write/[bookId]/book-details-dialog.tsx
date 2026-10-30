"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Book } from "@/lib/library/db";
import { updateBook } from "@/lib/library/repo";

export function BookDetailsDialog({
  book,
  open,
  onOpenChange,
}: {
  book: Book;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const submit = async (formData: FormData) => {
    await updateBook(book.id, {
      title: String(formData.get("title") ?? "").trim() || "Untitled book",
      subtitle: String(formData.get("subtitle") ?? "").trim(),
      author: String(formData.get("author") ?? "").trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Book details</DialogTitle>
          <DialogDescription>Used on the title page, running heads and exports.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="book-title">Title</Label>
            <Input id="book-title" name="title" defaultValue={book.title} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="book-subtitle">Subtitle</Label>
            <Input id="book-subtitle" name="subtitle" defaultValue={book.subtitle} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="book-author">Author / pen name</Label>
            <Input id="book-author" name="author" defaultValue={book.author} />
          </div>
          <DialogFooter>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
