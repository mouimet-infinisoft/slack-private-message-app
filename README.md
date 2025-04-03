# Slack Private Message App

A Slack application that handles private messages using TypeScript and Next.js, deployable on Vercel.

## Features

- Receives and processes private/direct messages in Slack
- Supports both HTTP Events API and Socket Mode
- Deployable on Vercel

## Getting Started

1. **Install dependencies:**
   ```
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.local` to `.env` and add your Slack tokens:
     - `SLACK_BOT_TOKEN`: Your bot token (starts with `xoxb-`)
     - `SLACK_SIGNING_SECRET`: Your app signing secret
     - `SLACK_APP_TOKEN`: Your app-level token for Socket Mode (starts with `xapp-`)

3. **Run the development server:**
   ```
   npm run dev
   ```

4. **For Socket Mode (recommended):**
   ```
   npm run socket
   ```

## Deployment

### Deploying to Vercel

1. Connect your GitHub repository to Vercel
2. Add environment variables in the Vercel dashboard
3. Deploy

### Slack App Configuration

1. **Enable Socket Mode:**
   - Go to your [Slack App configuration](https://api.slack.com/apps)
   - Navigate to "Socket Mode" and enable it
   - Generate an App-Level Token with `connections:write` scope

2. **Set up Event Subscriptions:**
   - For HTTP Events API:
     - Set Request URL to `https://your-vercel-app.vercel.app/api/slack/events`
   - Subscribe to bot events: `message.im`

3. **OAuth & Permissions:**
   - Add bot scopes:
     - `chat:write`
     - `im:history`
     - `im:read`

## Implementation Options

### HTTP Events API
- Uses the `/api/slack/events` endpoint
- Works with Vercel's serverless functions
- Use this if you prefer a webhook-based approach

### Socket Mode (Recommended)
- Uses WebSockets for real-time communication
- More efficient and secure (no public URLs needed)
- Better for handling high volumes of events
- Requires a separate process that stays running
