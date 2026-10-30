import type { Metadata } from "next";
import { Bookshelf } from "./bookshelf";

export const metadata: Metadata = { title: "Books" };

export default function BooksPage() {
  return <Bookshelf />;
}
