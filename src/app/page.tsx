import { redirect } from "next/navigation";

// Personal mode: open straight onto the bookshelf.
export default function Home() {
  redirect("/books");
}
