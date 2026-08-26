/**
 * Browser-side Cloudinary upload.
 *
 * The file goes straight from the browser to Cloudinary using a signature
 * minted by /api/admin/sign-upload — it never passes through our server, and
 * the API secret never reaches the client. Only the returned url, public_id
 * and byte size are kept in MongoDB.
 *
 * Client-safe: no server-only imports, so every admin uploader shares this.
 */

export type UploadFolder = "products" | "testimonials" | "blog";

/** Cloudinary stores PDFs and other documents as "raw", images as "image". */
export type UploadResourceType = "image" | "raw";

export interface UploadResult {
  url: string;
  publicId: string;
  bytes: number;
  resourceType: UploadResourceType;
}

export async function uploadToCloudinary(
  file: File,
  folder: UploadFolder,
  resourceType: UploadResourceType = "image",
): Promise<UploadResult> {
  const signResponse = await fetch("/api/admin/sign-upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ folder, resourceType }),
  });
  const signed = await signResponse.json();
  if (!signResponse.ok) {
    throw new Error(signed.error ?? "Could not start the upload");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("folder", signed.folder);

  const uploadResponse = await fetch(signed.uploadUrl, {
    method: "POST",
    body: form,
  });
  const result = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(result?.error?.message ?? "Cloudinary rejected the upload");
  }

  return {
    url: result.secure_url as string,
    publicId: result.public_id as string,
    bytes: Number(result.bytes ?? 0),
    resourceType,
  };
}
