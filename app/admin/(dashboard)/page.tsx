import Link from "next/link";
import { connectToDatabase, isDatabaseConfigured } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { Testimonial } from "@/lib/db/models/Testimonial";
import { Post } from "@/lib/db/models/Post";

export const dynamic = "force-dynamic";

async function getCounts() {
  await connectToDatabase();
  const [products, productDrafts, testimonials, testimonialDrafts, posts, postDrafts] =
    await Promise.all([
      Product.countDocuments({ status: "published" }),
      Product.countDocuments({ status: "draft" }),
      Testimonial.countDocuments({ status: "published" }),
      Testimonial.countDocuments({ status: "draft" }),
      Post.countDocuments({ status: "published" }),
      Post.countDocuments({ status: { $in: ["draft", "scheduled"] } }),
    ]);
  return {
    products,
    productDrafts,
    testimonials,
    testimonialDrafts,
    posts,
    postDrafts,
  };
}

function StatCard({
  title,
  href,
  published,
  drafts,
  draftLabel = "drafts",
}: {
  title: string;
  href: string;
  published: number;
  drafts: number;
  draftLabel?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-cornsilk-dark bg-cornsilk-light p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-olive">
        {title}
      </p>
      <p className="mt-2 font-display text-4xl font-bold text-russet">
        {published}
      </p>
      <p className="mt-1 text-sm text-russet-dark/70">
        published{drafts > 0 ? ` · ${drafts} ${draftLabel}` : ""}
      </p>
    </Link>
  );
}

function SetupNotice() {
  return (
    <div className="max-w-2xl rounded-2xl border border-camel bg-meringue-light p-6">
      <h2 className="font-display text-xl font-bold text-russet">
        Database not connected
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-russet-dark">
        <code className="rounded bg-cornsilk px-1.5 py-0.5">MONGODB_URI</code> is
        not set, so there is nothing to manage yet. Add it to{" "}
        <code className="rounded bg-cornsilk px-1.5 py-0.5">.env.local</code>{" "}
        (local) and to Vercel → Settings → Environment Variables (production),
        then run <code className="rounded bg-cornsilk px-1.5 py-0.5">npm run seed</code>{" "}
        once to import the existing products, testimonials and articles.
      </p>
      <p className="mt-3 text-sm text-russet-dark/80">
        See <code className="rounded bg-cornsilk px-1.5 py-0.5">.env.example</code>{" "}
        and the README for the full setup steps.
      </p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const configured = isDatabaseConfigured();
  let counts: Awaited<ReturnType<typeof getCounts>> | null = null;
  let error: string | null = null;

  if (configured) {
    try {
      counts = await getCounts();
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not reach the database";
    }
  }

  return (
    <>
      <h1 className="font-display text-3xl font-bold text-russet">Dashboard</h1>
      <p className="mt-1 text-olive-dark">
        Manage products, testimonials and blog posts.
      </p>

      <div className="mt-8">
        {!configured && <SetupNotice />}

        {configured && error && (
          <div className="max-w-2xl rounded-2xl border border-alloy/40 bg-alloy/10 p-6">
            <h2 className="font-display text-xl font-bold text-russet">
              Could not reach the database
            </h2>
            <p className="mt-2 text-sm text-russet-dark">{error}</p>
            <p className="mt-2 text-sm text-russet-dark/80">
              Check the connection string and that this deployment&rsquo;s IP is
              allowed in Atlas (Network Access → 0.0.0.0/0 for Vercel).
            </p>
          </div>
        )}

        {counts && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Products"
              href="/admin/products"
              published={counts.products}
              drafts={counts.productDrafts}
            />
            <StatCard
              title="Testimonials"
              href="/admin/testimonials"
              published={counts.testimonials}
              drafts={counts.testimonialDrafts}
            />
            <StatCard
              title="Blog posts"
              href="/admin/blog"
              published={counts.posts}
              drafts={counts.postDrafts}
              draftLabel="draft/scheduled"
            />
          </div>
        )}
      </div>
    </>
  );
}
