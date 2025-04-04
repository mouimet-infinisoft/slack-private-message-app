# Slack Private Message App

A Slack application that handles private messages using TypeScript and Next.js, deployable on Vercel.

## Features

- Receives and processes private/direct messages in Slack
- Handles channel mentions and thread replies
- Supports both HTTP Events API and Socket Mode
- Secure request verification with proper signature checking
- AI-powered responses with conversation context
- Integration with Model Context Protocol (MCP) for GitHub tools
- Fallback AI provider for reliability
- Rich message formatting with Block Kit
- Comprehensive error handling and logging
- Deployable on Vercel

## Getting Started

1. **Install dependencies:**
   ```
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env` and add your tokens:
     - `SLACK_BOT_TOKEN`: Your bot token (starts with `xoxb-`)
     - `SLACK_SIGNING_SECRET`: Your app signing secret
     - `SLACK_APP_TOKEN`: Your app-level token for Socket Mode (starts with `xapp-`)
     - `SLACK_BOT_USER_ID`: Your bot's user ID (for mention detection)
     - `OPENAI_API_KEY`: Optional fallback AI provider
     - `GITHUB_MCP_URL`: URL for GitHub MCP server

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
   - Subscribe to bot events:
     - `message.im` - For direct messages
     - `app_mention` - For @mentions in channels
     - `reaction_added` - For emoji reactions
     - `app_home_opened` - For App Home interactions

3. **OAuth & Permissions:**
   - Add bot scopes:
     - `chat:write` - To send messages
     - `im:history` - To read direct messages
     - `im:read` - To access direct message channels
     - `channels:history` - To read channel messages
     - `reactions:read` - To read reactions
     - `app_mentions:read` - To read @mentions

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

## Architecture

### Code Structure

- `src/pages/api/slack/events.ts` - Main API endpoint for Slack events
- `src/pages/api/slack/config.ts` - Configuration for API routes
- `src/types/slack.ts` - TypeScript interfaces for Slack events
- `src/utils/slack.ts` - Utility functions for Slack integration
- `src/services/conversation.ts` - Conversation context management
- `src/services/ai.ts` - AI response generation with MCP integration
- `src/services/slack.ts` - Slack event handling logic
- `src/socket-mode-server.ts` - Socket Mode implementation

### Security Features

- Proper signature verification using raw request body
- Timestamp validation to prevent replay attacks
- Environment-based security controls

### AI Integration

- Primary AI provider: Together AI with Qwen/Qwen2.5-72B-Instruct-Turbo
- Fallback provider: OpenAI (optional)
- Conversation context management for better responses

### MCP Integration

- Integration with Model Context Protocol (MCP) for GitHub tools
- Uses Vercel AI SDK's experimental_createMCPClient
- Connects to GitHub MCP server via SSE transport
- Provides LLM with access to GitHub repositories, issues, and more
- Graceful fallback if MCP server is unavailable

### Testing

Run tests with:

```
npm test
```
