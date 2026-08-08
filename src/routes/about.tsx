import { createFileRoute } from "@tanstack/react-router";
import { Flex, Heading, Link, Text } from "@saintly-software/baritone";

const PERSONAL_SITE = "https://dakota-stlaurent.com/";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [{ title: "About" }],
  }),
  component: About,
});

function About() {
  return (
    <Flex direction="column" gap="4" style={{ maxWidth: "40rem" }}>
      <Heading level={1}>About</Heading>

      <Text>
        This is a digital garden of my notes. For more about me and my other work, visit{" "}
        <Link href={PERSONAL_SITE} target="_blank" rel="noreferrer">
          dakota-stlaurent.com
        </Link>
        .
      </Text>
    </Flex>
  );
}
