/* tabs, per-scene charge sets */
const chargeUI=()=>!!VIS_BY[state.vis].uniform||state.tab==='charges';
function setTab(t,quiet){
  state.tab=t;
  $('#tabField').hidden=t!=='field';$('#tabCharges').hidden=t!=='charges';
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  if($('#params').classList.contains('closed'))togglePanel('params',true);
  if(!quiet)applyChargeUI();
  if(INS.on)placeHud();
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
function applyChargeUI(){
  const c=chargeUI();
  planeGroup.visible=c&&planeGroup.userData.show!==false;axesGroup.visible=c&&axesGroup.userData.show!==false;
  if(!c)PART.tool='orbit';
  cvs.style.cursor='';
  buildToolbar();buildParticlePanel();updateHint();
}
const SCN={};let loadedScene=null;
function switchScene(id){
  if(loadedScene===id)return;
  if(loadedScene){
    SCN[loadedScene]={list:PART.list,sel:PART.sel,mode:PART.mode,plane:PART.plane,viewN:PART.viewN.clone(),timeScale:PART.timeScale,nextId:PART.nextId};
    for(const a of PART.list)partGroup.remove(a.trail,a.mark,a.arrow,a.farrow,a.earrow,a.sprite);
  }
  const s=SCN[id]||{list:[],sel:null,mode:'setup',plane:VIS_BY[id].uniform?'perpB':id==='accel'?'zx':'xy',viewN:new THREE.Vector3(0,0,1),timeScale:1,nextId:1};
  Object.assign(PART,{list:s.list,sel:s.sel,mode:s.mode,plane:s.plane,timeScale:s.timeScale,nextId:s.nextId,drag:null,click:null});
  PART.viewN.copy(s.viewN);
  for(const a of PART.list)partGroup.add(a.trail,a.mark,a.arrow,a.farrow,a.earrow,a.sprite);
  offs.innerHTML='';offEls.clear();loadedScene=id;
}

/* viewport toolbar (top centre) */
const ICON={
  orbit:'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M4 2.5l8.5 5.2-3.7.9 2.2 4.1-1.5.8-2.2-4.1L4.6 12z"/></svg>',
  pause:'<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><rect x="4" y="3" width="2.6" height="10" rx=".6"/><rect x="9.4" y="3" width="2.6" height="10" rx=".6"/></svg>',
  play:'<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M5 3.2v9.6c0 .5.5.8.9.5l7.2-4.8c.4-.3.4-.8 0-1L5.9 2.7c-.4-.3-.9 0-.9.5z"/></svg>',
  reset:'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3"/><path d="M3.2 2.6v2.6h2.6"/></svg>',
  follow:'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="8" cy="8" r="4.2"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2"/></svg>',
  clear:'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5"/></svg>',
  eye:'<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>',
  eyeOff:'<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><path d="M2.5 13.5l11-11"/></svg>',
  x:'<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>',
  inspect:'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2L14 14"/><circle cx="7" cy="7" r="1.3" fill="currentColor"/></svg>',
  look:'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M2 5.5l6-3 6 3-6 3z"/><path d="M8 8.5v5"/><path d="M6.3 12l1.7 1.6L9.7 12"/></svg>'};
const tb=$('#toolbar');
function buildToolbar(){
  const v=VIS_BY[state.vis];let h='';
  if(v.circuit)h+=`<div class="seg"><button data-act="circuit" title="Include leads and battery (C)"><span>Circuit</span><span class="sw"><i></i></span></button></div>`;
  if(chargeUI()){
    const planes=[['xy','XY'],['yz','YZ'],['zx','ZX'],...(v.uniform?[['perpB','⊥B']]:[]),['view','View']];
    h+=`<div class="seg">
        <button data-tool="orbit" title="Select / orbit (Esc)">${ICON.orbit}</button>
        <button data-tool="pos" title="Place positive charges"><span class="dot pos">+</span></button>
        <button data-tool="neg" title="Place negative charges"><span class="dot neg">−</span></button></div>
      <div class="seg">${planes.map(([k,l])=>
        `<button data-plane="${k}" title="${k==='view'?'Use the current view as the working plane':'Look at the '+l+' plane; new charges go here'}">${l}</button>`).join('')}</div>
      <div class="seg"><button data-act="play" title="Run / pause (Space)"></button><button data-act="reset" title="Reset to initial conditions (R)">${ICON.reset}</button>
        <button data-act="follow" title="Camera follows the selected charge (F)">${ICON.follow}</button>
        <button data-act="inspect" title="Ride along with the selected charge (I)">${ICON.inspect}<span>Inspect</span></button>
        <button data-act="clear" title="Remove all charges">${ICON.clear}</button></div>`;
  }
  tb.innerHTML=h;
  tb.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
  tb.querySelectorAll('[data-plane]').forEach(b=>b.onclick=()=>setPlane(b.dataset.plane,true));
  tb.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>({circuit:toggleCircuit,play:togglePlay,reset:resetRun,
    follow:()=>{PART.follow=!PART.follow;syncToolbar()},inspect:()=>INS.on?exitInspect():enterInspect(),clear:clearParticles})[b.dataset.act]());
  syncToolbar();fitToolbar();
}
function syncToolbar(){
  const setup=PART.mode==='setup';
  tb.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('on',b.dataset.tool===PART.tool);b.classList.toggle('dis',!setup&&b.dataset.tool!=='orbit')});
  tb.querySelectorAll('[data-plane]').forEach(b=>b.classList.toggle('on',b.dataset.plane===PART.plane));
  const pb=tb.querySelector('[data-act=play]');
  if(pb){pb.innerHTML=PART.mode==='run'?ICON.pause:ICON.play;pb.classList.toggle('dis',!PART.list.length);pb.classList.toggle('accent',PART.mode!=='run'&&PART.list.length>0)}
  tb.querySelector('[data-act=reset]')?.classList.toggle('dis',setup);
  tb.querySelector('[data-act=follow]')?.classList.toggle('on',PART.follow);
  const ib=tb.querySelector('[data-act=inspect]');if(ib){ib.classList.toggle('on',INS.on);ib.classList.toggle('dis',!PART.sel&&!INS.on)}
  const cb=tb.querySelector('[data-act=circuit]');if(cb)cb.classList.toggle('on',state.display.circuit);
}
// drop the toolbar below the title when the viewport is too narrow for both on one line
function fitToolbar(){
  tb.classList.remove('low');
  const t=$('#title').getBoundingClientRect(),r=tb.getBoundingClientRect();
  tb.classList.toggle('low',r.width>0&&r.left<t.right+16);
}
function toggleCircuit(){state.display.circuit=!state.display.circuit;syncToolbar();buildParams();applyVis(false)}
new ResizeObserver(fitToolbar).observe(view);


