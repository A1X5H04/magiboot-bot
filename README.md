# Telegram Boot Animation Bot

A Telegram bot that converts videos into boot animation modules using a serverless, queue-based architecture.

This project offloads heavy video processing to GitHub Actions, allowing the bot to remain lightweight and scalable. Requests are managed via a database queue system.

## How It Works

1.  A user sends a video to the Telegram bot.
2.  The request is validated and added to a job queue in a Turso database.
3.  A GitHub Action is triggered to process the queue.
4.  The Action worker pulls a job, downloads the video, and uses FFmpeg to convert it into a PNG sequence.
5.  The PNGs are packaged into a boot animation module (`bootanimation.zip`).
6.  The completed module is sent back to the user via Telegram.

## Tech Stack

  - **Runtime**: Deno
  - **Platform**: Netlify Edge Functions
  - **Database**: Turso (using LibSQL)
  - **Compute**: GitHub Actions
  - **Video Processing**: FFmpeg

## Prerequisites

  - Deno 1.x
  - Netlify Account
  - Turso Account
  - GitHub Account (for Actions)
  - Telegram Bot Token from [@BotFather](https://t.me/botfather)

## Getting Started

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd <repository-name>
    ```

2.  **Set up environment variables:**
    Copy the example environment file and fill in your details.

    ```bash
    cp .env.example .env
    ```

3.  **Start the development server:**
    The Netlify CLI will run the Deno server for you.

    ```bash
    netlify dev
    ```

4.  **Set up the Telegram webhook:**
    In a new terminal, link your deployed URL to your Telegram bot.

    ```bash
    curl -F "url=<your-netlify-or-ngrok-url>" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
    ```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Your Telegram bot token from @BotFather
BOT_TOKEN="your-telegram-bot-token-here"

# Turso database URL
TURSO_DB_URL="your-turso-database-url"

# Turso database authentication token
TURSO_DB_AUTH_TOKEN="your-turso-auth-token"

# GitHub token to trigger actions (if needed)
GITHUB_TOKEN="your-github-personal-access-token"
```

## License

MIT

> Written by A.I