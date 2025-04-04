import crypto from 'crypto';
import { NextApiRequestWithRawBody } from '../pages/api/slack/config';
import { ErrorWithMessage } from '../types/slack';

// Function to ensure error is treated as ErrorWithMessage
export function toErrorWithMessage(error: unknown): ErrorWithMessage {
  if (error && typeof error === 'object' && 'message' in error) {
    return error as ErrorWithMessage;
  }
  return { message: String(error) };
}

// Verbose logging function
export function logVerbose(context: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${context}] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [${context}] Data:`, JSON.stringify(data, null, 2));
  }
}

// Verify Slack request signature using raw body
export function verifySlackRequest(
  req: NextApiRequestWithRawBody,
  signingSecret: string
): boolean {
  logVerbose('SECURITY', 'Verifying Slack request signature');
  
  const signature = req.headers['x-slack-signature'] as string;
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  
  if (!signature || !timestamp) {
    logVerbose('SECURITY', 'Missing signature or timestamp headers');
    return false;
  }
  
  // Check if timestamp is recent (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    logVerbose('SECURITY', 'Request timestamp too old', { 
      currentTime, 
      requestTimestamp: timestamp 
    });
    return false;
  }
  
  // Get the raw body
  const rawBody = req.rawBody || '';
  
  // Create the signature to compare with Slack's
  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac('sha256', signingSecret);
  const calculatedSignature = `v0=${hmac.update(sigBasestring).digest('hex')}`;
  
  logVerbose('SECURITY', 'Comparing signatures', { 
    receivedSignature: signature, 
    calculatedSignature
  });
  
  // Compare signatures using timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(signature)
    );
  } catch (e) {
    const err = toErrorWithMessage(e);
    logVerbose('SECURITY', 'Signature verification failed', { error: err.message });
    return false;
  }
}

// Retry function with exponential backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 200
): Promise<T> {
  let retries = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      
      if (retries > maxRetries) {
        throw error;
      }
      
      const delay = initialDelay * Math.pow(2, retries - 1);
      logVerbose('RETRY', `Retrying operation (${retries}/${maxRetries}) after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Create rich message with Block Kit
export function createRichMessage(text: string, userId?: string): any {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: userId ? `<@${userId}> ${text}` : text
        }
      }
    ]
  };
}
