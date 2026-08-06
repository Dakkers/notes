import { HeadContent, Link as RouterLink, Scripts, createRootRoute } from "@tanstack/react-router";
import { BaritoneTheme, Flex, LinkProvider } from "@saintly-software/baritone";

import { NavBar } from "../components/NavBar";
import { Sidebar } from "../components/Sidebar";
import { buildAppTokens } from "../lib/theme";
import resetCss from "../styles/reset.css?url";
import baritoneCss from "../styles/styles.css?url";

const APP_NAME = "obsidian-site";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
    ],
    links: [
      { rel: "stylesheet", href: resetCss },
      { rel: "stylesheet", href: baritoneCss },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const tokens = buildAppTokens();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>

      <BaritoneTheme tokens={tokens} scheme="light" render={<body />}>
        <LinkProvider render={({ href, ...props }) => <RouterLink to={href} {...props} />}>
          <Flex direction="column" style={{ minHeight: "100vh" }}>
            <NavBar />

            <Flex grow align="stretch">
              <Sidebar />

              <Flex render={<main />} grow direction="column" p="6">
                {children}
              </Flex>
            </Flex>
          </Flex>
        </LinkProvider>

        <Scripts />
      </BaritoneTheme>
    </html>
  );
}
