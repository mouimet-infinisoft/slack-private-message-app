// Basic Slack event interface
export interface SlackEvent {
  type: string;
  user?: string;
  channel?: string;
  text?: string;
  thread_ts?: string;
  ts?: string;
  bot_id?: string;
  subtype?: string;
  team?: string;
  event_ts?: string;
  channel_type?: string;
}

// Slack message event
export interface SlackMessageEvent extends SlackEvent {
  type: 'message';
  user: string;
  channel: string;
  text: string;
  ts: string;
  thread_ts?: string;
  team: string;
  event_ts: string;
  channel_type: string;
}

// Slack app_mention event
export interface SlackAppMentionEvent extends SlackEvent {
  type: 'app_mention';
  user: string;
  channel: string;
  text: string;
  ts: string;
  thread_ts?: string;
  team: string;
  event_ts: string;
}

// Slack reaction_added event
export interface SlackReactionAddedEvent extends SlackEvent {
  type: 'reaction_added';
  user: string;
  reaction: string;
  item: {
    type: string;
    channel: string;
    ts: string;
  };
  event_ts: string;
}

// Slack app_home_opened event
export interface SlackAppHomeOpenedEvent extends SlackEvent {
  type: 'app_home_opened';
  user: string;
  channel: string;
  tab: 'home' | 'messages';
  event_ts: string;
}

// Slack channel info response
export interface SlackChannelInfo {
  channel?: {
    id: string;
    name: string;
    is_channel: boolean;
    is_group: boolean;
    is_im: boolean;
    is_private: boolean;
    is_mpim: boolean;
  };
}

// Slack event payload
export interface SlackEventPayload {
  token: string;
  team_id: string;
  api_app_id: string;
  event: SlackEvent;
  type: string;
  event_id: string;
  event_time: number;
  authorizations: Array<{
    enterprise_id: string | null;
    team_id: string;
    user_id: string;
    is_bot: boolean;
  }>;
  is_ext_shared_channel: boolean;
  challenge?: string;
}

// Slack URL verification payload
export interface SlackUrlVerificationPayload {
  token: string;
  challenge: string;
  type: 'url_verification';
}

// Error with message interface
export interface ErrorWithMessage {
  message: string;
  stack?: string;
}
