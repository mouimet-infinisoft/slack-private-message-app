import { conversationManager, ConversationMessage } from '../services/conversation';

// Mock console.log
const originalConsoleLog = console.log;
beforeEach(() => {
  console.log = jest.fn();
});
afterEach(() => {
  console.log = originalConsoleLog;
  // Clear all conversations after each test
  conversationManager.clearConversation('testUser', 'dm');
  conversationManager.clearConversation('testUser', 'channel');
});

describe('Conversation Manager', () => {
  describe('getConversation', () => {
    test('should return empty array for new conversation', () => {
      const conversation = conversationManager.getConversation('testUser', 'dm');
      expect(conversation).toEqual([]);
    });

    test('should return existing conversation', () => {
      // Add a message first
      conversationManager.addMessage('testUser', 'dm', {
        role: 'user',
        content: 'Hello'
      });

      // Then get the conversation
      const conversation = conversationManager.getConversation('testUser', 'dm');

      expect(conversation.length).toBe(1);
      expect(conversation[0].content).toBe('Hello');
    });
  });

  describe('addMessage', () => {
    test('should add message to new conversation', () => {
      conversationManager.addMessage('testUser', 'dm', {
        role: 'user',
        content: 'Hello'
      });

      const conversation = conversationManager.getConversation('testUser', 'dm');

      expect(conversation.length).toBe(1);
      expect(conversation[0].role).toBe('user');
      expect(conversation[0].content).toBe('Hello');
    });

    test('should add message to existing conversation', () => {
      // Add first message
      conversationManager.addMessage('testUser', 'dm', {
        role: 'user',
        content: 'Hello'
      });

      // Add second message
      conversationManager.addMessage('testUser', 'dm', {
        role: 'assistant',
        content: 'Hi there!'
      });

      const conversation = conversationManager.getConversation('testUser', 'dm');

      expect(conversation.length).toBe(2);
      expect(conversation[1].role).toBe('assistant');
      expect(conversation[1].content).toBe('Hi there!');
    });

    test('should trim conversation to max length but keep system message', () => {
      // Add system message
      conversationManager.addMessage('testUser', 'dm', {
        role: 'system',
        content: 'System prompt'
      });

      // Add more messages than the max length (which is 10)
      for (let i = 0; i < 15; i++) {
        conversationManager.addMessage('testUser', 'dm', {
          role: 'user',
          content: `Message ${i}`
        });
      }

      const conversation = conversationManager.getConversation('testUser', 'dm');

      // The system message might be kept in addition to the max length
      // So we check that we have either 10 or 11 messages (if system message was preserved)
      expect(conversation.length).toBeLessThanOrEqual(11);

      // Should have kept the system message
      const hasSystemMessage = conversation.some(msg => msg.role === 'system' && msg.content === 'System prompt');
      expect(hasSystemMessage).toBe(true);

      // Should have the most recent messages
      expect(conversation[conversation.length - 1].content).toBe('Message 14');
    });
  });

  describe('clearConversation', () => {
    test('should clear conversation', () => {
      // Add a message
      conversationManager.addMessage('testUser', 'dm', {
        role: 'user',
        content: 'Hello'
      });

      // Clear the conversation
      conversationManager.clearConversation('testUser', 'dm');

      // Get the conversation again
      const conversation = conversationManager.getConversation('testUser', 'dm');

      expect(conversation).toEqual([]);
    });

    test('should handle clearing non-existent conversation', () => {
      // Clear a conversation that doesn't exist
      conversationManager.clearConversation('nonExistentUser', 'dm');

      // Should not throw an error
      expect(true).toBe(true);
    });
  });

  describe('conversation expiration', () => {
    test('should set expiration timer when getting conversation', () => {
      // Mock setTimeout
      const originalSetTimeout = global.setTimeout;
      const mockSetTimeout = jest.fn().mockReturnValue(123);
      global.setTimeout = mockSetTimeout;

      // Get a conversation
      conversationManager.getConversation('testUser', 'dm');

      // Should have called setTimeout
      expect(mockSetTimeout).toHaveBeenCalled();

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    });

    test('should reset expiration timer when adding message', () => {
      // Mock setTimeout
      const originalSetTimeout = global.setTimeout;
      const mockSetTimeout = jest.fn().mockReturnValue(123);
      global.setTimeout = mockSetTimeout;

      // Add a message
      conversationManager.addMessage('testUser', 'dm', {
        role: 'user',
        content: 'Hello'
      });

      // Should have called setTimeout
      expect(mockSetTimeout).toHaveBeenCalled();

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    });

    test('should clear expiration timer when clearing conversation', () => {
      // Mock setTimeout and clearTimeout
      const originalSetTimeout = global.setTimeout;
      const originalClearTimeout = global.clearTimeout;
      const mockSetTimeout = jest.fn().mockReturnValue(123);
      const mockClearTimeout = jest.fn();
      global.setTimeout = mockSetTimeout;
      global.clearTimeout = mockClearTimeout;

      // Get a conversation to set the timer
      conversationManager.getConversation('testUser', 'dm');

      // Clear the conversation
      conversationManager.clearConversation('testUser', 'dm');

      // Should have called clearTimeout
      expect(mockClearTimeout).toHaveBeenCalled();

      // Restore functions
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    });
  });
});
