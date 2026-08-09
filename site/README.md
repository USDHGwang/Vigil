# site

The Vigil landing page and docs, at [vigilapp.vercel.app](https://vigilapp.vercel.app).

This is a static Next.js export with no backend. It explains what Vigil does and
hands people the install steps; it is not part of the trust path. The MCP server,
the evidence panel and the signing page all live in [`../app`](../app) — nothing
in here ever touches a transaction.

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build    # static export into out/
```

## Routes

| Route | What it is |
|---|---|
| `/` | The six-act walkthrough of what happens between a request and a signature |
| `/add` | Install steps, with one-click links for hosts that support them |
| `/docs`, `/docs/features` | Longer explanation of the trust model and the rules |

## Two things to know before editing

**Copy lives in `src/i18n.tsx`, not in the components.** Five locales share one
dictionary, and the language follows the visitor's choice. Adding a string means
adding it to every locale.

**`PAGES_BASE_PATH` changes the base path at build time.** Vercel serves this at
a domain root and needs it unset. GitHub Pages serves it under `/Vigil/`, so
[`.github/workflows/pages.yml`](../.github/workflows/pages.yml) sets it there.
Unset it in the wrong place and every asset 404s.
