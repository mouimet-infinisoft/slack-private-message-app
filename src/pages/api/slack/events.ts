import { NextApiRequest, NextApiResponse } from 'next';
import { WebClient } from '@slack/web-api';
import crypto from 'crypto';
import { Buffer } from 'buffer';
import { togetherai } from '@ai-sdk/togetherai';
import { generateText } from 'ai';

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

// System prompt for the AI assistant
const SYSTEM_PROMPT = `
You are iBrain, a helpful and friendly AI assistant for a Slack workspace. 
Your purpose is to assist users with their questions and requests.
You respond in a concise, helpful, and friendly manner.
You should always identify as iBrain and respond as if you are the bot itself, not a separate AI.
When appropriate, you can use Slack formatting like *bold*, _italic_, and bullet points.
Keep your responses brief and to the point, focusing on being helpful rather than verbose.
`;

// Generate AI response using Together AI with context
async function generateAIResponse(userMessage: string, userName: string, isDM: boolean = true): Promise<string> {
  try {
    logVerbose('AI', 'Generating response with Together AI', { userMessage, userName, isDM });
    
    // Create specific prompt based on context
    const contextPrompt = isDM ? 
      `The user ${userName} has sent you a direct message: "${userMessage}"` : 
      `The user ${userName} has mentioned you in a channel: "${userMessage}"`;
    
    const { text } = await generateText({
      model: togetherai('meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contextPrompt }
      ]
    });
    
    logVerbose('AI', 'Response generated successfully', { responseLength: text.length });
    
    // Format response to ensure proper user mention
    if (isDM) {
      // For DMs, we don't need to explicitly @ the user
      return text;
    } else {
      // For channel mentions, ensure we @ the user
      return text.includes(`<@${userName}>`) ? text : `<@${userName}> ${text}`;
    }
  } catch (error) {
    const err = toErrorWithMessage(error);
    logVerbose('ERROR', 'Failed to generate AI response', { error: err.message });
    return isDM ? 
      "I'm having trouble processing your request at the moment. Please try again later." :
      `<@${userName}> I'm having trouble processing your request at the moment. Please try again later.`;
  }
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
    
    // Generate a response treating the message as a direct communication
    const aiResponse = await generateAIResponse(text, user, true);
    
    // Send the response
    await slackClient.chat.postMessage({
      channel: channel,
      text: aiResponse,
    });
    
    logVerbose('DM_PROCESS', 'Successfully processed private message');
  } catch (error) {
    const err = toErrorWithMessage(error);
    logVerbose('ERROR', 'Error processing private message', { error: err.message, stack: err.stack });
    
    // Send error message
    try {
      await slackClient.chat.postMessage({
        channel: channel,
        text: "I'm sorry, I encountered an error processing your message. Please try again later.",
      });
    } catch (sendError) {
      logVerbose('ERROR', 'Failed to send error message', { error: sendError });
    }
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
    
    // Generate a response treating the message as a channel mention
    const aiResponse = await generateAIResponse(cleanText, user, false);
    
    // Send the response
    await slackClient.chat.postMessage({
      channel: channel,
      text: aiResponse,
    });
    
    logVerbose('MENTION_PROCESS', 'Successfully processed channel mention');
  } catch (error) {
    const err = toErrorWithMessage(error);
    logVerbose('ERROR', 'Error processing channel mention', { error: err.message, stack: err.stack });
    
    // Send error message
    try {
      await slackClient.chat.postMessage({
        channel: channel,
        text: `<@${user}> I'm sorry, I encountered an error processing your message. Please try again later.`,
      });
    } catch (sendError) {
      logVerbose('ERROR', 'Failed to send error message', { error: sendError });
    }
  }
}