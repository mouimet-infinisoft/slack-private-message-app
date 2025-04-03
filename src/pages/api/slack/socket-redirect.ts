import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ 
    message: 'This endpoint exists for compatibility. The app is running in Socket Mode.' 
  });
}
