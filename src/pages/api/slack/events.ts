import { NextApiResponse } from 'next';
import getRawBody from 'raw-body';

// Import types and utilities
import { NextApiRequestWithRawBody } from './config';
import { SlackEventPayload, SlackUrlVerificationPayload } from '../../../types/slack';
import { logVerbose, toErrorWithMessage, verifySlackRequest } from '../../../utils/slack';

// Import services
import {
  handleMessage,
  handleAppMention,
  handleReactionAdded,
  handleAppHomeOpened
} from '../../../services/slack';

// Get environment variables
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET || '';

// Configure API route to disable body parsing
export const config = {
  api: {
    bodyParser: false, // Disable the built-in body parser
  },
};

export default async function handler(req: NextApiRequestWithRawBody, res: NextApiResponse) {
  try {
    // Get the raw body for signature verification
    const rawBody = await getRawBody(req, {
      length: req.headers['content-length'],
      limit: '1mb',
    });

    // Store the raw body on the request object
    req.rawBody = rawBody.toString();

    // Parse the body as JSON
    const body = JSON.parse(req.rawBody);

    logVerbose('API', 'Received Slack API request', {
      method: req.method,
      headers: req.headers,
      bodyType: body?.type
    });

    // Only allow POST requests
    if (req.method !== 'POST') {
      logVerbose('API', 'Method not allowed', { method: req.method });
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Handle Slack URL verification challenge
    if (body.type === 'url_verification') {
      const verificationBody = body as SlackUrlVerificationPayload;
      logVerbose('API', 'Processing URL verification challenge');
      return res.status(200).json({ challenge: verificationBody.challenge });
    }

    // Verify request is coming from Slack
    if (process.env.NODE_ENV === 'production' && !verifySlackRequest(req, slackSigningSecret)) {
      logVerbose('SECURITY', 'Unauthorized request rejected');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse the event payload
    const eventPayload = body as SlackEventPayload;
    logVerbose('EVENT', 'Processing Slack event', { eventType: eventPayload.event?.type });

    // Process events
    if (eventPayload.event) {
      const event = eventPayload.event;

      // Handle different event types
      switch (event.type) {
        case 'message':
          await handleMessage(event as any);
          break;
        case 'app_mention':
          await handleAppMention(event as any);
          break;
        case 'reaction_added':
          await handleReactionAdded(event as any);
          break;
        case 'app_home_opened':
          await handleAppHomeOpened(event as any);
          break;
        default:
          logVerbose('EVENT', `Unhandled event type: ${event.type}`);
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

// Note: All handler functions have been moved to src/services/slack.ts