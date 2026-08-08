import { Button, Icon, Link } from "@saintly-software/baritone";
import { Link as RouterLink } from "@tanstack/react-router";
import type { Root } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Maximize, X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

// Internal note links are the `/notes/<slug>` anchors the build-time renderer
// emits for resolved `[[wikilinks]]` (see `#/lib/notes/render`). Routing them
// through TanStack `<Link>` gives SPA navigation + intent preloading; anything
// else (external URLs, unresolved links — which aren't anchors at all) is a
// Baritone `<Link>` rendering a plain `<a>`.
const INTERNAL_HREF = /^\/notes\/(.+)$/;

function Anchor({ href, children, ...rest }: ComponentProps<"a">) {
  const slug = typeof href === "string" ? INTERNAL_HREF.exec(href)?.[1] : undefined;
  if (slug !== undefined) {
    return (
      <RouterLink
        to="/notes/$slug"
        params={{ slug: decodeURIComponent(slug) }}
        className={rest.className}
      >
        {children}
      </RouterLink>
    );
  }
  // `render={<a />}` opts this link out of the root `LinkProvider`: everything
  // reaching here is either external or a same-page/section anchor (a footnote
  // ref, a `/references#short-form` citation), none of which the router should
  // take over.
  return (
    <Link render={<a />} href={href} {...rest}>
      {children}
    </Link>
  );
}

// The two glyphs, as `<Icon>`-ready Lucide icons (sized in `em`, coloured by
// `currentColor` so they inherit the surrounding Baritone `Button`'s text colour).
const ExpandGlyph = (
  <Icon label="Expand">
    <Maximize size="1em" />
  </Icon>
);
const CloseGlyph = (
  <Icon label="Close">
    <X size="1em" />
  </Icon>
);

/**
 * A rendered note image, with a button to open it in a full-size lightbox. The
 * inline `<img>` is capped to the prose column (see `.prose img`); the lightbox
 * shows it at its natural dimensions, scrolling if it overflows the viewport.
 *
 * The two controls are Baritone `Button`s (so they carry the design system's
 * chrome, focus ring, and theming). The lightbox surface itself stays custom
 * rather than a Baritone `Modal`, because `Modal` caps its width at `sm`/`md`/`lg`
 * — this viewer deliberately shows the image at its intrinsic size, larger than
 * any of those.
 */
function Image({ src, alt, ...rest }: ComponentProps<"img">) {
  const [open, setOpen] = useState(false);

  // Close on Escape, and lock body scroll while the lightbox is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <span className="prose-image">
      <img src={src} alt={alt} {...rest} />
      <Button
        className="prose-image-expand"
        size="sm"
        saliency="low"
        aria-label="View image at full size"
        icon={ExpandGlyph}
        onClick={() => setOpen(true)}
      />
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={alt || "Image"}
            onClick={() => setOpen(false)}
          >
            <Button
              className="lightbox-close"
              size="sm"
              aria-label="Close"
              icon={CloseGlyph}
              onClick={() => setOpen(false)}
            />
            {/* Stop the backdrop's close handler when the image itself is clicked. */}
            <img
              className="lightbox-image"
              src={src}
              alt={alt}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </span>
  );
}

/**
 * Render a note hast tree (body or footnotes) to React, mapping internal
 * `/notes/<slug>` links to router links and images to a lightbox-capable
 * {@link Image}. Shared by {@link NoteBody} and the footnotes section of
 * `#/components/NoteInfoPanel`.
 */
export function renderNoteHast(tree: Root): ReactNode {
  return toJsxRuntime(tree, { Fragment, jsx, jsxs, components: { a: Anchor, img: Image } });
}

/** Render a note's body hast tree to React inside the prose typography scope. */
export function NoteBody({ tree }: { tree: Root }) {
  return <div className="prose">{renderNoteHast(tree)}</div>;
}
