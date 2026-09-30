export class UnifiedNowPlayingState {
  constructor(){this.candidateName='';}

  value(sidebarName=''){
    return String(this.candidateName||sidebarName||'—').trim()||'—';
  }

  setCandidate(name=''){
    const value=String(name||'').trim();
    if(value)this.candidateName=value;
    return this.candidateName;
  }

  sidebarChanged(){
    this.candidateName='';
  }

  hasCandidateOverride(){return Boolean(this.candidateName);}
}
