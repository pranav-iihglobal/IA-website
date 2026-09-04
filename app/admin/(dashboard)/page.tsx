import Link from "next/link";
import { Suspense } from "react";
import { isDatabaseConfigured } from "@/lib/db/connect";
import { currentActiveUser } from "@/lib/auth/current-user";
import { betaNote, can, type Access } from "@/lib/auth/permissions";
import { dashboardData, greeting } from "@/lib/admin/dashboard";
import { formatIstDateLong } from "@/lib/time";
import { CardsSkeleton, DashboardCards } from "@/components/admin/DashboardCards";
import { ErrorBanner } from "@/components/admin/ui";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * The first screen, brought level with the modules built since it.
 *
 * It predates the CRM and ERP and read like the CMS landing page it was:
 * "Manage products, testimonials and blog posts", one primary action (New
 * product), two tile designs, and seeded sales summed into "this month"
 * silently. Now: a greeting and the date in IST, the day's actions beside
 * the title, then the shape of the business as charts — twelve months of
 * sales, products this month against last, the debt by age, the lead funnel
 * — and the cards, each gated on the viewer's own access, each line a link,
 * every figure real. The Today panel was tried and taken out at the
 * directors' request; its follow-up list is one tap away on Leads.
 */

const NOBODY: Access = { role: "viewer", modules: {} };

/**
 * The cards and the queries behind them, streamed after the page shell.
 *
 * The await is inside the try, the JSX is not: React renders a component
 * lazily, so JSX built inside a try/catch is not protected by it. One error
 * shape — the same banner the lists use — instead of the two the page had.
 */
async function CardsSection({ access, canNewProduct }: { access: Access; canNewProduct: boolean }) {
  if (!isDatabaseConfigured()) {
    return (
      <ErrorBanner message="The database is not connected. Set MONGODB_URI in .env.local (local) or in Vercel's environment variables (production), then run npm run seed once." />
    );
  }
  let data;
  try {
    data = await dashboardData(access);
  } catch (error) {
    console.error("[dashboard] could not read the figures", error);
    return (
      <ErrorBanner message="Could not reach the database. Check the connection string, and that this deployment's IP is allowed in Atlas (Network Access → 0.0.0.0/0 for Vercel)." />
    );
  }
  return (
    <DashboardCards
      data={data}
      beta={{ crm: betaNote("crm"), billing: betaNote("billing") }}
      canNewProduct={canNewProduct}
    />
  );
}

export default async function AdminDashboardPage() {
  /*
    The one page everyone with access can reach, so it must not leak the
    shape of modules they cannot see. A card is both a link and a count —
    "Customers 31" to someone with no CRM access tells them something and
    then refuses to elaborate. dashboardData() and todayPanel() both take
    the viewer's access and leave those sections out entirely.
  */
  const me = await currentActiveUser();
  const access: Access = me ? { role: me.role, modules: me.modules } : NOBODY;
  const now = new Date();
  const seesAnything = ["billing:read", "crm:read", "products:read", "testimonials:read", "posts:read"].some(
    (p) => can(me, p as Parameters<typeof can>[1]),
  );

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink-strong sm:text-3xl">
            {greeting(now, me?.name ?? "")}
          </h1>
          {/* The day, in IST. Seasonality is the shape of this business, and
              a page that never says "September" reads the same every month. */}
          <p className="mt-1 text-sm text-ink-muted">
            {seesAnything
              ? `Today, ${formatIstDateLong(now)}.`
              : "You have no modules yet. Ask an owner for access."}
          </p>
        </div>
        {/* The daily actions. New product moved into the Content card;
            logging a call needs a contact first and stays on the profile. */}
        <div className="flex flex-wrap gap-2">
          {can(me, "billing:write") && (
            <Link href="/admin/invoices/new" className="admin-btn admin-btn-primary admin-tap">
              Raise invoice
            </Link>
          )}
          {can(me, "crm:write") && (
            <Link
              href="/admin/leads/new"
              className="admin-btn admin-tap border border-line bg-raised/70 text-ink hover:border-olive"
            >
              Add lead
            </Link>
          )}
        </div>
      </header>

      <div className="mt-6 min-w-0">
        <Suspense fallback={<CardsSkeleton />}>
          <CardsSection access={access} canNewProduct={can(me, "products:write")} />
        </Suspense>
      </div>
    </>
  );
}
