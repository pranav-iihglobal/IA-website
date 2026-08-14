import Link from "next/link";
import { T } from "@/components/T";
import { MISC } from "@/lib/content";

export default function NotFound() {
  return (
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
  );
}
