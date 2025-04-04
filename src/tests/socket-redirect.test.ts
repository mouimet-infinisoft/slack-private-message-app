import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../pages/api/slack/socket-redirect';

describe('Socket Redirect Handler', () => {
  test('should return a 200 response with a message', async () => {
    const mockReq = {} as NextApiRequest;
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    } as unknown as NextApiResponse;
    
    await handler(mockReq, mockRes);
    
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'This endpoint exists for compatibility. The app is running in Socket Mode.'
    });
  });
});
