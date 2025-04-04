import { togetherai } from '@ai-sdk/togetherai';
import { generateText } from 'ai';
import { OpenAI } from 'openai';
import { logVerbose, toErrorWithMessage, withRetry } from '../utils/slack';
import { conversationManager, ConversationMessage } from './conversation';

// System prompt for the AI assistant
export const SYSTEM_PROMPT = `
You are iBrain, a helpful and friendly AI assistant for a Slack workspace. 
Your purpose is to assist users with their questions and requests.
You respond in a concise, helpful, and friendly manner.
You should always identify as iBrain and respond as if you are the bot itself, not a separate AI.
When appropriate, you can use Slack formatting like *bold*, _italic_, and bullet points.
Keep your responses brief and to the point, focusing on being helpful rather than verbose.
`;

// Initialize OpenAI client as fallback
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const openai = new OpenAI({
  apiKey: openaiApiKey,
});

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
    
    // Try to generate response with Together AI
    try {
      return await withRetry(async () => {
        const { text } = await generateText({
          model: togetherai('meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'),
          messages: messages.map(m => ({ role: m.role, content: m.content }))
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
      }, 2, 500);
    } catch (error) {
      // If Together AI fails, try OpenAI as fallback
      logVerbose('AI', 'Together AI failed, falling back to OpenAI', { 
        error: toErrorWithMessage(error).message 
      });
      
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured for fallback');
      }
      
      return await withRetry(async () => {
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: 500
        });
        
        const text = completion.choices[0]?.message?.content || 
          "I'm having trouble processing your request at the moment.";
        
        // Add assistant response to history
        conversationManager.addMessage(userId, contextType, { 
          role: 'assistant', 
          content: text 
        });
        
        logVerbose('AI', 'Response generated successfully with OpenAI fallback', { 
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
      }, 2, 500);
    }
  } catch (error) {
    const err = toErrorWithMessage(error);
    logVerbose('ERROR', 'Failed to generate AI response', { error: err.message });
    
    return isDM ? 
      "I'm having trouble processing your request at the moment. Please try again later." :
      `<@${userId}> I'm having trouble processing your request at the moment. Please try again later.`;
  }
}
