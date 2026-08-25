import Link from "next/link";
import { EMPTY_POST, PostForm } from "@/components/admin/PostForm";

export const dynamic = "force-dynamic";

export default function NewPostPage() {
  return (
    <>
      <nav className="mb-4 text-sm">
        <Link href="/admin/blog" className="text-alloy-dark hover:underline">
          ← Blog
        </Link>
      </nav>
      <h1 className="font-display text-3xl font-bold text-russet">New post</h1>
      <div className="mt-8">
        <PostForm initial={EMPTY_POST} />
      </div>
    </>
  );
}
