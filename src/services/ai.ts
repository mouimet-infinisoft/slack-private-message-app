import { togetherai } from '@ai-sdk/togetherai';
import { generateText } from 'ai';
import { logVerbose, toErrorWithMessage } from '../utils/slack';
import { conversationManager } from './conversation';

// System prompt for the AI assistant
export const SYSTEM_PROMPT = `
You are iBrain, a helpful and friendly AI assistant for a Slack workspace.
Your purpose is to assist users with their questions and requests.
You respond in a concise, helpful, and friendly manner.
You should always identify as iBrain and respond as if you are the bot itself, not a separate AI.
When appropriate, you can use Slack formatting like *bold*, _italic_, and bullet points.
Keep your responses brief and to the point, focusing on being helpful rather than verbose.
`;

// Function to fetch MCP tools from the Edge API route
async function fetchMCPTools(): Promise<Record<string, any>> {
  try {
    // Determine the base URL based on environment
    const baseUrl = process.env.NODE_ENV === 'production'
      ? process.env.VERCEL_URL || ''
      : 'http://localhost:3000';

    // Make request to the Edge API route
    const response = await fetch(`${baseUrl}/api/ai/tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch MCP tools: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.tools || {};
  } catch (error) {
    logVerbose('MCP', 'Failed to fetch MCP tools', { error: toErrorWithMessage(error).message });
    return {};
  }
}

// Generate AI response using Together AI with context
export async function generateAIResponse(
  userMessage: string,
  userId: string,
  isDM: boolean = true,
  threadTs?: string
): Promise<string> {
  try {
    const contextType = isDM ? 'dm' : 'channel';
    logVerbose('AI', 'Generating response with AI', {
      userMessage,
      userId,
      contextType,
      threadTs
    });

    // Get conversation history
    const conversationHistory = conversationManager.getConversation(userId, contextType);

    // If this is a new conversation, add the system prompt
    if (conversationHistory.length === 0) {
      conversationHistory.push({ role: 'system', content: SYSTEM_PROMPT });
    }

    // Create specific prompt based on context
    const contextPrompt = isDM ?
      `The user has sent you a direct message: "${userMessage}"` :
      `The user has mentioned you in a channel: "${userMessage}"`;

    // Add user message to history
    conversationManager.addMessage(userId, contextType, {
      role: 'user',
      content: contextPrompt
    });

    // Get the messages for the AI request
    const messages = conversationManager.getConversation(userId, contextType);

    // Fetch MCP tools from the Edge API route
    logVerbose('MCP', 'Fetching MCP tools from Edge API');
    const mcpTools = await fetchMCPTools();
    logVerbose('MCP', 'Retrieved MCP tools', { toolCount: Object.keys(mcpTools).length });

    // Generate response with Together AI
    const { text } = await generateText({
      model: togetherai('Qwen/Qwen2.5-72B-Instruct-Turbo'),
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      tools: Object.keys(mcpTools).length > 0 ? mcpTools : undefined,
      toolChoice: Object.keys(mcpTools).length > 0 ? 'auto' : undefined
    });

    // Add assistant response to history
    conversationManager.addMessage(userId, contextType, {
      role: 'assistant',
      content: text
    });

    logVerbose('AI', 'Response generated successfully with Together AI', {
      responseLength: text.length
    });

    // Format response to ensure proper user mention
    if (isDM) {
      // For DMs, we don't need to explicitly @ the user
      return text;
    } else {
      // For channel mentions, ensure we @ the user
      return text.includes(`<@${userId}>`) ? text : `<@${userId}> ${text}`;
    }
  } catch (error) {
    const err = toErrorWithMessage(error);
    logVerbose('ERROR', 'Failed to generate AI response', { error: err.message });

    return isDM ?
      "I'm having trouble processing your request at the moment. Please try again later." :
      `<@${userId}> I'm having trouble processing your request at the moment. Please try again later.`;
  }
}
