import { createFileRoute } from "@tanstack/react-router";
import { Flex, Heading, Link, Text } from "@saintly-software/baritone";

import { SOURCES } from "../lib/references";
import referencesCss from "../styles/references.css?url";

export const Route = createFileRoute("/references")({
  head: () => ({
    meta: [{ title: "References" }],
    links: [{ rel: "stylesheet", href: referencesCss }],
  }),
  component: References,
});

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

      {/* Two columns: the `[[short-form]]` a note cites by, then the full
          citation (author, title as a `<cite>`, publication details). Each row
          carries its short form as an `id`, so `/references#caplin-1998` scrolls
          straight to it. Online sources link from the title. */}
      <table className="references-table">
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
                {source.author}.{" "}
                <cite>
                  {source.url !== undefined ? (
                    // External destination, so this stays a plain anchor rather
                    // than going through the root LinkProvider's router link.
                    <Link href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </Link>
                  ) : (
                    source.title
                  )}
                </cite>
                . {source.publication}
                {source.isbn !== undefined && (
                  <Text as="span" size="sm" saliency="low">
                    {" "}
                    ISBN {source.isbn}.
                  </Text>
                )}
              </Text>
            </tr>
          ))}
        </tbody>
      </table>
    </Flex>
  );
}
