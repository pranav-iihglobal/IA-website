import { v2 as cloudinary } from "cloudinary";

/**
 * Server-only Cloudinary configuration.
 *
 * The API secret must never reach the browser: uploads are signed here and
 * the browser POSTs the file straight to Cloudinary with that signature.
 * Only the resulting secure_url and public_id are stored in MongoDB.
 */

export const CLOUDINARY_FOLDERS = {
  products: "products",
  testimonials: "testimonials",
  blog: "blog",
} as const;

export type CloudinaryFolder =
  (typeof CLOUDINARY_FOLDERS)[keyof typeof CLOUDINARY_FOLDERS];

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export function getCloudinary() {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
    );
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

/**
 * Delete assets by public_id, ignoring failures.
 * A missing image must never block deleting the record that referenced it.
 */
export async function deleteAssets(publicIds: string[]): Promise<void> {
  const ids = publicIds.filter(Boolean);
  if (ids.length === 0 || !isCloudinaryConfigured()) return;
  const cld = getCloudinary();
  await Promise.all(
    ids.map((id) =>
      cld.uploader
        .destroy(id, { invalidate: true })
        .catch((error) =>
          console.error(`[cloudinary] could not delete ${id}:`, error),
        ),
    ),
  );
}
