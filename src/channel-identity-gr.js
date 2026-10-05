import {
  CHANNEL_IDENTITY_SCHEMA_VERSION,
  normalizeChannelText,
  validateGreekChannelIdentityDefinition,
  resolveGreekIdentity,
  channelMatchScore,
  channelSignalsMatch,
  createChannelSignalsMatcher,
  canonicalGreekChannelName,
  greekChannelAliases,
  greekChannelOfficialRefs,
  makeSyntheticChannel,
  listGreekChannelIdentities,
} from './core/channel-identity-gr.js';

export {
  CHANNEL_IDENTITY_SCHEMA_VERSION,
  normalizeChannelText,
  validateGreekChannelIdentityDefinition,
  resolveGreekIdentity,
  channelMatchScore,
  channelSignalsMatch,
  createChannelSignalsMatcher,
  canonicalGreekChannelName,
  greekChannelAliases,
  greekChannelOfficialRefs,
  makeSyntheticChannel,
  listGreekChannelIdentities,
};

if(typeof window!=='undefined'){
  window.WebTVGreekChannelIdentity={
    CHANNEL_IDENTITY_SCHEMA_VERSION,
    normalizeChannelText,
    validateGreekChannelIdentityDefinition,
    resolveGreekIdentity,
    channelMatchScore,
    channelSignalsMatch,
    createChannelSignalsMatcher,
    canonicalGreekChannelName,
    greekChannelAliases,
    greekChannelOfficialRefs,
    makeSyntheticChannel,
    listGreekChannelIdentities,
  };
}
