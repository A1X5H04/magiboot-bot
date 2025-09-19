# MagiBoot Bot

A Telegram bot for managing boot configurations, built with TypeScript and Cloudflare Workers.

## Features

- `/start` - Welcome message and bot introduction
- `/help` - Show available commands and usage
- `/create` - Create a new boot configuration (placeholder)

## Prerequisites

- Node.js 18 or later
- npm or pnpm
- Cloudflare account
- Telegram Bot Token from [@BotFather](https://t.me/botfather)

## Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd magiboot-bot
   ```

2. Install dependencies:
   ```bash
   pnpm install
   # or
   npm install
   ```

3. Copy the example environment file and update with your details:
   ```bash
   cp wrangler.example.toml wrangler.toml
   # Edit wrangler.toml with your bot token
   ```

4. Start the development server:
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

5. Set up webhook (in a new terminal):
   ```bash
   curl -F "url=<your-ngrok-or-public-url>" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
   ```

## Development

- `pnpm dev` - Start development server
- `pnpm test` - Run tests
- `pnpm deploy` - Deploy to Cloudflare Workers

## Environment Variables

Create a `wrangler.toml` file with the following content:

```toml
name = "magiboot-bot"
main = "src/index.ts"
compatibility_date = "2025-08-07"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "development"

[build]
command = "npm run build"

[dev]
ip = "0.0.0.0"
local_protocol = "http"

# Add your bot token here
[[vars]]
name = "BOT_TOKEN"
value = "your-telegram-bot-token-here"
```

## Project Structure

```
src/
├── commands/      # Command handlers
├── handlers/      # Message and callback handlers
├── lib/           # Utility functions and types
├── services/      # Business logic services
├── repository/    # Database operations (placeholder)
└── database/      # Database schema and migrations (placeholder)
```

## License

MIT
