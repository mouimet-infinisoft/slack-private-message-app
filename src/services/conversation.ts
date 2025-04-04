import { logVerbose } from '../utils/slack';

// Message interface for conversation history
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Simple in-memory conversation store
// In a production app, this should be replaced with a persistent store
class ConversationManager {
  private conversations: Record<string, ConversationMessage[]> = {};
  private readonly maxHistoryLength: number = 10;
  private readonly expirationTime: number = 30 * 60 * 1000; // 30 minutes
  private expirations: Record<string, NodeJS.Timeout> = {};

  // Get conversation history for a user
  public getConversation(userId: string, contextType: 'dm' | 'channel'): ConversationMessage[] {
    const key = this.getConversationKey(userId, contextType);
    
    if (!this.conversations[key]) {
      this.conversations[key] = [];
    }
    
    // Reset expiration timer
    this.resetExpirationTimer(key);
    
    return this.conversations[key];
  }

  // Add a message to the conversation history
  public addMessage(userId: string, contextType: 'dm' | 'channel', message: ConversationMessage): void {
    const key = this.getConversationKey(userId, contextType);
    
    if (!this.conversations[key]) {
      this.conversations[key] = [];
    }
    
    this.conversations[key].push(message);
    
    // Trim history to max length
    if (this.conversations[key].length > this.maxHistoryLength) {
      // Always keep the system message if it exists
      const systemMessage = this.conversations[key].find(m => m.role === 'system');
      
      this.conversations[key] = this.conversations[key].slice(-this.maxHistoryLength);
      
      // If we had a system message but it was removed, add it back at the beginning
      if (systemMessage && !this.conversations[key].some(m => m.role === 'system')) {
        this.conversations[key].unshift(systemMessage);
      }
    }
    
    // Reset expiration timer
    this.resetExpirationTimer(key);
    
    logVerbose('CONVERSATION', `Added message to conversation for ${userId}`, {
      contextType,
      messageCount: this.conversations[key].length
    });
  }

  // Clear conversation history for a user
  public clearConversation(userId: string, contextType: 'dm' | 'channel'): void {
    const key = this.getConversationKey(userId, contextType);
    
    delete this.conversations[key];
    
    if (this.expirations[key]) {
      clearTimeout(this.expirations[key]);
      delete this.expirations[key];
    }
    
    logVerbose('CONVERSATION', `Cleared conversation for ${userId}`, { contextType });
  }

  // Get the conversation key
  private getConversationKey(userId: string, contextType: 'dm' | 'channel'): string {
    return `${userId}-${contextType}`;
  }

  // Reset the expiration timer for a conversation
  private resetExpirationTimer(key: string): void {
    if (this.expirations[key]) {
      clearTimeout(this.expirations[key]);
    }
    
    this.expirations[key] = setTimeout(() => {
      if (this.conversations[key]) {
        logVerbose('CONVERSATION', `Conversation expired for key ${key}`);
        delete this.conversations[key];
      }
      delete this.expirations[key];
    }, this.expirationTime);
  }
}

// Export a singleton instance
export const conversationManager = new ConversationManager();
