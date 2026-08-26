/**
 * Guards the contract between zod and Mongoose.
 *
 * zod validates the request; Mongoose validates the save. If a field is
 * optional in one and required in the other, the admin form accepts it and
 * then the save fails — which is exactly what happened when every optional
 * bilingual field was marked `required: true` in the models. Mongoose's
 * `required` rejects the **empty string**, not just `undefined`, so leaving
 * an optional field blank made the whole product unsaveable.
 *
 * This builds each document the way the admin form submits one with every
 * optional field left blank, and runs Mongoose validation with no database.
 *
 *   npm run check-models
 */
import { Product } from "@/lib/db/models/Product";
import { Testimonial } from "@/lib/db/models/Testimonial";
import { Post } from "@/lib/db/models/Post";

interface Validatable {
  validate: () => Promise<void>;
}

let failures = 0;

/** Mongoose throws on failure; turn that back into the error paths. */
async function validationErrors(doc: Validatable): Promise<string[] | null> {
  try {
    await doc.validate();
    return null;
  } catch (error) {
    const errors = (error as { errors?: Record<string, unknown> }).errors ?? {};
    return Object.keys(errors);
  }
}

/** A document with only its required fields filled in must validate. */
async function expectValid(label: string, doc: Validatable) {
  const paths = await validationErrors(doc);
  if (!paths) {
    console.log(`  ✓ ${label}`);
    return;
  }
  failures++;
  console.log(`  ✗ ${label}`);
  console.log(`      optional fields rejected when blank: ${paths.join(", ")}`);
}

/** …and a document missing a required field must still be rejected. */
async function expectInvalid(label: string, doc: Validatable, path: string) {
  const paths = await validationErrors(doc);
  if (paths?.includes(path)) {
    console.log(`  ✓ ${label}`);
    return;
  }
  failures++;
  console.log(`  ✗ ${label} — "${path}" was accepted but should be required`);
}

const blankBi = { en: "", gu: "" };

async function main() {
  console.log("Optional fields must save when left blank:");

  await expectValid(
    "Product",
    new Product({
      name: { en: "FloraMax", gu: "" },
      slug: "floramax",
      categoryLabel: { en: "Biostimulant", gu: "" },
      tagline: { en: "More flowers, firmer fruit.", gu: "" },
      description: { en: "A biostimulant for flowering.", gu: "" },
      format: blankBi,
      complianceNote: blankBi,
      cropsNote: blankBi,
      availabilityNote: blankBi,
      dosage: {
        applicationMethod: blankBi,
        cropStage: blankBi,
        summary: blankBi,
      },
      images: [
        { url: "https://example.invalid/a.jpg", alt: blankBi, isPrimary: true },
        { url: "https://example.invalid/b.jpg", alt: blankBi },
      ],
    }) as unknown as Validatable,
  );

  await expectValid(
    "Testimonial",
    new Testimonial({
      farmerName: { en: "Rameshbhai Patel", gu: "" },
      crop: blankBi,
      quote: blankBi,
    }) as unknown as Validatable,
  );

  await expectValid(
    "Post",
    new Post({
      title: { en: "Soil health", gu: "" },
      slug: "soil-health",
      excerpt: blankBi,
      content: blankBi,
      coverImage: { url: "", publicId: "", alt: blankBi },
      metaTitle: blankBi,
      metaDescription: blankBi,
    }) as unknown as Validatable,
  );

  console.log("\nRequired fields must still be enforced:");

  await expectInvalid(
    "Product without a name",
    new Product({ slug: "x" }) as unknown as Validatable,
    "name",
  );
  await expectInvalid(
    "Testimonial without a farmer name",
    new Testimonial({}) as unknown as Validatable,
    "farmerName",
  );

  if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll model checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
