"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import { useRef, useState } from "react";

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
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded px-2 py-1 text-sm font-semibold transition-colors ${
        active
          ? "bg-olive text-cornsilk-light"
          : "text-russet-dark hover:bg-meringue"
      }`}
    >
      {children}
    </button>
  );
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
          "prose-article min-h-[280px] rounded-b-lg border border-t-0 border-camel-light bg-white px-4 py-3 outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) {
    return (
      <div className="min-h-[320px] rounded-lg border border-camel-light bg-white p-4 text-sm text-russet-dark/50">
        Loading editor…
      </div>
    );
  }

  async function insertImage(file: File) {
    setUploading(true);
    try {
      const signResponse = await fetch("/api/admin/sign-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folder: "blog" }),
      });
      const signed = await signResponse.json();
      if (!signResponse.ok) throw new Error(signed.error);

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", signed.apiKey);
      form.append("timestamp", String(signed.timestamp));
      form.append("signature", signed.signature);
      form.append("folder", signed.folder);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
        { method: "POST", body: form },
      );
      const result = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error("Upload failed");

      // f_auto,q_auto so inline images are delivered optimized too.
      const url = String(result.secure_url).replace(
        "/upload/",
        "/upload/f_auto,q_auto,w_1200/",
      );
      editor?.chain().focus().setImage({ src: url }).run();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Could not upload image",
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
    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      ?.chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url, target: "_blank" })
      .run();
  }

  function embedYouTube() {
    const url = window.prompt("YouTube URL");
    if (!url) return;
    const match = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/,
    );
    if (!match) {
      window.alert("That does not look like a YouTube link.");
      return;
    }
    editor
      ?.chain()
      .focus()
      .insertContent(
        `<iframe src="https://www.youtube-nocookie.com/embed/${match[1]}" loading="lazy" allowfullscreen width="560" height="315"></iframe>`,
      )
      .run();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-camel-light bg-cornsilk px-2 py-1.5">
        <ToolbarButton
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-camel-light" />
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
        <span className="mx-1 h-5 w-px bg-camel-light" />
        <ToolbarButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </ToolbarButton>
        <ToolbarButton
          title="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          &ldquo;
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-camel-light" />
        <ToolbarButton title="Link" active={editor.isActive("link")} onClick={setLink}>
          Link
        </ToolbarButton>
        <ToolbarButton
          title="Insert image"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Image"}
        </ToolbarButton>
        <ToolbarButton title="Embed YouTube video" onClick={embedYouTube}>
          Video
        </ToolbarButton>
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
        <p className="mt-1 text-xs text-russet-dark/50">{placeholder}</p>
      )}
    </div>
  );
}
