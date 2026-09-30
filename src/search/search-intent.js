import { normalizeChannelText, resolveGreekIdentity } from '../core/channel-identity-gr.js';

function exactChannelMatch(query, channels = []) {
  const normalized = normalizeChannelText(query);
  const identity = resolveGreekIdentity(query);
  if (!normalized) return null;

  for (const channel of channels || []) {
    const id = String(channel?.id || '').trim();
    const name = String(channel?.name || '').trim();
    if (!id && !name) continue;

    if (identity) {
      const channelIdentity = resolveGreekIdentity(id) || resolveGreekIdentity(name);
      if (channelIdentity?.id === identity.id || normalizeChannelText(id) === normalizeChannelText(identity.id)) {
        return { ...channel };
      }
    }

    if (normalizeChannelText(id) === normalized || normalizeChannelText(name) === normalized) {
      return { ...channel };
    }
  }
  return null;
}

function exactGroupMatch(query, groups = []) {
  const normalized = normalizeChannelText(query);
  if (!normalized) return null;
  return (groups || []).find(group => {
    const names = [group?.id, group?.label, ...(Array.isArray(group?.aliases) ? group.aliases : [])];
    return names.some(value => normalizeChannelText(value) === normalized);
  }) || null;
}

function groupTargets(group, channels = []) {
  const members = new Set((Array.isArray(group?.members) ? group.members : []).map(value => normalizeChannelText(value)));
  return (channels || [])
    .filter(channel => members.has(normalizeChannelText(channel?.id || '')))
    .map(channel => ({ ...channel }));
}

export function resolveSearchIntent(query = '', context = {}) {
  const originalQuery = String(query || '').trim();
  if (!originalQuery) return Object.freeze({ type:'free-text', query:'', targets:Object.freeze([]) });

  const channels = Array.isArray(context?.channels) ? context.channels : [];
  const groups = Array.isArray(context?.groups) ? context.groups : [];

  const channel = exactChannelMatch(originalQuery, channels);
  if (channel) {
    return Object.freeze({ type:'channel', query:originalQuery, targets:Object.freeze([Object.freeze(channel)]) });
  }

  const group = exactGroupMatch(originalQuery, groups);
  if (group) {
    const type = group.type === 'subgroup' ? 'subgroup' : 'group';
    const targets = groupTargets(group, channels).map(item => Object.freeze(item));
    return Object.freeze({ type, query:originalQuery, targets:Object.freeze(targets) });
  }

  return Object.freeze({ type:'free-text', query:originalQuery, targets:Object.freeze([]) });
}
