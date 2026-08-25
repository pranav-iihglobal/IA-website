"use client";

import { useState } from "react";

/**
 * Lazy platform video embed for testimonials.
 *
 * Embeds are heavy and can be blocked (private posts, tracking blockers,
 * regional restrictions), so nothing loads until the visitor taps play, and
 * a plain outbound link is always available as a fallback.
 */
export function VideoEmbed({
  platform,
  url,
  embedId,
  label,
}: {
  platform: string;
  url: string;
  embedId: string;
  label: string;
}) {
  const [playing, setPlaying] = useState(false);

  const src =
    platform === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${embedId}?autoplay=1`
      : platform === "instagram"
        ? `https://www.instagram.com/p/${embedId}/embed`
        : platform === "facebook"
          ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=560`
          : null;

  const platformName =
    platform === "youtube"
      ? "YouTube"
      : platform === "instagram"
        ? "Instagram"
        : "Facebook";

  if (!src) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-cornsilk-dark bg-meringue-light">
      {playing ? (
        <iframe
          src={src}
          title={label}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="flex aspect-video w-full flex-col items-center justify-center gap-3 transition-colors hover:bg-meringue"
          aria-label={`Play ${platformName} video`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-alloy text-cornsilk-light shadow-md">
            <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-0.5" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="text-sm font-semibold text-russet">
            Watch on {platformName}
          </span>
        </button>
      )}
      <p className="border-t border-cornsilk-dark px-4 py-2 text-xs">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-alloy-dark hover:underline"
        >
          Open on {platformName} →
        </a>
      </p>
    </div>
  );
}
