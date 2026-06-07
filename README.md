# Tekumi — Your AI Gaming Discovery Agent

**Tekumi** is an [ElizaOS](https://elizaos.ai) agent that helps gamers find their next favorite game, track the best deals across stores, and stay on top of gaming news — all through natural conversation.

Built with pluggable APIs (RAWG, CheapShark, Steam, NewsAPI) and deployable via Telegram or headless chat.

---

## Features

- **Game Search** — Search by title, genre, platform, or mood via RAWG
- **Deal Tracking** — Live discounts across Steam, GOG, Epic, and more via CheapShark
- **Gaming News** — Industry headlines from NewsAPI and per-game Steam news
- **Steam News** — Direct patch notes and updates via the Steam API
- **Personalized Recommendations** — Context-aware suggestions with store links

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     ElizaOS Runtime                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ SEARCH   │ │ GET      │ │ GAME     │ │ STEAM          │  │
│  │ _GAMES   │ │ _DEALS   │ │ _NEWS    │ │ _NEWS          │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬────────┘  │
│       │            │            │               │           │
│       └────────────┴────────────┴───────────────┘           │
│                            │                                 │
│                  ┌─────────▼──────────┐                      │
│                  │   GamingService    │                      │
│                  │  (RAWG / CheapShark │                      │
│                  │   / Steam / NewsAPI)│                      │
│                  └────────────────────┘                      │
│                            │                                 │
│  ┌─────────────────────────▼──────────────────────────────┐  │
│  │                 GAMING_CONTEXT Provider                 │  │
│  │    (injects live news into agent prompt context)        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Plugin: `tekumi-gaming`

| Action | Trigger | Source |
|--------|---------|--------|
| `SEARCH_GAMES` | "find me open world RPGs" | RAWG API |
| `GET_DEALS` | "any deals on Hades?" | CheapShark |
| `GAME_NEWS` | "what's new in gaming?" | NewsAPI + Steam (per-game) |
| `STEAM_NEWS` | "steam news for Elden Ring" | Steam API |

A `GAMING_CONTEXT` provider enriches the agent's context with live headlines so every response is grounded in real data.

---

## Quick Start

```bash
# Install dependencies
bun install

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys (see Configuration below)

# Start in development mode
bun run dev
```

### Configuration

Tekumi requires at least one API key to function:

| Variable | Required | Source | Free Tier? |
|----------|----------|--------|------------|
| `RAWG_API_KEY` | Yes (search) | [rawg.io/signup](https://rawg.io/signup) | ✅ 20k calls/mo |
| `NEWSAPI_KEY` | Yes (news) | [newsapi.org](https://newsapi.org) | ✅ 100 calls/day |
| `TEKUMI_AFFILIATE_TAG` | No | Your Steam partner tag | Optional |

**Model provider** (pick one):
- `OPENROUTER_API_KEY` — get one at [openrouter.ai](https://openrouter.ai)
- `OPENAI_API_KEY` — get one at [platform.openai.com](https://platform.openai.com)
- Set `OLLAMA_API_ENDPOINT` for local models

**Optional integrations:**
- `TELEGRAM_BOT_TOKEN` — deploy as a Telegram bot

---

## Usage Examples

```
User:  find me souls-like games
Tekumi: 🎮 Games matching "souls-like":
        - Lies of P (2023) ★4.2
          Genres: Action, RPG
          Platforms: PC, PS5, Xbox

User:  any deals on Hades?
Tekumi: 💰 Deals for "Hades":
        - Hades — $9.99 (was $24.99, -60%)
          https://store.steampowered.com/app/1145360

User:  steam news for Elden Ring
Tekumi: 🎮 Steam News for "Elden Ring":
        - 2024-06-21 — [Elden Ring Patch 1.12 Available Now] (Steam)

User:  what's new in gaming?
Tekumi: 📰 Latest gaming news:
        - 2024-06-21 — [Summer Game Fest roundup] (IGN)
        - 2024-06-20 — [New AAA title announced] (Kotaku)
```

---

## Development

```bash
# Build
bun run build

# Type check
bun run type-check

# Run tests
bun run test

# Lint
bun run lint
```

---

## Deployment

```bash
# Production build
bun run build

# Start with a specific character
NODE_ENV=production bun run dev

# Via process manager
pm2 start "bun run dev" --name "tekumi"
```

For production, consider:
- Setting `LOG_LEVEL=info` or `warn`
- Using a PostgreSQL database (`DATABASE_URL`)
- Enabling your model provider's paid tier for reliable inference

---

Built with [ElizaOS](https://elizaos.ai) — the open-source AI agent framework.
