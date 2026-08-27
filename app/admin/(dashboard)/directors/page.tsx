import { auth } from "@/auth";
import { DirectorList } from "@/components/admin/DirectorList";

export const dynamic = "force-dynamic";

export const metadata = { title: "Directors" };

export default async function DirectorsPage() {
  // The layout has already established that this session is authorised; the
  // address is only needed so the list can mark "you" and refuse self-removal.
  const session = await auth();

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold text-russet">
          Directors
        </h1>
        <p className="mt-1 text-olive-dark">
          Everyone who can sign in to this panel. Changes take effect on their
          next request.
        </p>
      </header>
      <div className="mt-8">
        <DirectorList currentEmail={session?.user?.email ?? ""} />
      </div>
    </>
  );
}
