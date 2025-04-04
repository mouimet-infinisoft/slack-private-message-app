import crypto from 'crypto';
import { 
  toErrorWithMessage, 
  logVerbose, 
  verifySlackRequest, 
  withRetry, 
  createRichMessage 
} from '../utils/slack';
import { NextApiRequestWithRawBody } from '../pages/api/slack/config';

// Mock crypto functions
jest.mock('crypto', () => ({
  createHmac: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mockedDigest')
  }),
  timingSafeEqual: jest.fn()
}));

// Mock console.log
const originalConsoleLog = console.log;
beforeEach(() => {
  console.log = jest.fn();
});
afterEach(() => {
  console.log = originalConsoleLog;
});

describe('Slack Utils', () => {
  describe('toErrorWithMessage', () => {
    test('should convert Error object to ErrorWithMessage', () => {
      const error = new Error('Test error');
      const result = toErrorWithMessage(error);
      expect(result.message).toBe('Test error');
    });

    test('should convert string to ErrorWithMessage', () => {
      const error = 'Test error string';
      const result = toErrorWithMessage(error);
      expect(result.message).toBe('Test error string');
    });

    test('should convert any other value to ErrorWithMessage', () => {
      const error = 123;
      const result = toErrorWithMessage(error);
      expect(result.message).toBe('123');
    });
  });

  describe('logVerbose', () => {
    test('should log message with context', () => {
      logVerbose('TEST', 'Test message');
      expect(console.log).toHaveBeenCalledTimes(1);
    });

    test('should log message with context and data', () => {
      logVerbose('TEST', 'Test message', { foo: 'bar' });
      expect(console.log).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifySlackRequest', () => {
    let mockReq: Partial<NextApiRequestWithRawBody>;
    
    beforeEach(() => {
      mockReq = {
        headers: {
          'x-slack-signature': 'v0:mockedSignature',
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString()
        },
        rawBody: 'test-body'
      };
      
      // Reset mocks
      (crypto.createHmac as jest.Mock).mockClear();
      (crypto.timingSafeEqual as jest.Mock).mockClear();
    });

    test('should return false if signature header is missing', () => {
      mockReq.headers = { 'x-slack-request-timestamp': '123456789' };
      const result = verifySlackRequest(mockReq as NextApiRequestWithRawBody, 'secret');
      expect(result).toBe(false);
    });

    test('should return false if timestamp header is missing', () => {
      mockReq.headers = { 'x-slack-signature': 'v0:signature' };
      const result = verifySlackRequest(mockReq as NextApiRequestWithRawBody, 'secret');
      expect(result).toBe(false);
    });

    test('should return false if timestamp is too old', () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds old (> 5 minutes)
      mockReq.headers = {
        'x-slack-signature': 'v0:signature',
        'x-slack-request-timestamp': oldTimestamp.toString()
      };
      const result = verifySlackRequest(mockReq as NextApiRequestWithRawBody, 'secret');
      expect(result).toBe(false);
    });

    test('should verify signature correctly when valid', () => {
      (crypto.timingSafeEqual as jest.Mock).mockReturnValue(true);
      
      const result = verifySlackRequest(mockReq as NextApiRequestWithRawBody, 'secret');
      
      expect(crypto.createHmac).toHaveBeenCalledWith('sha256', 'secret');
      expect(crypto.timingSafeEqual).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test('should return false when signature verification fails', () => {
      (crypto.timingSafeEqual as jest.Mock).mockReturnValue(false);
      
      const result = verifySlackRequest(mockReq as NextApiRequestWithRawBody, 'secret');
      
      expect(result).toBe(false);
    });

    test('should handle errors during verification', () => {
      (crypto.timingSafeEqual as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = verifySlackRequest(mockReq as NextApiRequestWithRawBody, 'secret');
      
      expect(result).toBe(false);
    });
  });

  describe('withRetry', () => {
    test('should return result on first successful attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(mockFn);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(result).toBe('success');
    });

    test('should retry on failure and succeed eventually', async () => {
      // Mock function that fails twice then succeeds
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      // Mock setTimeout to execute immediately
      jest.useFakeTimers();
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => {
        callback();
        return {} as NodeJS.Timeout;
      });
      
      const result = await withRetry(mockFn, 3, 100);
      
      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
      
      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
      jest.useRealTimers();
    });

    test('should throw error after max retries', async () => {
      // Mock function that always fails
      const mockError = new Error('Always fail');
      const mockFn = jest.fn().mockRejectedValue(mockError);
      
      // Mock setTimeout to execute immediately
      jest.useFakeTimers();
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => {
        callback();
        return {} as NodeJS.Timeout;
      });
      
      await expect(withRetry(mockFn, 2, 100)).rejects.toThrow(mockError);
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
      
      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
      jest.useRealTimers();
    });
  });

  describe('createRichMessage', () => {
    test('should create rich message without userId', () => {
      const result = createRichMessage('Hello world');
      
      expect(result).toHaveProperty('blocks');
      expect(result.blocks[0].text.text).toBe('Hello world');
    });

    test('should create rich message with userId', () => {
      const result = createRichMessage('Hello world', 'U12345');
      
      expect(result).toHaveProperty('blocks');
      expect(result.blocks[0].text.text).toBe('<@U12345> Hello world');
    });
  });
});
