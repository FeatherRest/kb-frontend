# Standalone Knowledge Base UI

This repository contains the lightweight Vue frontend served at `/kb/`.
Hermes Dashboard links to this application; it no longer owns the primary
knowledge-base screen.

## Local development

```powershell
npm ci
npm run dev
```

The API defaults to the same-origin `/kb/api` path. Set `VITE_KB_API` only
when the KB service is intentionally hosted elsewhere.

## Container deployment

The image serves the built assets below `/kb/` and sends `/kb/api/*` through
Nginx to the KB service. The default Docker Desktop upstream is
`http://host.docker.internal:9999`; override `KB_API_UPSTREAM` when the KB
service is another container or host.

```powershell
docker build -t kb-frontend .
docker run --rm -p 8081:80 `
  -e KB_API_UPSTREAM=http://host.docker.internal:9999 `
  kb-frontend
```

The current UI keeps search, ingestion, document administration, health
status, and search highlighting. The old Hermes React page remains available
at `/knowledge/legacy` while the remaining knowledge-base workflows are
migrated.
