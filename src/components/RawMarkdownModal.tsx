import { useState } from "react";
import { Button, Icon, Modal, vars } from "@saintly-software/baritone";
import { X } from "lucide-react";

// A recessed surface for the source block, one shade off the modal panel's own
// (low-saliency) surface — so it reads as inset and tracks the Baritone theme in
// both light and dark, unlike a hardcoded colour would.
const codeSurface = vars.surface.color.neutral.high.default;

// Lucide's "X", sized in `em` and drawn in `currentColor` so it inherits the
// icon-only button's font size and text colour (mirrors the glyphs in `NoteBody`).
const CloseGlyph = (
  <Icon label="Close">
    <X size="1em" />
  </Icon>
);

/**
 * A side-panel control that opens the note's verbatim `.md` source in a modal.
 * The source (`raw`) is the exact text the build-time renderer consumed; it ships
 * only on note pages via `virtual:demo-notes/content`.
 *
 * Baritone's `Modal` handles the backdrop, focus trap, Escape, and ARIA wiring;
 * the body is a scrolling `<pre>` styled by `.raw-markdown` in prose.css. The
 * header carries an icon-only close "✕" on its end (Baritone places header
 * children there); the sole footer button, "Copy", writes the source to the
 * clipboard, flipping its label to confirm.
 */
export function RawMarkdownModal({ source, title }: { source: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (typeof navigator === "undefined" || navigator.clipboard === undefined) return;
    void navigator.clipboard.writeText(source).then(() => {
      setCopied(true);
      // Reset the confirmation so a later copy reads as a fresh action.
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Modal
      size="lg"
      trigger={
        <Modal.Trigger size="sm" saliency="low" intent="neutral">
          View raw markdown
        </Modal.Trigger>
      }
      header={
        <Modal.Header title="Raw markdown" subtitle={title}>
          <Modal.Close size="sm" saliency="low" aria-label="Close" icon={CloseGlyph} />
        </Modal.Header>
      }
      footer={
        <Modal.Footer>
          <Button size="sm" saliency="low" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </Modal.Footer>
      }
    >
      <pre
        className="raw-markdown"
        style={{
          backgroundColor: codeSurface.bgc,
          color: codeSurface.text,
          border: `1px solid ${codeSurface.border}`,
        }}
      >
        <code>{source}</code>
      </pre>
    </Modal>
  );
}
