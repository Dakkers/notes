import { createFileRoute } from "@tanstack/react-router";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { ComponentProps, CSSProperties } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Flex, Heading, Link, Text, vars } from "@saintly-software/baritone";

import { SOURCES } from "../lib/references.gen";
import referencesCss from "../styles/references.css?url";

export const Route = createFileRoute("/references")({
  head: () => ({
    meta: [{ title: "References" }],
    links: [{ rel: "stylesheet", href: referencesCss }],
  }),
  component: References,
});

const referenceTokens = {
  "--ref-rule": vars.surface.color.neutral.low.default.border,
  "--ref-muted": vars.text.color.neutral.low,
} as CSSProperties;

function ExternalLink({ href, children }: ComponentProps<"a">) {
  return (
    <Link render={<a />} href={href} target="_blank" rel="noreferrer">
      {children}
    </Link>
  );
}

function References() {
  return (
    <Flex direction="column" gap="4" style={{ maxWidth: "48rem" }}>
      <Flex direction="column" gap="1">
        <Heading level={1}>References</Heading>
        <Text as="span" size="sm" saliency="low">
          Sources cited throughout these notes. The short form is how a note links to each one, as
          in <code>[[caplin-1998]]</code>.
        </Text>
      </Flex>

      {/* Two columns: the `[[short-form]]` a note cites by, then the
          citation as written in the vault's `Sources` note. Each row carries its
          short form as an `id`, so `/references#caplin-1998` scrolls to it. */}
      <table className="references-table" style={referenceTokens}>
        <thead>
          <tr>
            <Text render={<th scope="col" />} size="sm" saliency="low">
              Short form
            </Text>
            <Text render={<th scope="col" />} size="sm" saliency="low">
              Reference
            </Text>
          </tr>
        </thead>
        <tbody>
          {SOURCES.map((source) => (
            <tr key={source.shortForm} id={source.shortForm}>
              <td>
                <Text render={<code />} size="sm">
                  {source.shortForm}
                </Text>
              </td>
              <Text render={<td />}>
                {toJsxRuntime(source.citation, {
                  Fragment,
                  jsx,
                  jsxs,
                  components: { a: ExternalLink },
                })}
              </Text>
            </tr>
          ))}
        </tbody>
      </table>
    </Flex>
  );
}
