# Playwright Scraping Workbench - PRD

## Original Problem Statement
A developer-grade, on-demand data extraction tool powered by Playwright with proxy rotation, anti-bot handling, parameterized templates, and a lightweight web viewer for logs and results.

## User Personas
- **Developers** needing automated web scraping for data collection
- **Data analysts** extracting structured data from websites
- **QA engineers** testing web scraping logic

## Core Requirements
- Job-based scraping with URL + CSS selector configuration
- Proxy rotation (sequential strategy, ip:port:user:password format)
- Anti-bot handling via playwright-stealth
- Captcha solver integration (2Captcha, NopeCHA)
- Pagination support
- Plain text output (.txt files)
- Web viewer for jobs, logs, templates, settings

## What's Been Implemented (April 1, 2026)

### Backend (FastAPI + MongoDB)
- ✅ Job CRUD API endpoints (/api/jobs)
- ✅ Template CRUD API endpoints (/api/templates)
- ✅ Settings API for proxy list and captcha keys (/api/settings)
- ✅ Stats endpoint (/api/stats)
- ✅ Playwright scraper engine with:
  - playwright-stealth integration
  - Proxy rotation (sequential)
  - Human-like behavior (mouse movements, delays)
  - Cloudflare detection
  - Parallel URL processing (max 3 concurrent)
  - Pagination support
- ✅ 2Captcha and NopeCHA integration (API ready)

### Frontend (React + Tailwind + Shadcn UI)
- ✅ Dashboard with stats and job history table
- ✅ Job detail view with output preview and logs (terminal-style)
- ✅ New Job form with all options (URLs, selectors, pagination, proxy, captcha)
- ✅ Templates page with CRUD operations
- ✅ Settings page for proxy list and captcha API keys
- ✅ Responsive design with IBM Plex Sans / JetBrains Mono fonts

## Architecture
```
Frontend (React :3000) → Backend (FastAPI :8001) → MongoDB
                                    ↓
                           Playwright Scraper → Output Files (/app/data/outputs)
                                    ↓
                           Logs (/app/data/logs)
```

## P0 Features (Complete)
- [x] Core scraping engine
- [x] Job management
- [x] Template system
- [x] Web viewer
- [x] Proxy rotation
- [x] Stealth mode

## P1 Features (Remaining)
- [ ] Job scheduling (cron-like)
- [ ] Data export (CSV/JSON)
- [ ] Bulk job import
- [ ] Webhook notifications

## P2 Features (Backlog)
- [ ] Browser extension for selector picking
- [ ] Rate limiting configuration
- [ ] Custom JavaScript injection
- [ ] Proxy health check

## Next Action Items
1. Add proxy list and captcha API keys via Settings page
2. Test with Cloudflare-protected sites
3. Create templates for common scraping patterns
