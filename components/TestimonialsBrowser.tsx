"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Bi } from "@/lib/content";
import { TESTIMONIALS_PAGE, districtHeading, resolveText } from "@/lib/content";
import { useLanguage } from "./LanguageProvider";
import { Reveal } from "./Reveal";
import { TestimonialCard, type TestimonialCardData } from "./TestimonialCard";

/**
 * Filterable testimonial grid.
 *
 * Filtering happens in the browser over the full published list rather than
 * on the server via searchParams: reading searchParams would make
 * /testimonials dynamic and cost it its ISR cache, and the list is a few
 * dozen items. The URL is kept in sync with history.replaceState so a
 * filtered view is still shareable, without a navigation or a refetch.
 */

export interface BrowserTestimonial extends TestimonialCardData {
  district: string;
  productSlug: string | null;
}

interface FilterOption {
  value: string;
  label: Bi;
}

const PARAMS = { district: "district", crop: "crop", product: "product" } as const;

type FilterKey = keyof typeof PARAMS;

function Select({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: Bi;
  value: string;
  options: FilterOption[];
  allLabel: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLanguage();
  if (options.length === 0) return null;

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
      <span className="text-xs font-semibold uppercase tracking-wide text-olive">
        {t(label)}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-full border border-camel bg-cornsilk-light py-2 pl-4 pr-9 text-sm font-medium text-russet outline-none transition-colors hover:border-olive focus:border-olive focus:ring-2 focus:ring-olive/25 sm:w-48"
        >
          <option value="">{allLabel}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-camel-dark"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.5 7.5 10 12l4.5-4.5H5.5Z" />
        </svg>
      </div>
    </label>
  );
}

export function TestimonialsBrowser({
  testimonials,
}: {
  testimonials: BrowserTestimonial[];
}) {
  const { lang, t } = useLanguage();
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    district: "",
    crop: "",
    product: "",
  });

  // Restore filters from the URL after mount, so the server-rendered HTML
  // (the unfiltered list) always matches the first client render.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters({
      district: params.get(PARAMS.district) ?? "",
      crop: params.get(PARAMS.crop) ?? "",
      product: params.get(PARAMS.product) ?? "",
    });
  }, []);

  /**
   * Mirror the current filters into the URL.
   *
   * replaceState, not router.replace: no navigation, no refetch, and the page
   * keeps its static cache. Kept out of the setState updater — updaters must
   * stay pure, and React warns if one touches anything else.
   */
  const syncUrl = useCallback((next: Record<FilterKey, string>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }, []);

  const setFilter = useCallback(
    (key: FilterKey, value: string) => {
      setFilters((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const clearAll = useCallback(() => {
    setFilters({ district: "", crop: "", product: "" });
  }, []);

  // One place writes the URL: whatever the filters end up as, after render.
  useEffect(() => {
    syncUrl(filters);
  }, [filters, syncUrl]);

  /** Options come from the data itself — never a hardcoded list. */
  const options = useMemo(() => {
    const districts = new Map<string, Bi>();
    const crops = new Map<string, Bi>();
    const products = new Map<string, Bi>();

    for (const item of testimonials) {
      if (item.district) {
        districts.set(item.district, { en: item.district, gu: item.district });
      }
      if (item.crop.en) crops.set(item.crop.en, item.crop);
      if (item.productSlug && item.productName) {
        products.set(item.productSlug, item.productName);
      }
    }

    const toSorted = (map: Map<string, Bi>): FilterOption[] =>
      [...map.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) =>
          resolveText(a.label, lang).localeCompare(resolveText(b.label, lang)),
        );

    return {
      district: toSorted(districts),
      crop: toSorted(crops),
      product: toSorted(products),
    };
  }, [testimonials, lang]);

  const visible = useMemo(
    () =>
      testimonials.filter(
        (item) =>
          (!filters.district || item.district === filters.district) &&
          (!filters.crop || item.crop.en === filters.crop) &&
          (!filters.product || item.productSlug === filters.product),
      ),
    [testimonials, filters],
  );

  /**
   * Local proof: with no district chosen, the grid is grouped by district so
   * a visitor sees their own area named. Choosing one collapses it to a
   * single personalised heading.
   */
  const groups = useMemo(() => {
    if (filters.district) {
      return [{ district: filters.district, items: visible }];
    }
    const byDistrict = new Map<string, BrowserTestimonial[]>();
    for (const item of visible) {
      const key = item.district || "";
      const bucket = byDistrict.get(key);
      if (bucket) bucket.push(item);
      else byDistrict.set(key, [item]);
    }
    return [...byDistrict.entries()]
      .map(([district, items]) => ({ district, items }))
      // Districts with more stories first; the unplaced bucket goes last.
      .sort((a, b) => {
        if (!a.district) return 1;
        if (!b.district) return -1;
        return b.items.length - a.items.length;
      });
  }, [visible, filters.district]);

  const active = Object.values(filters).some(Boolean);
  const allLabel = t(TESTIMONIALS_PAGE.filterAll);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-cornsilk-dark bg-cornsilk p-4">
        <Select
          label={TESTIMONIALS_PAGE.filterDistrict}
          value={filters.district}
          options={options.district}
          allLabel={allLabel}
          onChange={(v) => setFilter("district", v)}
        />
        <Select
          label={TESTIMONIALS_PAGE.filterCrop}
          value={filters.crop}
          options={options.crop}
          allLabel={allLabel}
          onChange={(v) => setFilter("crop", v)}
        />
        <Select
          label={TESTIMONIALS_PAGE.filterProduct}
          value={filters.product}
          options={options.product}
          allLabel={allLabel}
          onChange={(v) => setFilter("product", v)}
        />

        <div className="ml-auto flex items-center gap-3 pb-1">
          <span className="text-sm font-medium text-olive-dark">
            {visible.length}{" "}
            {t(
              visible.length === 1
                ? TESTIMONIALS_PAGE.countOne
                : TESTIMONIALS_PAGE.countMany,
            )}
          </span>
          {active && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-full border border-camel px-4 py-1.5 text-sm font-semibold text-russet transition-colors hover:border-olive hover:bg-meringue"
            >
              {t(TESTIMONIALS_PAGE.clearFilters)}
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-camel bg-meringue-light/50 px-6 py-14 text-center">
          <p className="font-display text-xl font-bold text-russet">
            {t(TESTIMONIALS_PAGE.noMatches)}
          </p>
          <p className="mt-2 text-sm text-olive-dark">
            {t(TESTIMONIALS_PAGE.noMatchesHint)}
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-5 rounded-full bg-alloy px-5 py-2.5 text-sm font-semibold text-cornsilk-light transition-colors hover:bg-alloy-dark"
          >
            {t(TESTIMONIALS_PAGE.clearFilters)}
          </button>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.district || "_"} className="mt-10">
            {group.district && (
              <h2 className="font-display text-2xl font-bold text-russet">
                {districtHeading(group.district, lang)}
              </h2>
            )}
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item, i) => (
                <Reveal key={item.id} delay={(i % 3) * 130}>
                  <TestimonialCard t={item} />
                </Reveal>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
