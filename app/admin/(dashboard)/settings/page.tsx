import { requirePageAccess } from "@/lib/admin/page-guard";
import { getSellerSettings } from "@/lib/admin/settings";
import { recordHistory } from "@/lib/admin/history";
import { SELLER_SETTINGS_ID } from "@/lib/erp/seller";
import { formatIstDateTime } from "@/lib/time";
import { RecordHistory } from "@/components/admin/RecordHistory";
import { SellerSettingsForm } from "@/components/admin/SellerSettingsForm";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/**
 * The seller's own details — GSTIN and bank — on a page instead of in code.
 *
 * Owners only, the same bar as managing people: this is what every legal
 * document the company issues says about the company. Every save is in the
 * history below, field by field, and none of them reaches an invoice already
 * issued — each carries its own copy from the day it was raised.
 */
export default async function SettingsPage() {
  await requirePageAccess("users:manage");

  const [settings, history] = await Promise.all([
    getSellerSettings(),
    recordHistory("Settings", SELLER_SETTINGS_ID),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink-strong sm:text-3xl">Settings</h1>
        <p className="mt-1 text-ink-muted">
          What every invoice says about IKSARVA, and where a customer pays.
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          {settings.saved ? (
            <>
              Last saved {settings.updatedAt ? formatIstDateTime(new Date(settings.updatedAt)) : ""}
              {settings.updatedBy ? ` by ${settings.updatedBy}` : ""}.
            </>
          ) : (
            <>
              Not saved yet — invoices use the details built into the code. Save
              once and this page takes over.
            </>
          )}
        </p>
      </header>

      <SellerSettingsForm
        initial={{ gstin: settings.seller.gstin, bank: settings.seller.bank }}
        version={settings.version}
      />

      <RecordHistory
        entries={history}
        emptyMessage="Never changed here. Every invoice so far was printed from the details in the code."
      />
    </div>
  );
}
