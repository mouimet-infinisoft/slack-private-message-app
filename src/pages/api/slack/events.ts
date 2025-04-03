import { NextApiRequest, NextApiResponse } from 'next';
import { WebClient } from '@slack/web-api';
import crypto from 'crypto';
import { Buffer } from 'buffer';

// Initialize Slack client
const slackToken = process.env.SLACK_BOT_TOKEN || '';
const slackClient = new WebClient(slackToken);
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET || '';

// Type for error handling
interface ErrorWithMessage {
  message: string;
  stack?: string;
}

// Function to ensure error is treated as ErrorWithMessage
function toErrorWithMessage(error: unknown): ErrorWithMessage {
  if (error && typeof error === 'object' && 'message' in error) {
    return error as ErrorWithMessage;
  }
  return { message: String(error) };
}

// Verbose logging function
function logVerbose(context: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${context}] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [${context}] Data:`, JSON.stringify(data, null, 2));
  }
}

// Verify Slack request signature
function verifySlackRequest(req: NextApiRequest): boolean {
  logVerbose('SECURITY', 'Verifying Slack request signature');
  const signature = req.headers['x-slack-signature'] as string;
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const body = req.body ? JSON.stringify(req.body) : '';
  
  // Check if timestamp is recent (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    logVerbose('SECURITY', 'Request timestamp too old', { currentTime, requestTimestamp: timestamp });
    return false;
  }
  
  // Create the signature to compare with Slack's
  const sigBasestring = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', slackSigningSecret);
  const calculatedSignature = `v0=${hmac.update(sigBasestring).digest('hex')}`;
  
  logVerbose('SECURITY', 'Comparing signatures', { 
    receivedSignature: signature, 
    calculatedSignature
  });
  
  // Compare signatures (in production, uncomment this)
  // try {
  //   return crypto.timingSafeEqual(
  //     Buffer.from(calculatedSignature),
  //     Buffer.from(signature)
  //   );
  // } catch (e) {
  //   const err = toErrorWithMessage(e);
  //   logVerbose('SECURITY', 'Signature verification failed', { error: err.message });
  //   return false;
  // }
  
  // For development, return true
  logVerbose('SECURITY', 'Development mode: skipping signature verification');
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  logVerbose('API', 'Received Slack API request', { 
    method: req.method,
    headers: req.headers,
    bodyType: req.body?.type
  });

  // Only allow POST requests
  if (req.method !== 'POST') {
    logVerbose('API', 'Method not allowed', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Handle Slack URL verification challenge
  if (req.body.type === 'url_verification') {
    logVerbose('API', 'Processing URL verification challenge');
    return res.status(200).json({ challenge: req.body.challenge });
  }

  try {
    // Verify request is coming from Slack
    // Note: In production, uncomment the verification
    // if (!verifySlackRequest(req)) {
    //   logVerbose('SECURITY', 'Unauthorized request rejected');
    //   return res.status(401).json({ error: 'Unauthorized' });
    // }
    
    const body = req.body;
    logVerbose('EVENT', 'Processing Slack event', { eventType: body.event?.type });
    
    // Process events
    if (body.event) {
      const event = body.event;
      
      // Handle message events
      if (event.type === 'message') {
        await handleMessage(event);
      }
    }
    
    // Acknowledge receipt quickly
    logVerbose('API', 'Successfully processed request');
    return res.status(200).json({ ok: true });
  } catch (error) {
    const err = toErrorWithMessage(error);
    logVerbose('ERROR', 'Error processing Slack event', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Function to handle incoming messages
async function handleMessage(event: any) {
  logVerbose('MESSAGE', 'Received message event', { event });
  
  // Ignore bot messages to prevent infinite loops
  if (event.bot_id || event.subtype === 'bot_message') {
    logVerbose('MESSAGE', 'Ignoring bot message');
    return;
  }

  const { channel, user, text } = event;
  
  try {
    // Check if this is a direct message (IM) or channel message
    const channelInfo = await slackClient.conversations.info({
      channel: channel
    });
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
    // Handle channel messages that mention @ibrain
    else if (text && text.includes('ibrain')) {
      logVerbose('MENTION', `Processing mention in channel from ${user}`, { text, channel });
      await processChannelMention(event);
    }
  } catch (error) {
    const err = toErrorWithMessage(error);
    logVerbose('ERROR', 'Error handling message', { error: err.message, stack: err.stack });
  }
}

// Function to process private messages
async function processPrivateMessage(event: any) {
  const { channel, user, text } = event;
  
  try {
    logVerbose('DM_PROCESS', 'Processing private message content', { text });
    
    // Process based on message content
    if (text.toLowerCase().includes('hello')) {
      logVerbose('RESPONSE', 'Sending hello response');
      await slackClient.chat.postMessage({
        channel: channel,
        text: `Hello <@${user}>! How can I help you today?`,
      });
    } else if (text.toLowerCase().includes('help')) {
      logVerbose('RESPONSE', 'Sending help response');
      await slackClient.chat.postMessage({
        channel: channel,
        text: `Here are some commands you can use:\n• *help* - Show available commands\n• *status* - Check system status\n• *info* - Get app information`,
      });
    } else {
      // Default response
      logVerbose('RESPONSE', 'Sending default response');
      await slackClient.chat.postMessage({
        channel: channel,
        text: `Thanks for your message. I'll process your request: "${text}"`,
      });
    }
    
    logVerbose('DM_PROCESS', 'Successfully processed private message');
  } catch (error) {
    const err = toErrorWithMessage(error);
    logVerbose('ERROR', 'Error processing private message', { error: err.message, stack: err.stack });
  }
}

// Function to process channel mentions
async function processChannelMention(event: any) {
  const { channel, user, text } = event;
  
  try {
    logVerbose('MENTION_PROCESS', 'Processing channel mention', { channel, text });
    
    // Clean the text by removing the @ibrain mention
    const cleanText = text.replace(/@ibrain/i, '').trim();
    logVerbose('MENTION_PROCESS', 'Cleaned message text', { originalText: text, cleanedText: cleanText });
    
    // Process based on message content
    if (cleanText.toLowerCase().includes('hello')) {
      logVerbose('RESPONSE', 'Sending channel hello response');
      await slackClient.chat.postMessage({
        channel: channel,
        text: `Hello <@${user}>! I noticed you mentioned me in the channel. How can I help?`,
      });
    } else if (cleanText.toLowerCase().includes('help')) {
      logVerbose('RESPONSE', 'Sending channel help response');
      await slackClient.chat.postMessage({
        channel: channel,
        text: `<@${user}> Here are some commands you can use:\n• *@ibrain help* - Show available commands\n• *@ibrain status* - Check system status\n• *@ibrain info* - Get app information`,
      });
    } else {
      // Default response for channel mentions
      logVerbose('RESPONSE', 'Sending default channel mention response');
      await slackClient.chat.postMessage({
        channel: channel,
        text: `<@${user}> Thanks for mentioning me! I'll process your request: "${cleanText}"`,
      });
    }
    
    logVerbose('MENTION_PROCESS', 'Successfully processed channel mention');
  } catch (error) {
    const err = toErrorWithMessage(error);
    logVerbose('ERROR', 'Error processing channel mention', { error: err.message, stack: err.stack });
  }
}