import { normalizeId } from './utils.js';

const CHANNEL_SOURCE_REJECTORS = Object.freeze({
  mega: [
    /s99841657/i,
    /mega%20news/i,
    /mega-news/i,
    /mega_news/i,
    /\/meganews/i,
  ],
});

export function isRejectedChannelSource(channel = {}, url = '') {
  const channelKey = normalizeId(channel?.id || channel?.originalId || channel?.name || '');
  const rules = CHANNEL_SOURCE_REJECTORS[channelKey] || [];
  return rules.some(rule => rule.test(String(url || '')));
}

export const CHANNEL_SOURCE_RULES = CHANNEL_SOURCE_REJECTORS;
