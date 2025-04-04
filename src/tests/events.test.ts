import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../pages/api/slack/events';
import { NextApiRequestWithRawBody } from '../pages/api/slack/config';
import { verifySlackRequest } from '../utils/slack';
import { 
  handleMessage, 
  handleAppMention, 
  handleReactionAdded, 
  handleAppHomeOpened 
} from '../services/slack';
import getRawBody from 'raw-body';

// Mock dependencies
jest.mock('raw-body', () => jest.fn());
jest.mock('../utils/slack', () => ({
  logVerbose: jest.fn(),
  toErrorWithMessage: jest.fn(error => ({ message: String(error) })),
  verifySlackRequest: jest.fn()
}));
jest.mock('../services/slack', () => ({
  handleMessage: jest.fn(),
  handleAppMention: jest.fn(),
  handleReactionAdded: jest.fn(),
  handleAppHomeOpened: jest.fn()
}));

describe('Slack Events API Handler', () => {
  let mockReq: Partial<NextApiRequestWithRawBody>;
  let mockRes: Partial<NextApiResponse>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup response mocks
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRes = {
      status: statusMock,
      json: jsonMock
    };
    
    // Setup request mock
    mockReq = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '100'
      },
      rawBody: '{"type":"event_callback","event":{"type":"message"}}'
    };
    
    // Mock getRawBody to return the request body
    (getRawBody as jest.Mock).mockResolvedValue(Buffer.from(mockReq.rawBody as string));
    
    // Mock process.env
    process.env.NODE_ENV = 'development';
    process.env.SLACK_SIGNING_SECRET = 'test-secret';
  });
  
  afterEach(() => {
    // Reset environment
    delete process.env.NODE_ENV;
    delete process.env.SLACK_SIGNING_SECRET;
  });

  test('should reject non-POST requests', async () => {
    mockReq.method = 'GET';
    
    await handler(mockReq as NextApiRequestWithRawBody, mockRes as NextApiResponse);
    
    expect(statusMock).toHaveBeenCalledWith(405);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  test('should handle URL verification challenge', async () => {
    mockReq.rawBody = '{"type":"url_verification","challenge":"test-challenge"}';
    (getRawBody as jest.Mock).mockResolvedValue(Buffer.from(mockReq.rawBody));
    
    await handler(mockReq as NextApiRequestWithRawBody, mockRes as NextApiResponse);
    
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ challenge: 'test-challenge' });
  });

  test('should verify Slack request signature in production', async () => {
    // Set NODE_ENV to production
    process.env.NODE_ENV = 'production';
    
    // Mock verifySlackRequest to return true
    (verifySlackRequest as jest.Mock).mockReturnValue(true);
    
    await handler(mockReq as NextApiRequestWithRawBody, mockRes as NextApiResponse);
    
    expect(verifySlackRequest).toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ ok: true });
  });

  test('should reject unauthorized requests in production', async () => {
    // Set NODE_ENV to production
    process.env.NODE_ENV = 'production';
    
    // Mock verifySlackRequest to return false
    (verifySlackRequest as jest.Mock).mockReturnValue(false);
    
    await handler(mockReq as NextApiRequestWithRawBody, mockRes as NextApiResponse);
    
    expect(verifySlackRequest).toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('should handle message events', async () => {
    mockReq.rawBody = '{"type":"event_callback","event":{"type":"message"}}';
    (getRawBody as jest.Mock).mockResolvedValue(Buffer.from(mockReq.rawBody));
    
    await handler(mockReq as NextApiRequestWithRawBody, mockRes as NextApiResponse);
    
    expect(handleMessage).toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ ok: true });
  });

  test('should handle app_mention events', async () => {
    mockReq.rawBody = '{"type":"event_callback","event":{"type":"app_mention"}}';
    (getRawBody as jest.Mock).mockResolvedValue(Buffer.from(mockReq.rawBody));
    
    await handler(mockReq as NextApiRequestWithRawBody, mockRes as NextApiResponse);
    
    expect(handleAppMention).toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ ok: true });
  });

  test('should handle reaction_added events', async () => {
    mockReq.rawBody = '{"type":"event_callback","event":{"type":"reaction_added"}}';
    (getRawBody as jest.Mock).mockResolvedValue(Buffer.from(mockReq.rawBody));
    
    await handler(mockReq as NextApiRequestWithRawBody, mockRes as NextApiResponse);
    
    expect(handleReactionAdded).toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ ok: true });
  });

  test('should handle app_home_opened events', async () => {
    mockReq.rawBody = '{"type":"event_callback","event":{"type":"app_home_opened"}}';
    (getRawBody as jest.Mock).mockResolvedValue(Buffer.from(mockReq.rawBody));
    
    await handler(mockReq as NextApiRequestWithRawBody, mockRes as NextApiResponse);
    
    expect(handleAppHomeOpened).toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ ok: true });
  });

  test('should log unhandled event types', async () => {
    mockReq.rawBody = '{"type":"event_callback","event":{"type":"unknown_event"}}';
    (getRawBody as jest.Mock).mockResolvedValue(Buffer.from(mockReq.rawBody));
    
    await handler(mockReq as NextApiRequestWithRawBody, mockRes as NextApiResponse);
    
    // No handler should be called
    expect(handleMessage).not.toHaveBeenCalled();
    expect(handleAppMention).not.toHaveBeenCalled();
    expect(handleReactionAdded).not.toHaveBeenCalled();
    expect(handleAppHomeOpened).not.toHaveBeenCalled();
    
    // Should still return 200 OK
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ ok: true });
  });

  test('should handle errors during processing', async () => {
    // Mock getRawBody to throw an error
    (getRawBody as jest.Mock).mockRejectedValue(new Error('Test error'));
    
    await handler(mockReq as NextApiRequestWithRawBody, mockRes as NextApiResponse);
    
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
