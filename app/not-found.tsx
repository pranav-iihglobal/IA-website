import Link from "next/link";
import { T } from "@/components/T";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MISC } from "@/lib/content";

// Global 404: rendered by the ROOT layout (which has no site chrome), so it
// pulls in the header and footer itself.
export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex-1">
    <section className="mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center">
      <p className="font-display text-6xl font-bold text-camel">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-russet">
        <T text={MISC.notFoundTitle} />
      </h1>
      <Link
        href="/"
        className="btn-shine mt-8 inline-flex items-center rounded-full bg-alloy px-6 py-3 text-base font-semibold text-cornsilk-light hover:bg-alloy-dark"
      >
        <T text={MISC.backToHome} />
      </Link>
    </section>
      </main>
      <Footer />
    </>
  );
}
