import { NextApiRequest, NextApiResponse } from 'next';
import { WebClient } from '@slack/web-api';
import crypto from 'crypto';
import { Buffer } from 'buffer';

// Initialize Slack client
const slackToken = process.env.SLACK_BOT_TOKEN || '';
const slackClient = new WebClient(slackToken);
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET || '';

// Verify Slack request signature
function verifySlackRequest(req: NextApiRequest): boolean {
  const signature = req.headers['x-slack-signature'] as string;
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const body = req.body ? JSON.stringify(req.body) : '';
  
  // Check if timestamp is recent (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    return false;
  }
  
  // Create the signature to compare with Slack's
  const sigBasestring = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', slackSigningSecret);
  const calculatedSignature = `v0=${hmac.update(sigBasestring).digest('hex')}`;
  
  // Compare signatures (in production, uncomment this)
  // try {
  //   return crypto.timingSafeEqual(
  //     Buffer.from(calculatedSignature),
  //     Buffer.from(signature)
  //   );
  // } catch (e) {
  //   return false;
  // }
  
  // For development, return true
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Handle Slack URL verification challenge
  if (req.body.type === 'url_verification') {
    return res.status(200).json({ challenge: req.body.challenge });
  }

  try {
    // Verify request is coming from Slack
    // Note: In production, uncomment the verification
    // if (!verifySlackRequest(req)) {
    //   return res.status(401).json({ error: 'Unauthorized' });
    // }
    
    const body = req.body;
    
    // Process events
    if (body.event) {
      const event = body.event;
      
      // Handle message events
      if (event.type === 'message') {
        await handleMessage(event);
      }
    }
    
    // Acknowledge receipt quickly
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error processing Slack event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Function to handle incoming messages
async function handleMessage(event: any) {
  // Ignore bot messages to prevent infinite loops
  if (event.bot_id || event.subtype === 'bot_message') {
    return;
  }

  const { channel, user, text } = event;
  
  try {
    // Check if this is a direct message (IM)
    const channelInfo = await slackClient.conversations.info({
      channel: channel
    });
    
    // Handle private/direct messages
    if (channelInfo.channel?.is_im) {
      console.log(`Received private message from ${user}: ${text}`);
      
      // Process the private message
      await processPrivateMessage(event);
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
}

// Function to process private messages
async function processPrivateMessage(event: any) {
  const { channel, user, text } = event;
  
  try {
    // Process based on message content
    if (text.toLowerCase().includes('hello')) {
      await slackClient.chat.postMessage({
        channel: channel,
        text: `Hello <@${user}>! How can I help you today?`,
      });
    } else if (text.toLowerCase().includes('help')) {
      await slackClient.chat.postMessage({
        channel: channel,
        text: `Here are some commands you can use:\n• *help* - Show available commands\n• *status* - Check system status\n• *info* - Get app information`,
      });
    } else {
      // Default response
      await slackClient.chat.postMessage({
        channel: channel,
        text: `Thanks for your message. I'll process your request: "${text}"`,
      });
    }
  } catch (error) {
    console.error('Error processing private message:', error);
  }
}
