import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission, errorResponse } from "@/lib/admin/api";
import {
  CLOUDINARY_FOLDERS,
  getCloudinary,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  folder: z.enum(["products", "testimonials", "blog"]),
  /** "raw" for PDFs and other documents; Cloudinary uses a separate endpoint. */
  resourceType: z.enum(["image", "raw"]).default("image"),
});

/**
 * Returns a short-lived signature so the browser can upload a file DIRECTLY
 * to Cloudinary. The file never passes through this server (keeps us well
 * inside Vercel's free-tier limits) and the API secret never leaves it.
 */
export async function POST(request: NextRequest) {
  const unauthorized = await requirePermission("media:upload");
  if (unauthorized) return unauthorized;

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      {
        error:
          "Image uploads are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
      },
      { status: 503 },
    );
  }

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Unknown upload folder" }, { status: 400 });
    }

    const cld = getCloudinary();
    const timestamp = Math.round(Date.now() / 1000);
    const folder = CLOUDINARY_FOLDERS[parsed.data.folder];
    const resourceType = parsed.data.resourceType;

    // Everything signed here must be sent by the browser, unchanged.
    // resource_type is part of the URL, not the signed payload.
    const paramsToSign = { timestamp, folder };
    const signature = cld.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET as string,
    );

    return NextResponse.json({
      signature,
      timestamp,
      folder,
      resourceType,
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
