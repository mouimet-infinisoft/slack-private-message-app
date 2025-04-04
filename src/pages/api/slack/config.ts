import { NextApiRequest, NextApiResponse } from 'next';
import getRawBody from 'raw-body';

// Type for the Next.js API handler with raw body
export type NextApiRequestWithRawBody = NextApiRequest & {
  rawBody?: string;
};

// Middleware to parse and attach raw body to the request
export async function parseRawBody(
  req: NextApiRequestWithRawBody, 
  res: NextApiResponse, 
  next: () => void
) {
  try {
    // Only parse POST requests
    if (req.method === 'POST') {
      const contentType = req.headers['content-type'] || '';
      
      // Get the raw body as a string
      const rawBody = await getRawBody(req, {
        length: req.headers['content-length'],
        limit: '1mb',
        encoding: contentType.includes('utf-8') ? 'utf-8' : undefined,
      });
      
      // Attach the raw body to the request object
      req.rawBody = rawBody.toString();
    }
  } catch (error) {
    console.error('Error parsing raw body:', error);
  }
  
  // Continue to the next middleware or handler
  next();
}

// Helper function to configure API route options
export const slackApiConfig = {
  api: {
    bodyParser: false, // Disable the built-in body parser
  },
};
