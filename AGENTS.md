# Repository instructions

## Repository context

- This repository is a personal Notion/Astro blog based on `otoyo/astro-notion-blog`.

## Development requirements

- Use Node.js `20.18.1` or newer, matching the current requirement in `README.ja.md`.
- Respect the lockfile when installing dependencies; use `npm ci` for normal clean installs.
- The basic checks are `npm run lint` and, when required by the task, `npm run build`.
- `build` and `dev` may require `DATABASE_ID` and `NOTION_API_SECRET`; `PROFILE_PAGE_ID` is optional.

## Change and safety boundaries

- Prefer the existing architecture and upstream implementation. Make local, focused changes; do not add parallel implementations or unnecessary broad refactors.
- Never commit or expose secrets in commits, Issues, pull requests, or logs.
- Do not change Cloudflare Pages settings, run deploy hooks, change Notion-side data or settings, or perform other external writes without explicit approval.
- Preserve existing code, dependency, Cloudflare, Notion, and workflow behavior unless the current Issue explicitly authorizes a change.

## Evidence and approval

- Follow the order `Issue -> implementation -> verification -> pull request -> review`, leaving evidence in GitHub.
- Do not merge until the user explicitly instructs it.
- Treat any build or external verification that could not be run as unverified, and report the reason and remaining unknowns; never report it as successful.
