import { HeadContent, Link as RouterLink, Scripts, createRootRoute } from "@tanstack/react-router";
import {
  BaritoneTheme,
  Flex,
  LinkProvider,
  type LinkRenderProps,
} from "@saintly-software/baritone";

import { NavBar } from "../components/NavBar";
import { Sidebar } from "../components/Sidebar";
import { buildAppTokens } from "../lib/theme";
import resetCss from "../styles/reset.css?url";
import sidebarCss from "../styles/sidebar.css?url";
import baritoneCss from "../styles/styles.css?url";

const APP_NAME = "Dak's Notes";

// Only the *relative* parts of the parsed href are used, so the origin is
// arbitrary — it exists just to give `new URL` a base to resolve against. Only
// internal hrefs reach the adapter below (the provider leaves external ones as
// plain `<a>`s), so this origin never survives into a destination.
const HREF_BASE = "http://href.invalid";

/**
 * The app's single router adapter for Baritone's `Link` (see `LinkProvider`
 * below): every internal design-system link renders through here.
 *
 * TanStack treats `to` as a *pathname* end to end — it interpolates route params
 * into it and builds the query/fragment only from its separate `search`/`hash`
 * options (see `buildLocation` in `@tanstack/router-core`). So an href carrying a
 * fragment, like the `/references#caplin-1998` citations the note renderer emits
 * (`#/lib/notes/render`), would otherwise become a pathname with a literal `#` in
 * it. Parse the href and hand each part to the prop that owns it.
 */
function routerLink({ href, ...props }: LinkRenderProps) {
  const url = new URL(href, HREF_BASE);
  const hash = url.hash === "" ? undefined : url.hash.slice(1);
  // Repeated keys collapse to the last value — fine for this app, which has no
  // list-valued search params. `undefined` leaves the current location's search
  // in place, which is TanStack's default for a `to` without a `search`.
  const search = url.search === "" ? undefined : Object.fromEntries(url.searchParams);
  // A same-document href (`#hash`, `?query`) names no path of its own, so it has
  // to stay on the current one: `to: ""` does that, whereas `url.pathname` would
  // be the base's `/` and navigate away.
  const to = href.startsWith("#") || href.startsWith("?") ? "" : url.pathname;

  return <RouterLink to={to} search={search} hash={hash} {...props} />;
}

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
      { rel: "stylesheet", href: sidebarCss },
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
        <LinkProvider render={routerLink}>
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
