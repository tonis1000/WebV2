const adapters = new Map();

function normalizeType(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function registerSearchAdapter(type, adapter) {
  const key = normalizeType(type);
  if (!key) throw new Error('Search adapter type is required');
  if (!adapter || typeof adapter.search !== 'function') throw new Error(`Search adapter ${key} must expose search({ target, source, signal })`);
  if (adapters.has(key)) throw new Error(`Search adapter already registered: ${key}`);
  adapters.set(key, adapter);
  return adapter;
}

export function getSearchAdapter(type) {
  const key = normalizeType(type);
  if (!key || !adapters.has(key)) throw new Error(`Search adapter not registered: ${key || '(empty)'}`);
  return adapters.get(key);
}

export function listSearchAdapterTypes() {
  return [...adapters.keys()];
}
