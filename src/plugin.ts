import type { Plugin } from "@elizaos/core";
import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  type State,
  Service,
  logger,
} from "@elizaos/core";

const RAWG_BASE = "https://api.rawg.io/api";
const CHEAPSHARK_BASE = "https://www.cheapshark.com/api/1.0";

function rawgKey(): string | null {
  return process.env.RAWG_API_KEY?.trim() || null;
}

function affiliateTag(): string {
  return process.env.TEKUMI_AFFILIATE_TAG?.trim() || "";
}

function steamUrl(appId: number): string {
  const tag = affiliateTag();
  return tag
    ? `https://store.steampowered.com/app/${appId}?utm_source=tekumi&utm_medium=affiliate`
    : `https://store.steampowered.com/app/${appId}`;
}

class GamingService extends Service {
  static serviceType = "gaming";
  capabilityDescription = "Game discovery, deal tracking, and gaming news";

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime) {
    return new GamingService(runtime);
  }

  static async stop(runtime: IAgentRuntime) {
    const service = runtime.getService(GamingService.serviceType);
    service?.stop();
  }

  async stop() {}

  async searchGames(query: string): Promise<string> {
    const key = rawgKey();
    if (!key)
      return "RAWG API key not configured. Set RAWG_API_KEY in your env.";

    try {
      const params = new URLSearchParams({
        key,
        search: query,
        page_size: "5",
      });
      const res = await fetch(`${RAWG_BASE}/games?${params}`);
      if (!res.ok) return `API error: ${res.status}`;
      const data = (await res.json()) as {
        results?: Array<{
          id: number;
          name: string;
          released: string;
          rating: number;
          genres: Array<{ name: string }>;
          platforms: Array<{ platform: { name: string } }>;
          slug: string;
        }>;
      };

      if (!data.results?.length) return `No games found for "${query}".`;

      return data.results
        .map((g) => {
          const genres = g.genres?.map((x) => x.name).join(", ") || "N/A";
          const platforms =
            g.platforms?.map((p) => p.platform.name).join(", ") || "N/A";
          return `- **${g.name}** (${g.released?.slice(0, 4) || "TBA"})  ★${g.rating || "N/A"}\n  Genres: ${genres}\n  Platforms: ${platforms}`;
        })
        .join("\n");
    } catch (e) {
      logger.error({ error: e }, "RAWG search failed");
      return "Failed to search games. Try again later.";
    }
  }

  async getGameDeals(gameName?: string): Promise<string> {
    try {
      const params = new URLSearchParams(
        gameName
          ? { title: gameName, limit: "5" }
          : { limit: "5", pageSize: "5" },
      );
      const res = await fetch(`${CHEAPSHARK_BASE}/deals?${params}`);
      if (!res.ok) return `Deals API error: ${res.status}`;
      const data = (await res.json()) as Array<{
        title: string;
        salePrice: string;
        normalPrice: string;
        savings: string;
        steamAppID: string;
        dealID: string;
        storeID: string;
      }>;

      if (!data?.length) return "No deals found right now.";

      return data
        .map((d) => {
          const pct = Math.round(parseFloat(d.savings));
          const link = d.steamAppID
            ? steamUrl(parseInt(d.steamAppID))
            : `https://www.cheapshark.com/redirect?dealID=${d.dealID}`;
          return `- **${d.title}** — $${d.salePrice} (was $${d.normalPrice}, -${pct}%)\n  ${link}`;
        })
        .join("\n");
    } catch (e) {
      logger.error({ error: e }, "CheapShark failed");
      return "Failed to fetch deals. Try again later.";
    }
  }

  async getGamingNews(query?: string): Promise<string> {
    try {
      const url = query
        ? `https://newsapi.org/v2/everything?q=${encodeURIComponent(query + " gaming")}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWSAPI_KEY || ""}`
        : `https://newsapi.org/v2/everything?q=gaming&language=en&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWSAPI_KEY || ""}`;

      if (!process.env.NEWSAPI_KEY?.trim()) {
        return "NewsAPI key not configured. Set NEWSAPI_KEY in your env, or ask me to search for specific games.";
      }

      const res = await fetch(url);
      if (!res.ok) return `News API error: ${res.status}`;
      const data = (await res.json()) as {
        articles?: Array<{
          title: string;
          source: { name: string };
          url: string;
          publishedAt: string;
        }>;
      };

      if (!data.articles?.length) return "No recent gaming news found.";

      return data.articles
        .map((a) => {
          const date = a.publishedAt?.slice(0, 10) || "";
          return `- ${date} — **[${a.title}](${a.url})** (${a.source?.name || "source"})`;
        })
        .join("\n");
    } catch (e) {
      logger.error({ error: e }, "News fetch failed");
      return "Failed to fetch gaming news. Try again later.";
    }
  }
}

const searchGamesAction: Action = {
  name: "SEARCH_GAMES",
  similes: [
    "FIND_GAME",
    "LOOKUP_GAME",
    "RECOMMEND_GAME",
    "GAME_SUGGESTION",
    "WHAT_TO_PLAY",
  ],
  description: "Search for games by name, genre, or platform",

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text?.toLowerCase() || "";
    const triggers = [
      "game",
      "play",
      "search",
      "find",
      "recommend",
      "genre",
      "rpg",
      "fps",
      "platform",
    ];
    return triggers.some((t) => text.includes(t));
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const service = _runtime.getService<GamingService>("gaming");
      if (!service) throw new Error("GamingService not available");

      const query =
        message.content?.text
          ?.replace(/search|find|recommend|show|game|games/gi, "")
          .trim() || "popular games";

      const results = await service.searchGames(query);
      const text =
        results.startsWith("No games found") ||
        results.includes("API key not configured")
          ? results
          : `**🎮 Games matching "${query}":**\n\n${results}\n\nWant me to find deals on any of these?`;

      await callback({ text, actions: ["SEARCH_GAMES"] });

      return { success: true, text, data: { action: "SEARCH_GAMES", query } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await callback({ text: `Search failed: ${msg}`, error: true });
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      { name: "{{name1}}", content: { text: "Find me open world RPGs" } },
      {
        name: "Tekumi",
        content: {
          text: '**🎮 Games matching "open world RPGs":**\n\n- **The Witcher 3** ...',
          actions: ["SEARCH_GAMES"],
        },
      },
    ],
  ],
};

const getDealsAction: Action = {
  name: "GET_DEALS",
  similes: ["DEALS", "SALES", "DISCOUNTS", "CHEAP", "BARGAIN", "ON_SALE"],
  description: "Find current game deals and discounts across stores",

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text?.toLowerCase() || "";
    const triggers = [
      "deal",
      "sale",
      "discount",
      "cheap",
      "price",
      "save",
      "offer",
      "bargain",
    ];
    return triggers.some((t) => text.includes(t));
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const service = _runtime.getService<GamingService>("gaming");
      if (!service) throw new Error("GamingService not available");

      const text = message.content?.text || "";
      const gameMatch = text.match(
        /(?:for|on|about)\s+(.+?)(?:\?|deal|sale|discount|$)/i,
      );
      const gameName = gameMatch?.[1]?.trim();

      const results = await service.getGameDeals(gameName);
      const header = gameName
        ? `**💰 Deals for "${gameName}":**\n\n`
        : `**💰 Hot deals right now:**\n\n`;
      const footer = `\n\n_Prices may vary by region. Links include affiliate support to keep Tekumi running._`;

      const text_content = results.includes("No deals")
        ? results
        : `${header}${results}${footer}`;

      await callback({ text: text_content, actions: ["GET_DEALS"] });

      return {
        success: true,
        text: text_content,
        data: { action: "GET_DEALS", game: gameName },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await callback({ text: `Deal lookup failed: ${msg}`, error: true });
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      { name: "{{name1}}", content: { text: "Any deals on Hades?" } },
      {
        name: "Tekumi",
        content: {
          text: '**💰 Deals for "Hades":**\n\n- **Hades** — $9.99 (was $24.99, -60%)\n  https://store.steampowered.com/app/1145360',
          actions: ["GET_DEALS"],
        },
      },
    ],
  ],
};

const gameNewsAction: Action = {
  name: "GAME_NEWS",
  similes: [
    "NEWS",
    "GAMING_NEWS",
    "LATEST",
    "UPDATES",
    "ANNOUNCEMENTS",
    "WHAT_NEW",
  ],
  description: "Get the latest gaming news and announcements",

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text?.toLowerCase() || "";
    const triggers = [
      "news",
      "latest",
      "announcement",
      "upcoming",
      "release",
      "coming out",
      "new game",
    ];
    return triggers.some((t) => text.includes(t));
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const service = _runtime.getService<GamingService>("gaming");
      if (!service) throw new Error("GamingService not available");

      const text = message.content?.text || "";
      const topic = text
        .replace(
          /news|latest|announcement|upcoming|what's new|tell me|show/gi,
          "",
        )
        .trim();

      const results = await service.getGamingNews(topic || undefined);
      const header = topic
        ? `**📰 Gaming news about "${topic}":**\n\n`
        : `**📰 Latest gaming news:**\n\n`;

      await callback({
        text: results.includes("not configured")
          ? results
          : `${header}${results}`,
        actions: ["GAME_NEWS"],
      });

      return {
        success: true,
        text: results,
        data: { action: "GAME_NEWS", topic },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await callback({ text: `News fetch failed: ${msg}`, error: true });
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      { name: "{{name1}}", content: { text: "What's new in gaming?" } },
      {
        name: "Tekumi",
        content: {
          text: "**📰 Latest gaming news:**\n\n- 2024-01-15 — **[Elden Ring DLC announced]** (IGN)",
          actions: ["GAME_NEWS"],
        },
      },
    ],
  ],
};

const gamingProvider: Provider = {
  name: "GAMING_CONTEXT",
  description: "Provides gaming context about recent releases and trends",

  get: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const text = message.content?.text?.toLowerCase() || "";
    const triggers = [
      "god of war",
      "gta",
      "laufey",
      "trailer",
      "announced",
      "reveal",
      "release",
      "news",
      "latest",
      "new game",
      "coming out",
      "fifa",
      "rpg",
      "souls-like",
      "soulsborne",
      "multiplayer",
      "ps5",
      "xbox",
      "cheap",
      "hard",
      "easy",
      "assasins creed",
      "awaiting",
      "big-time",
      "indie",
      "cheap",
      "pc",
      "reddit",
      "steam",
      "fortnite",
      "ea",
      "fifa",
      "cod",
      "call of duty",
      "medieval",
      "underrated",
    ];
    const matched = triggers.find((t) => text.includes(t));
    if (matched && process.env.NEWSAPI_KEY?.trim()) {
      const term = extractSpecificTerm(text) || matched;
      try {
        const res = await fetch(
          `https://newsapi.org/v2/everything?q=${encodeURIComponent(term)}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWSAPI_KEY}`,
        );
        if (res.ok) {
          const body = (await res.json()) as {
            articles?: Array<{
              title: string;
              url: string;
              publishedAt: string;
            }>;
          };
          if (body.articles?.length) {
            const items = body.articles
              .map(
                (a) => `- ${a.title} (${a.publishedAt.slice(0, 10)}): ${a.url}`,
              )
              .join("\n");
            return {
              text: `[LIVE GAME NEWS as of ${new Date().toISOString().slice(0, 10)}]\n${items}`,
              values: {},
              data: {},
            };
          }
        }
      } catch {
        // fall through to static fallback
      }
    }
    return {
      text: `[LIVE GAME NEWS as of ${new Date().toISOString().slice(0, 10)}]\nNo live news data — do not invent.\n\nYou are Tekumi, a gaming discovery agent. Current date: ${new Date().toISOString().slice(0, 10)}. Include store links with your recommendations when possible.`,
      values: {},
      data: {},
    };
  },
};

function extractSpecificTerm(raw: string): string | null {
  const patterns = [
    /god\s+of\s+war\s+laufey/i,
    /god\s+of\s+war\s+ragnarok/i,
    /god\s+of\s+war/i,
    /gta\s+\d/i,
    /gta/i,
    /laufey/i,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m) return m[0];
  }
  const words = raw.split(/\s+/).filter((w) => w.length > 3);
  return words.length > 0 ? words.slice(0, 3).join(" ") : null;
}

const plugin: Plugin = {
  name: "tekumi-gaming",
  description: "Game discovery, deals tracking, and gaming news for Tekumi",
  priority: 0,
  config: {
    RAWG_API_KEY: process.env.RAWG_API_KEY,
    NEWSAPI_KEY: process.env.NEWSAPI_KEY,
    TEKUMI_AFFILIATE_TAG: process.env.TEKUMI_AFFILIATE_TAG,
  },
  async init(config: Record<string, string>) {
    for (const [key, value] of Object.entries(config)) {
      if (value) process.env[key] = value;
    }
  },
  services: [GamingService],
  actions: [searchGamesAction, getDealsAction, gameNewsAction],
  providers: [gamingProvider],
};

export default plugin;
