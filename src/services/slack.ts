import { WebClient } from '@slack/web-api';
import {
  SlackEvent,
  SlackMessageEvent,
  SlackAppMentionEvent,
  SlackReactionAddedEvent,
  SlackAppHomeOpenedEvent,
  SlackChannelInfo
} from '../types/slack';
import { logVerbose, toErrorWithMessage, withRetry, createRichMessage } from '../utils/slack';
import { generateAIResponse } from './ai';
import { conversationManager } from './conversation';

// Initialize Slack client
const slackToken = process.env.SLACK_BOT_TOKEN || '';
const slackClient = new WebClient(slackToken);
const botUserId = process.env.SLACK_BOT_USER_ID || '';

// Function to handle incoming messages
export async function handleMessage(event: SlackMessageEvent): Promise<void> {
  logVerbose('MESSAGE', 'Received message event', { event });

  // Ignore bot messages to prevent infinite loops
  if (event.bot_id || event.subtype === 'bot_message') {
    logVerbose('MESSAGE', 'Ignoring bot message');
    return;
  }

  const { channel, user, text, thread_ts } = event;

  try {
    // Check if this is a direct message (IM) or channel message
    const channelInfo = await withRetry(() => slackClient.conversations.info({
      channel: channel
    })) as SlackChannelInfo;

    logVerbose('CHANNEL', 'Retrieved channel info', {
      channelId: channel,
      isIm: channelInfo.channel?.is_im,
      isChannel: channelInfo.channel?.is_channel
    });

    // Handle private/direct messages
    if (channelInfo.channel?.is_im) {
      logVerbose('DM', `Processing direct message from ${user}`, { text });
      await processPrivateMessage(event);
    }
    // Handle channel messages that mention the bot
    else if (text && (
      text.includes(`<@${botUserId}>`) ||
      text.toLowerCase().includes('ibrain')
    )) {
      logVerbose('MENTION', `Processing mention in channel from ${user}`, {
        text,
        channel,
        thread_ts
      });
      await processChannelMention(event);
    }
  } catch (error) {
    const err = toErrorWithMessage(error);
    logVerbose('ERROR', 'Error handling message', { error: err.message, stack: err.stack });
  }
}

// Function to handle app mentions
export async function handleAppMention(event: SlackAppMentionEvent): Promise<void> {
  logVerbose('APP_MENTION', 'Received app_mention event', { event });

  // Process as a channel mention
  await processChannelMention(event);
}

// Function to handle reaction added events
export async function handleReactionAdded(event: SlackReactionAddedEvent): Promise<void> {
  logVerbose('REACTION', 'Received reaction_added event', { event });

  // Example: respond to specific reactions
  if (event.reaction === 'question' || event.reaction === 'thinking_face') {
    try {
      // Get the original message
      const result = await withRetry(() => slackClient.conversations.history({
        channel: event.item.channel,
        latest: event.item.ts,
        inclusive: true,
        limit: 1
      }));

      const originalMessage = result.messages?.[0];

      if (originalMessage && originalMessage.text) {
        // Respond in thread
        await withRetry(() => slackClient.chat.postMessage({
          channel: event.item.channel,
          thread_ts: event.item.ts,
          text: `I noticed you reacted with :${event.reaction}:. Do you need help with this?`
        }));
      }
    } catch (error) {
      const err = toErrorWithMessage(error);
      logVerbose('ERROR', 'Error handling reaction', { error: err.message });
    }
  }
}

// Function to handle app home opened events
export async function handleAppHomeOpened(event: SlackAppHomeOpenedEvent): Promise<void> {
  logVerbose('APP_HOME', 'Received app_home_opened event', { event });

  try {
    // Publish a welcome view to the App Home
    await withRetry(() => slackClient.views.publish({
      user_id: event.user,
      view: {
        type: 'home',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'Welcome to iBrain! 👋',
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: "I'm your AI assistant for this Slack workspace. Here's how you can interact with me:"
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Direct Messages*\nSend me a DM anytime and I\'ll respond to your questions.'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Channel Mentions*\nMention me in any channel using @iBrain and I\'ll respond there.'
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'iBrain is powered by AI and is constantly learning. Your feedback helps me improve!'
              }
            ]
          }
        ]
      }
    }));
  } catch (error) {
    const err = toErrorWithMessage(error);
    logVerbose('ERROR', 'Error updating app home', { error: err.message });
  }
}

// Function to process private messages
export async function processPrivateMessage(event: SlackMessageEvent): Promise<void> {
  const { channel, user, text, thread_ts } = event;

  try {
    logVerbose('DM_PROCESS', 'Processing private message content', { text });

    // Show typing indicator
    await withRetry(() => slackClient.chat.postEphemeral({
      channel: channel,
      user: user,
      text: '...'
    }));

    // Generate a response treating the message as a direct communication
    const aiResponse = await generateAIResponse(text, user, true, thread_ts);

    // Send the response
    await withRetry(() => slackClient.chat.postMessage({
      channel: channel,
      text: aiResponse,
      thread_ts: thread_ts, // Respond in thread if it's a thread
    }));

    logVerbose('DM_PROCESS', 'Successfully processed private message');
  } catch (error) {
    const err = toErrorWithMessage(error);
    logVerbose('ERROR', 'Error processing private message', { error: err.message, stack: err.stack });

    // Send error message
    try {
      await slackClient.chat.postMessage({
        channel: channel,
        text: "I'm sorry, I encountered an error processing your message. Please try again later.",
        thread_ts: thread_ts,
      });
    } catch (sendError) {
      logVerbose('ERROR', 'Failed to send error message', { error: sendError });
    }
  }
}

// Function to process channel mentions
export async function processChannelMention(event: SlackEvent): Promise<void> {
  const { channel, user, text, thread_ts } = event;

  if (!channel || !user || !text) {
    logVerbose('ERROR', 'Missing required fields in event', { event });
    return;
  }

  try {
    logVerbose('MENTION_PROCESS', 'Processing channel mention', { channel, text });

    // Clean the text by removing the bot mention
    const cleanText = text
      .replace(new RegExp(`<@${botUserId}>`, 'g'), '')
      .replace(/@ibrain/i, '')
      .trim();

    logVerbose('MENTION_PROCESS', 'Cleaned message text', {
      originalText: text,
      cleanedText: cleanText
    });

    // Show typing indicator
    await withRetry(() => slackClient.chat.postEphemeral({
      channel: channel,
      user: user,
      text: '...'
    }));

    // Generate a response treating the message as a channel mention
    const aiResponse = await generateAIResponse(cleanText, user, false, thread_ts);

    // Send the response using rich formatting
    await withRetry(() => slackClient.chat.postMessage({
      channel: channel,
      ...createRichMessage(aiResponse),
      thread_ts: thread_ts, // Respond in thread if it's a thread
    }));

    logVerbose('MENTION_PROCESS', 'Successfully processed channel mention');
  } catch (error) {
    const err = toErrorWithMessage(error);
    logVerbose('ERROR', 'Error processing channel mention', { error: err.message, stack: err.stack });

    // Send error message
    try {
      await slackClient.chat.postMessage({
        channel: channel,
        text: `<@${user}> I'm sorry, I encountered an error processing your message. Please try again later.`,
        thread_ts: thread_ts,
      });
    } catch (sendError) {
      logVerbose('ERROR', 'Failed to send error message', { error: sendError });
    }
  }
}
