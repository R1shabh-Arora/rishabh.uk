# Rishabh // Signal Feed

Cyberpunk-styled static dashboard for the daily cyber + AI briefing.

## What it is
- Static front-end: `signal/index.html`
- Render logic: `signal/render.mjs`
- Styling: `signal/styles.css`
- Live data file: `signal/data/latest.json`
- Seed/fallback data: `signal/data/sample.json`
- Source config: `signal/config.json`

## Daily refresh model
The refresh script should overwrite:
- `signal/data/latest.json`
- `signal/data/archive/YYYY-MM-DD.json`

The front-end reads `latest.json` and falls back to `sample.json` if needed.

## Hosting
This is deliberately static so it can live almost anywhere:
- existing website repo
- nginx/apache static folder
- Vercel / Netlify / Cloudflare Pages
- any CDN/object storage bucket

To host it on an existing site, mount the `dashboard/` folder at something like:
- `/briefing/`
- `/signal/`
- or as the site root

## Notes
- Current YouTube mode is best-effort unless transcript access is available.
- The UI is designed to look good without build tooling or framework dependencies.
- If you later want search, filters, sparkline charts, auth, or archives by date, those can be layered on without redesigning the whole thing.
