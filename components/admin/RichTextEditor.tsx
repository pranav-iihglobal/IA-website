"use client";

import { safeLinkHref } from "@/lib/admin/link-url";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import { useRef, useState } from "react";
import { uploadToCloudinary } from "@/lib/admin/upload";
import { useToast } from "./Toast";

/**
 * Tiptap rich-text editor for blog content.
 *
 * Stores sanitized HTML (the API sanitizes again server-side) so the public
 * article page can keep rendering HTML exactly as it does today.
 */

function ToolbarButton({
  active,
  onClick,
  children,
  title,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-2 text-sm font-semibold transition-colors disabled:opacity-35 ${
        active
          ? "bg-olive text-cornsilk-light"
          : "text-ink hover:bg-surface-subtle hover:text-ink-strong"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-surface-strong/70" />;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      ImageExt.configure({ inline: false }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose-article min-h-[300px] rounded-b-xl border border-t-0 border-line-soft/70 bg-raised px-4 py-3 outline-none focus:border-olive",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) {
    return <div className="admin-skeleton min-h-[340px] rounded-xl" />;
  }

  async function insertImage(file: File) {
    setUploading(true);
    try {
      const uploaded = await uploadToCloudinary(file, "blog");
      // f_auto,q_auto so inline images are delivered optimized too.
      const url = uploaded.url.replace(
        "/upload/",
        "/upload/f_auto,q_auto,w_1200/",
      );
      editor?.chain().focus().setImage({ src: url }).run();
      toast("Image inserted");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not upload image",
        "error",
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function setLink() {
    const previous = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    /*
      Checked, not trusted. Whatever came back went straight into an href,
      and `javascript:alert(1)` was a valid answer — on content that is
      PUBLISHED to every visitor. See lib/admin/link-url.ts.
    */
    const href = safeLinkHref(url);
    if (!href) {
      toast("That link cannot be used — try an https:// address.", "error");
      return;
    }

    editor
      ?.chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href, target: "_blank" })
      .run();
  }

  function embedYouTube() {
    const url = window.prompt("YouTube URL");
    if (!url) return;
    const match = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/,
    );
    if (!match) {
      toast("That does not look like a YouTube link.", "error");
      return;
    }
    editor
      ?.chain()
      .focus()
      .insertContent(
        `<iframe src="https://www.youtube-nocookie.com/embed/${match[1]}" loading="lazy" allowfullscreen width="560" height="315"></iframe>`,
      )
      .run();
    toast("Video embedded");
  }

  const words = editor.getText().trim().split(/\s+/).filter(Boolean).length;

  return (
    <div>
      {/* Sticky so the toolbar stays reachable in a long article. */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border border-line-soft/70 bg-surface-muted/95 px-2 py-1.5 backdrop-blur">
        <ToolbarButton
          title="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 4 3 8l4 4M3 8h8a5 5 0 0 1 0 10H8" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          title="Redo"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="m13 4 4 4-4 4m4-4H9a5 5 0 0 0 0 10h3" />
          </svg>
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em className="font-serif">I</em>
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
            <path d="M4 5.5a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Zm0 4.5a1.2 1.2 0 1 1-2.4 0A1.2 1.2 0 0 1 4 10Zm0 4.5a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0ZM7 4.75h11v1.5H7v-1.5Zm0 4.5h11v1.5H7v-1.5Zm0 4.5h11v1.5H7v-1.5Z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
            <path d="M7 4.75h11v1.5H7v-1.5Zm0 4.5h11v1.5H7v-1.5Zm0 4.5h11v1.5H7v-1.5ZM2.2 3.5h1.4v3.2h-1V4.4h-.4V3.5Zm-.5 5.1h2.4v.8L2.9 11h1.3v.8H1.6V11l1.2-1.6H1.7v-.8Zm0 4.6h2.3v.7l-.8.6.9.7v.8H1.7v-.8h1.2l-.9-.6.9-.6H1.7v-.8Z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          title="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <span className="text-base leading-none">&ldquo;</span>
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Link" active={editor.isActive("link")} onClick={setLink}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
            <path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2-2a3.54 3.54 0 0 0-5-5l-1 1a1 1 0 1 0 1.4 1.4l1-1a1.54 1.54 0 0 1 2.2 2.2l-2 2a1.5 1.5 0 0 1-2.2 0 1 1 0 0 0-1.4 1.4Z" />
            <path d="M11.5 8.5a3.5 3.5 0 0 0-5 0l-2 2a3.54 3.54 0 0 0 5 5l1-1a1 1 0 0 0-1.4-1.4l-1 1a1.54 1.54 0 0 1-2.2-2.2l2-2a1.5 1.5 0 0 1 2.2 0 1 1 0 0 0 1.4-1.4Z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          title="Insert image"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <svg viewBox="0 0 20 20" className="h-4 w-4 animate-spin" fill="none">
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
              <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm2 0h10v6.2l-2.2-2.2a1 1 0 0 0-1.4 0L8 12.4 6.6 11a1 1 0 0 0-1.4 0L5 11.2V5Zm2.5 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </ToolbarButton>
        <ToolbarButton title="Embed YouTube video" onClick={embedYouTube}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
            <path d="M3 6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm11.5 2.3 2.6-1.7a.6.6 0 0 1 .9.5v5.8a.6.6 0 0 1-.9.5l-2.6-1.7V8.3Z" />
          </svg>
        </ToolbarButton>

        <span className="ml-auto pr-1 text-[11px] font-medium text-ink-soft">
          {words} word{words === 1 ? "" : "s"}
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) insertImage(file);
        }}
      />

      <EditorContent editor={editor} />
      {placeholder && editor.isEmpty && (
        <p className="mt-1 text-xs text-ink-soft">{placeholder}</p>
      )}
    </div>
  );
}
