import { NextRequest, NextResponse } from 'next/server';
import { experimental_createMCPClient } from 'ai';

// Configure Edge Runtime
export const config = {
  runtime: 'experimental-edge',
};

// Simple error handler for MCP client
function handleMCPError(error: unknown, url: string) {
  console.error(`Error with MCP client at ${url}:`, error);
}

export default async function handler(req: NextRequest) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      );
    }

    // Parse request body
    const body = await req.json();

    // Connect to MCP server and get tools
    const githubMCPUrl = process.env.GITHUB_MCP_URL || 'http://localhost:3001/github';

    // Create MCP client
    const client = await experimental_createMCPClient({
      transport: { type: "sse", url: githubMCPUrl },
      onUncaughtError: (error) => handleMCPError(error, githubMCPUrl),
    });

    // Get available tools
    const tools = await client.tools();

    // Return tools
    return NextResponse.json({ tools });
  } catch (error) {
    console.error('Error in AI tools endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
