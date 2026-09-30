function freezeLane(lane = {}) {
  return Object.freeze({ ...lane });
}

function freezeItem(item = {}) {
  return Object.freeze({ ...item });
}

function uniqueItems(items = []) {
  const out = [];
  const seen = new Set();
  for (const item of items || []) {
    const key = String(item?.candidateId || item?.leadId || item?.sourceUrl || JSON.stringify(item || {}));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export class UnifiedSearchState {
  constructor() {
    this.sequence = 0;
    this.current = this.#empty();
  }

  #empty() {
    return {
      searchId:'',
      query:'',
      intent:null,
      status:'idle',
      cancelReason:'',
      startedAt:null,
      completedAt:null,
      lanes:{},
      candidates:[],
      leads:[],
      reports:[],
    };
  }

  #isCurrent(searchId) {
    return Boolean(searchId) && searchId === this.current.searchId;
  }

  beginSearch({ query = '', intent = null } = {}) {
    const searchId = `search_${++this.sequence}`;
    this.current = {
      ...this.#empty(),
      searchId,
      query:String(query || '').trim(),
      intent:intent ? { ...intent, targets:Array.isArray(intent.targets) ? [...intent.targets] : [] } : null,
      status:'running',
      startedAt:new Date().toISOString(),
    };
    return this.snapshot();
  }

  completeSearch(searchId) {
    if (!this.#isCurrent(searchId) || this.current.status !== 'running') return false;
    this.current.status = 'completed';
    this.current.cancelReason = '';
    this.current.completedAt = new Date().toISOString();
    return true;
  }

  cancelSearch(searchId, reason = 'cancelled') {
    if (!this.#isCurrent(searchId) || this.current.status !== 'running') return false;
    this.current.status = 'cancelled';
    this.current.cancelReason = String(reason || 'cancelled');
    this.current.completedAt = new Date().toISOString();
    return true;
  }

  setLaneStatus(searchId, laneId, status, detail = '') {
    if (!this.#isCurrent(searchId)) return false;
    const key = String(laneId || '').trim();
    if (!key) return false;
    this.current.lanes = {
      ...this.current.lanes,
      [key]: { ...(this.current.lanes[key] || {}), status:String(status || ''), detail:String(detail || '') },
    };
    return true;
  }

  mergeLaneResult(searchId, laneId, result = {}) {
    if (!this.#isCurrent(searchId) || this.current.status !== 'running') return false;
    const key = String(laneId || '').trim();
    if (key) {
      this.current.lanes = {
        ...this.current.lanes,
        [key]: { ...(this.current.lanes[key] || {}), status:this.current.lanes[key]?.status || 'done' },
      };
    }
    this.current.candidates = uniqueItems([...this.current.candidates, ...(result.candidates || [])]);
    this.current.leads = uniqueItems([...this.current.leads, ...(result.leads || [])]);
    this.current.reports = [...this.current.reports, ...(result.reports || [])];
    return true;
  }

  replaceCandidate(searchId, candidate = {}) {
    if (!this.#isCurrent(searchId) || this.current.status !== 'running') return false;
    const id = String(candidate?.candidateId || '').trim();
    if (!id) return false;
    const index = this.current.candidates.findIndex(item => String(item?.candidateId || '') === id);
    if (index < 0) return false;
    this.current.candidates = [
      ...this.current.candidates.slice(0,index),
      candidate,
      ...this.current.candidates.slice(index+1),
    ];
    return true;
  }

  snapshot() {
    const lanes = {};
    for (const [key, value] of Object.entries(this.current.lanes || {})) lanes[key] = freezeLane(value);
    const intent = this.current.intent ? Object.freeze({
      ...this.current.intent,
      targets:Object.freeze((this.current.intent.targets || []).map(freezeItem)),
    }) : null;
    return Object.freeze({
      searchId:this.current.searchId,
      query:this.current.query,
      intent,
      status:this.current.status,
      cancelReason:this.current.cancelReason,
      startedAt:this.current.startedAt,
      completedAt:this.current.completedAt,
      lanes:Object.freeze(lanes),
      candidates:Object.freeze(this.current.candidates.map(freezeItem)),
      leads:Object.freeze(this.current.leads.map(freezeItem)),
      reports:Object.freeze(this.current.reports.map(freezeItem)),
    });
  }
}
