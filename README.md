# Teams and Dreams — Sports Event Scraper & Map Platform

A large-scale sports data ingestion pipeline and interactive map-based web application for discovering sporting events worldwide.

## Project Structure

```
scraper/          — Python scraping pipeline
  core/           — Base classes, proxy management, config
  extractors/     — Site-specific and generic extraction logic
  healers/        — LLM-based self-healing modules
  profiles/       — Per-site configuration (selectors, strategy)
  models/         — Pydantic data models (Event, Venue, etc.)
  utils/          — Hashing, rate limiting, helpers
backend/          — FastAPI REST API + PostGIS
frontend/         — Next.js + Mapbox GL JS web app
```

## Getting Started

### Scraper
```bash
cd scraper
pip install -r requirements.txt
python -m scraper.cli profile https://worldcurling.org/events/
```

## Tech Stack
- **Scraper**: Python, Playwright, httpx, Smartproxy
- **Backend**: FastAPI, PostgreSQL + PostGIS, SQLAlchemy
- **Frontend**: Next.js, Mapbox GL JS, Vanilla CSS
