import { WebClient } from '@slack/web-api';
import {
  handleMessage,
  handleAppMention,
  handleReactionAdded,
  handleAppHomeOpened,
  processPrivateMessage,
  processChannelMention
} from '../services/slack';
import { generateAIResponse } from '../services/ai';
import { conversationManager } from '../services/conversation';

// Create mock WebClient instance
const mockWebClient = {
  conversations: {
    info: jest.fn(),
    history: jest.fn()
  },
  chat: {
    postMessage: jest.fn(),
    postEphemeral: jest.fn()
  },
  views: {
    publish: jest.fn()
  }
};

// Mock dependencies
jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn(() => mockWebClient)
}));

jest.mock('../services/ai', () => ({
  generateAIResponse: jest.fn().mockResolvedValue('AI response')
}));

jest.mock('../services/conversation', () => ({
  conversationManager: {
    getConversation: jest.fn(),
    addMessage: jest.fn()
  }
}));

// Mock withRetry to actually call the function with the arguments
jest.mock('../utils/slack', () => ({
  logVerbose: jest.fn(),
  toErrorWithMessage: jest.fn(error => ({ message: String(error) })),
  withRetry: jest.fn().mockImplementation(fn => fn()),
  createRichMessage: jest.fn(text => ({ blocks: [{ text: { text } }] }))
}));

// Mock console.log
const originalConsoleLog = console.log;
beforeEach(() => {
  console.log = jest.fn();

  // Reset all mocks
  jest.clearAllMocks();

  // Mock process.env
  process.env.SLACK_BOT_USER_ID = 'U12345BOT';
});

afterEach(() => {
  console.log = originalConsoleLog;
  delete process.env.SLACK_BOT_USER_ID;
});

describe('Slack Service', () => {
  // mockWebClient is already defined above

  describe('handleMessage', () => {
    test('should ignore bot messages', async () => {
      const event = {
        type: 'message',
        bot_id: 'B12345',
        channel: 'C12345',
        user: 'U12345',
        text: 'Hello'
      };

      await handleMessage(event as any);

      // Should not call conversations.info
      expect(mockWebClient.conversations.info).not.toHaveBeenCalled();
    });

    test('should ignore messages with bot_subtype', async () => {
      const event = {
        type: 'message',
        subtype: 'bot_message',
        channel: 'C12345',
        user: 'U12345',
        text: 'Hello'
      };

      await handleMessage(event as any);

      // Should not call conversations.info
      expect(mockWebClient.conversations.info).not.toHaveBeenCalled();
    });

    test('should process direct messages', async () => {
      // Mock conversations.info to return a DM channel
      mockWebClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'D12345',
          is_im: true,
          is_channel: false
        }
      } as any);

      const event = {
        type: 'message',
        channel: 'D12345',
        user: 'U12345',
        text: 'Hello'
      };

      await handleMessage(event as any);

      // Should call conversations.info
      expect(mockWebClient.conversations.info).toHaveBeenCalledWith({
        channel: 'D12345'
      });

      // Should call processPrivateMessage
      expect(mockWebClient.chat.postEphemeral).toHaveBeenCalled();
      expect(generateAIResponse).toHaveBeenCalled();
      expect(mockWebClient.chat.postMessage).toHaveBeenCalled();
    });

    test('should process channel mentions with bot user ID', async () => {
      // Mock conversations.info to return a channel
      mockWebClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'C12345',
          is_im: false,
          is_channel: true
        }
      } as any);

      const event = {
        type: 'message',
        channel: 'C12345',
        user: 'U12345',
        text: 'Hey <@U12345BOT> how are you?'
      };

      await handleMessage(event as any);

      // Should call conversations.info
      expect(mockWebClient.conversations.info).toHaveBeenCalledWith({
        channel: 'C12345'
      });

      // Should call processChannelMention
      expect(mockWebClient.chat.postEphemeral).toHaveBeenCalled();
      expect(generateAIResponse).toHaveBeenCalled();
      expect(mockWebClient.chat.postMessage).toHaveBeenCalled();
    });

    test('should process channel mentions with "ibrain"', async () => {
      // Mock conversations.info to return a channel
      mockWebClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'C12345',
          is_im: false,
          is_channel: true
        }
      } as any);

      const event = {
        type: 'message',
        channel: 'C12345',
        user: 'U12345',
        text: 'Hey ibrain how are you?'
      };

      await handleMessage(event as any);

      // Should call conversations.info
      expect(mockWebClient.conversations.info).toHaveBeenCalledWith({
        channel: 'C12345'
      });

      // Should call processChannelMention
      expect(mockWebClient.chat.postEphemeral).toHaveBeenCalled();
      expect(generateAIResponse).toHaveBeenCalled();
      expect(mockWebClient.chat.postMessage).toHaveBeenCalled();
    });

    test('should ignore channel messages without mentions', async () => {
      // Mock conversations.info to return a channel
      mockWebClient.conversations.info.mockResolvedValue({
        channel: {
          id: 'C12345',
          is_im: false,
          is_channel: true
        }
      } as any);

      const event = {
        type: 'message',
        channel: 'C12345',
        user: 'U12345',
        text: 'Hello everyone'
      };

      await handleMessage(event as any);

      // Should call conversations.info
      expect(mockWebClient.conversations.info).toHaveBeenCalledWith({
        channel: 'C12345'
      });

      // Should not call processChannelMention
      expect(mockWebClient.chat.postEphemeral).not.toHaveBeenCalled();
      expect(generateAIResponse).not.toHaveBeenCalled();
      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();
    });

    test('should handle errors', async () => {
      // Mock conversations.info to throw an error
      mockWebClient.conversations.info.mockRejectedValue(new Error('API error'));

      const event = {
        type: 'message',
        channel: 'C12345',
        user: 'U12345',
        text: 'Hello'
      };

      await handleMessage(event as any);

      // Should call conversations.info
      expect(mockWebClient.conversations.info).toHaveBeenCalledWith({
        channel: 'C12345'
      });

      // Should not call any processing functions
      expect(mockWebClient.chat.postEphemeral).not.toHaveBeenCalled();
      expect(generateAIResponse).not.toHaveBeenCalled();
      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleAppMention', () => {
    test('should process app mentions', async () => {
      const event = {
        type: 'app_mention',
        channel: 'C12345',
        user: 'U12345',
        text: '<@U12345BOT> Hello'
      };

      // Mock generateAIResponse
      (generateAIResponse as jest.Mock).mockResolvedValue('Hello there!');

      await handleAppMention(event as any);

      // Should call processChannelMention
      expect(mockWebClient.chat.postEphemeral).toHaveBeenCalled();
      expect(generateAIResponse).toHaveBeenCalled();
      expect(mockWebClient.chat.postMessage).toHaveBeenCalled();
    });
  });

  describe('handleReactionAdded', () => {
    test('should respond to specific reactions', async () => {
      const event = {
        type: 'reaction_added',
        user: 'U12345',
        reaction: 'question',
        item: {
          type: 'message',
          channel: 'C12345',
          ts: '1234567890.123456'
        }
      };

      // Mock conversations.history
      mockWebClient.conversations.history.mockResolvedValue({
        messages: [
          {
            text: 'Original message'
          }
        ]
      } as any);

      await handleReactionAdded(event as any);

      // Should call conversations.history
      expect(mockWebClient.conversations.history).toHaveBeenCalledWith({
        channel: 'C12345',
        latest: '1234567890.123456',
        inclusive: true,
        limit: 1
      });

      // Should call chat.postMessage
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C12345',
        thread_ts: '1234567890.123456',
        text: expect.stringContaining('question')
      });
    });

    test('should ignore non-specific reactions', async () => {
      const event = {
        type: 'reaction_added',
        user: 'U12345',
        reaction: 'thumbsup',
        item: {
          type: 'message',
          channel: 'C12345',
          ts: '1234567890.123456'
        }
      };

      await handleReactionAdded(event as any);

      // Should not call conversations.history
      expect(mockWebClient.conversations.history).not.toHaveBeenCalled();

      // Should not call chat.postMessage
      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();
    });

    test('should handle errors', async () => {
      const event = {
        type: 'reaction_added',
        user: 'U12345',
        reaction: 'question',
        item: {
          type: 'message',
          channel: 'C12345',
          ts: '1234567890.123456'
        }
      };

      // Mock conversations.history to throw an error
      mockWebClient.conversations.history.mockRejectedValue(new Error('API error'));

      await handleReactionAdded(event as any);

      // Should call conversations.history
      expect(mockWebClient.conversations.history).toHaveBeenCalled();

      // Should not call chat.postMessage
      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleAppHomeOpened', () => {
    test('should publish app home view', async () => {
      const event = {
        type: 'app_home_opened',
        user: 'U12345',
        channel: 'D12345',
        tab: 'home'
      };

      await handleAppHomeOpened(event as any);

      // Should call views.publish
      expect(mockWebClient.views.publish).toHaveBeenCalledWith({
        user_id: 'U12345',
        view: expect.objectContaining({
          type: 'home',
          blocks: expect.any(Array)
        })
      });
    });

    test('should handle errors', async () => {
      const event = {
        type: 'app_home_opened',
        user: 'U12345',
        channel: 'D12345',
        tab: 'home'
      };

      // Mock views.publish to throw an error
      mockWebClient.views.publish.mockRejectedValue(new Error('API error'));

      await handleAppHomeOpened(event as any);

      // Should call views.publish
      expect(mockWebClient.views.publish).toHaveBeenCalled();
    });
  });

  describe('processPrivateMessage', () => {
    test('should process private messages', async () => {
      const event = {
        type: 'message',
        channel: 'D12345',
        user: 'U12345',
        text: 'Hello'
      };

      // Mock generateAIResponse
      (generateAIResponse as jest.Mock).mockResolvedValue('Hello there!');

      await processPrivateMessage(event as any);

      // Should call chat.postEphemeral
      expect(mockWebClient.chat.postEphemeral).toHaveBeenCalledWith({
        channel: 'D12345',
        user: 'U12345',
        text: '...'
      });

      // Should call generateAIResponse
      expect(generateAIResponse).toHaveBeenCalledWith('Hello', 'U12345', true, undefined);

      // Should call chat.postMessage
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'D12345',
        text: 'Hello there!',
        thread_ts: undefined
      });
    });

    test('should handle thread replies', async () => {
      const event = {
        type: 'message',
        channel: 'D12345',
        user: 'U12345',
        text: 'Hello',
        thread_ts: '1234567890.123456'
      };

      // Mock generateAIResponse
      (generateAIResponse as jest.Mock).mockResolvedValue('Hello there!');

      await processPrivateMessage(event as any);

      // Should call generateAIResponse with thread_ts
      expect(generateAIResponse).toHaveBeenCalledWith('Hello', 'U12345', true, '1234567890.123456');

      // Should call chat.postMessage with thread_ts
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'D12345',
        text: 'Hello there!',
        thread_ts: '1234567890.123456'
      });
    });

    test('should handle errors in AI generation', async () => {
      const event = {
        type: 'message',
        channel: 'D12345',
        user: 'U12345',
        text: 'Hello'
      };

      // Mock generateAIResponse to throw an error
      (generateAIResponse as jest.Mock).mockRejectedValue(new Error('AI error'));

      await processPrivateMessage(event as any);

      // Should call chat.postMessage with error message
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'D12345',
        text: expect.stringContaining('sorry'),
        thread_ts: undefined
      });
    });

    test('should handle errors in sending error message', async () => {
      const event = {
        type: 'message',
        channel: 'D12345',
        user: 'U12345',
        text: 'Hello'
      };

      // Mock generateAIResponse to throw an error
      (generateAIResponse as jest.Mock).mockRejectedValue(new Error('AI error'));

      // Mock chat.postMessage to throw an error
      mockWebClient.chat.postMessage.mockRejectedValue(new Error('API error'));

      await processPrivateMessage(event as any);

      // Should call chat.postMessage
      expect(mockWebClient.chat.postMessage).toHaveBeenCalled();
    });
  });

  describe('processChannelMention', () => {
    test('should process channel mentions', async () => {
      const event = {
        type: 'message',
        channel: 'C12345',
        user: 'U12345',
        text: '<@U12345BOT> Hello'
      };

      // Mock generateAIResponse
      (generateAIResponse as jest.Mock).mockResolvedValue('<@U12345> Hello there!');

      await processChannelMention(event as any);

      // Should call chat.postEphemeral
      expect(mockWebClient.chat.postEphemeral).toHaveBeenCalledWith({
        channel: 'C12345',
        user: 'U12345',
        text: '...'
      });

      // Should call generateAIResponse with cleaned text
      expect(generateAIResponse).toHaveBeenCalledWith('Hello', 'U12345', false, undefined);

      // Should call chat.postMessage
      expect(mockWebClient.chat.postMessage).toHaveBeenCalled();
    });

    test('should handle thread replies', async () => {
      const event = {
        type: 'message',
        channel: 'C12345',
        user: 'U12345',
        text: '<@U12345BOT> Hello',
        thread_ts: '1234567890.123456'
      };

      // Mock generateAIResponse
      (generateAIResponse as jest.Mock).mockResolvedValue('<@U12345> Hello there!');

      await processChannelMention(event as any);

      // Should call generateAIResponse with thread_ts
      expect(generateAIResponse).toHaveBeenCalledWith('Hello', 'U12345', false, '1234567890.123456');

      // Should call chat.postMessage with thread_ts
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        channel: 'C12345',
        thread_ts: '1234567890.123456'
      }));
    });

    test('should handle errors in AI generation', async () => {
      const event = {
        type: 'message',
        channel: 'C12345',
        user: 'U12345',
        text: '<@U12345BOT> Hello'
      };

      // Mock generateAIResponse to throw an error
      (generateAIResponse as jest.Mock).mockRejectedValue(new Error('AI error'));

      await processChannelMention(event as any);

      // Should call chat.postMessage with error message
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C12345',
        text: expect.stringContaining('<@U12345>'),
        thread_ts: undefined
      });
    });

    test('should handle missing required fields', async () => {
      const event = {
        type: 'message',
        channel: 'C12345'
        // Missing user and text
      };

      await processChannelMention(event as any);

      // Should not call any API methods
      expect(mockWebClient.chat.postEphemeral).not.toHaveBeenCalled();
      expect(generateAIResponse).not.toHaveBeenCalled();
      expect(mockWebClient.chat.postMessage).not.toHaveBeenCalled();
    });
  });
});
