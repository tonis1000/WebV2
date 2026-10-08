const diagnostics=document.getElementById('diagnostics');
const toggle=document.getElementById('diagnostics-toggle');

if(diagnostics&&toggle){
  document.addEventListener('pointerdown',event=>{
    if(diagnostics.hidden)return;
    const target=event.target;
    if(!(target instanceof Node))return;
    if(diagnostics.contains(target)||toggle.contains(target))return;
    diagnostics.hidden=true;
    toggle.setAttribute('aria-expanded','false');
  });

  toggle.addEventListener('click',()=>{
    requestAnimationFrame(()=>toggle.setAttribute('aria-expanded',String(!diagnostics.hidden)));
  });

  console.info('[WebTV] Diagnostics overlay outside-click close enabled');
}
