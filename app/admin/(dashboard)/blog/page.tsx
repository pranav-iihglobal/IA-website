import Link from "next/link";
import { PostList } from "@/components/admin/PostList";

export const dynamic = "force-dynamic";

export default function AdminBlogPage() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-russet">Blog</h1>
          <p className="mt-1 text-olive-dark">
            Articles shown in the Learn (જાણકારી) section.
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="rounded-full bg-alloy px-5 py-2.5 text-sm font-semibold text-cornsilk-light transition-colors hover:bg-alloy-dark"
        >
          + New post
        </Link>
      </div>
      <div className="mt-8">
        <PostList />
      </div>
    </>
  );
}
