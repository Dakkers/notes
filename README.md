# obsidian-site-v3

A bare, frontend-only [TanStack Start](https://tanstack.com/start) app. It renders
nothing yet — it's a starting point.

## Stack

- **TanStack Start** + **TanStack Router** (file-based routing)
- **React 19** + **TypeScript** (strict)
- **Vite 8**
- **[Baritone](https://www.npmjs.com/package/@saintly-software/baritone)** design system
- **oxlint** / **oxfmt** for linting and formatting
- **Vitest** for tests
- **pnpm**

Configs live in [`.config/`](.config/). The `#/*` import alias maps to `./src/*`.

## Design system

[Baritone](https://www.npmjs.com/package/@saintly-software/baritone) is wired up
at the document root ([`src/routes/__root.tsx`](src/routes/__root.tsx)):

- Its compiled stylesheet is pulled in once via [`src/styles/styles.css`](src/styles/styles.css).
- `BaritoneTheme` applies the theme tokens (built in [`src/lib/theme.ts`](src/lib/theme.ts))
  straight onto `<body>`. Reseed the brand there via `buildDefaultTokens`.
- `LinkProvider` routes every internal Baritone `<Link>` through TanStack Router.

Import components from the package, e.g. `import { Button, Text } from "@saintly-software/baritone"`.
`@vanilla-extract/css` is a runtime peer Baritone needs — it's installed for you.

## Getting started

```bash
pnpm install
pnpm dev
```

The dev server runs at http://localhost:3000.

## Scripts

| Script                     | What it does                                  |
| -------------------------- | --------------------------------------------- |
| `pnpm dev`                 | Start the dev server on port 3000             |
| `pnpm build`               | Production build (client + SSR)               |
| `pnpm preview`             | Build, then serve the production build        |
| `pnpm generate-routes`     | Regenerate `src/routeTree.gen.ts` from routes |
| `pnpm typecheck`           | `tsc --noEmit`                                |
| `pnpm test`                | Run tests once                                |
| `pnpm lint` / `lint:check` | Lint (with/without autofix)                   |
| `pnpm fmt` / `fmt:check`   | Format (write/check)                          |

## Adding a route

Drop a file in [`src/routes/`](src/routes/); the route tree is generated from it
(run `pnpm generate-routes`, or let the dev server regenerate on save).
