import { parseRawBody, slackApiConfig } from '../pages/api/slack/config';
import { NextApiResponse } from 'next';
import getRawBody from 'raw-body';

// Mock getRawBody
jest.mock('raw-body', () => jest.fn());

describe('Slack API Config', () => {
  describe('slackApiConfig', () => {
    test('should disable the built-in body parser', () => {
      expect(slackApiConfig.api.bodyParser).toBe(false);
    });
  });

  describe('parseRawBody', () => {
    let mockReq: any;
    let mockRes: Partial<NextApiResponse>;
    let mockNext: jest.Mock;

    beforeEach(() => {
      mockReq = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '100'
        }
      };
      mockRes = {};
      mockNext = jest.fn();

      // Reset mocks
      (getRawBody as jest.Mock).mockReset();
    });

    test('should parse raw body for POST requests', async () => {
      // Set content-type to include utf-8
      mockReq.headers['content-type'] = 'application/json; charset=utf-8';

      // Mock getRawBody to return a buffer
      const mockRawBody = Buffer.from('{"test":"data"}');
      (getRawBody as jest.Mock).mockResolvedValue(mockRawBody);

      await parseRawBody(mockReq, mockRes as NextApiResponse, mockNext);

      // Should have called getRawBody
      expect(getRawBody).toHaveBeenCalledWith(mockReq, {
        length: '100',
        limit: '1mb',
        encoding: 'utf-8'
      });

      // Should have attached the raw body to the request
      expect(mockReq.rawBody).toBe('{"test":"data"}');

      // Should have called next
      expect(mockNext).toHaveBeenCalled();
    });

    test('should skip parsing for non-POST requests', async () => {
      mockReq.method = 'GET';

      await parseRawBody(mockReq, mockRes as NextApiResponse, mockNext);

      // Should not have called getRawBody
      expect(getRawBody).not.toHaveBeenCalled();

      // Should not have attached a raw body
      expect(mockReq.rawBody).toBeUndefined();

      // Should have called next
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle non-UTF8 content types', async () => {
      mockReq.headers['content-type'] = 'application/octet-stream';

      // Mock getRawBody to return a buffer
      const mockRawBody = Buffer.from([0x01, 0x02, 0x03]);
      (getRawBody as jest.Mock).mockResolvedValue(mockRawBody);

      await parseRawBody(mockReq, mockRes as NextApiResponse, mockNext);

      // Should have called getRawBody with undefined encoding
      expect(getRawBody).toHaveBeenCalledWith(mockReq, {
        length: '100',
        limit: '1mb',
        encoding: undefined
      });

      // Should have attached the raw body to the request
      expect(mockReq.rawBody).toBe(mockRawBody.toString());

      // Should have called next
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle errors during parsing', async () => {
      // Mock getRawBody to throw an error
      const mockError = new Error('Parse error');
      (getRawBody as jest.Mock).mockRejectedValue(mockError);

      // Mock console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();

      await parseRawBody(mockReq, mockRes as NextApiResponse, mockNext);

      // Should have logged the error
      expect(console.error).toHaveBeenCalledWith('Error parsing raw body:', mockError);

      // Should have called next despite the error
      expect(mockNext).toHaveBeenCalled();

      // Restore console.error
      console.error = originalConsoleError;
    });
  });
});
