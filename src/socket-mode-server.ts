import { App } from '@slack/bolt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Bolt app with Socket Mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN, // Socket Mode requires an app-level token
  socketMode: true,
});

// Listen for direct messages (message.im)
app.message(async ({ message, say }) => {
  // Ignore messages from bots to prevent loops
  if ((message as any).bot_id || (message as any).subtype === 'bot_message') {
    return;
  }
  
  // We can be confident this is a direct message since we're subscribing to message.im events
  const text = (message as any).text;
  const user = (message as any).user;
  
  console.log(`Received private message from ${user}: ${text}`);
  
  // Process based on message content
  if (text.toLowerCase().includes('hello')) {
    await say(`Hello <@${user}>! How can I help you today?`);
  } else if (text.toLowerCase().includes('help')) {
    await say(`Here are some commands you can use:\n• *help* - Show available commands\n• *status* - Check system status\n• *info* - Get app information`);
  } else {
    // Default response
    await say(`Thanks for your message. I'll process your request: "${text}"`);
  }
});

// Start the app
(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running in Socket Mode');
})();
