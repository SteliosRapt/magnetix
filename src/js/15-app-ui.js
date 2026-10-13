/* ---------- UI ---------- */
const chev='<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6.5l3 3 3-3"/></svg>';
function buildTree(){
  const tree=$('#tree');tree.innerHTML='';
  for(const [g,ids] of GROUPS){
    const h=document.createElement('div');h.className='grp';h.innerHTML=chev+'<span>'+g+'</span>';
    h.onclick=()=>h.classList.toggle('collapsed');
    const box=document.createElement('div');box.className='items';
    for(const id of ids){
      const it=document.createElement('div');it.className='item';it.dataset.id=id;it.textContent=VIS_BY[id].item;
      it.onclick=()=>select(id);box.appendChild(it);
    }
    tree.append(h,box);
  }
}
function markTree(){for(const el of document.querySelectorAll('.item'))el.classList.toggle('sel',el.dataset.id===state.vis)}
function setFill(inp){inp.style.setProperty('--p',((inp.value-inp.min)/(inp.max-inp.min)*100)+'%')}
function buildParams(){
  const v=VIS_BY[state.vis],p=P(),pl=$('#plist');pl.innerHTML='';
  for(const d of v.params){
    if(d.circuitOnly&&!state.display.circuit)continue;
    const row=document.createElement('div');row.className='row';
    row.innerHTML=`<div class="lab"><span title="Double-click to reset">${d.label}</span><span class="val"></span></div>`;
    const inp=document.createElement('input');Object.assign(inp,{type:'range',min:d.min,max:d.max,step:d.step,value:p[d.key]});
    const val=row.querySelector('.val');
    const sync=()=>{val.textContent=d.fmt(p[d.key]);setFill(inp)};
    const set=x=>{p[d.key]=x;inp.value=x;sync();if(d.live)return;if(d.key==='I')recolorAll();else scheduleRebuild()};
    inp.oninput=()=>set(+inp.value);
    row.querySelector('.lab span').ondblclick=()=>set(d.value);
    row.appendChild(inp);sync();pl.appendChild(row);
  }
  if(v.random){
    const b=document.createElement('button');b.className='btn';b.textContent='Randomize';b.title='Randomize (R)';
    b.onclick=randomize;pl.appendChild(b);
  }
  const dlist=$('#dlist');dlist.innerHTML='';
  const tg=(label,get,flip,on='On',off='Off')=>{
    const r=document.createElement('div');r.className='trow';
    const b=document.createElement('button');b.className='tg';
    const s=()=>{const x=get();b.textContent=x?on:off;b.classList.toggle('off',!x&&off==='Off')};
    b.onclick=()=>{flip();s()};s();
    r.innerHTML=`<span>${label}</span>`;r.appendChild(b);dlist.appendChild(r);
  };
  const D=state.display;
  tg('Arrows',()=>D.arrows,()=>{D.arrows=!D.arrows});
  if(!v.uniform){
    tg('Current flow',()=>D.flow,()=>{D.flow=!D.flow});
    tg('Line spacing',()=>D.spacing==='flux',toggleSpacing,'By flux','Even');
  }else{
    tg('Working plane',()=>planeGroup.userData.show!==false,()=>{planeGroup.userData.show=planeGroup.userData.show===false;planeGroup.visible=planeGroup.userData.show});
    tg('Axes',()=>axesGroup.userData.show!==false,()=>{axesGroup.userData.show=axesGroup.userData.show===false;axesGroup.visible=axesGroup.userData.show});
  }
  tg('Intensity scale',()=>D.scale==='log',()=>{D.scale=D.scale==='log'?'linear':'log';recolorAll()},'Log','Linear');
  tg('Auto-rotate',()=>D.rotate,()=>{D.rotate=!D.rotate});
}
function toggleSpacing(){state.display.spacing=state.display.spacing==='flux'?'even':'flux';applyVis(false)}
function randomize(){state.seed=(Math.random()*1e9)|0;applyVis(false)}
function select(id){
  if(typeof INS!=='undefined'&&INS.on)exitInspect();
  state.vis=id;markTree();
  $('#title').textContent=VIS_BY[id].title;
  switchScene(id);
  if(VIS_BY[id].uniform)setTab('charges',true);
  buildParams();applyVis(true);
  if(PART.plane==='view'){PART.n.copy(PART.viewN);updateGizmo()}else setPlane(PART.plane,false);
  applyChargeUI();
}
function togglePanel(id,force){
  const el=$('#'+id),open=force??el.classList.contains('closed');
  el.classList.toggle('closed',!open);
  $(id==='explorer'?'#actExplorer':'#actParams').classList.toggle('on',open);
  if(typeof INS!=='undefined'&&INS.on)placeHud();
}
$('#actExplorer').onclick=()=>togglePanel('explorer');
$('#actParams').onclick=()=>togglePanel('params');
$('#actReset').onclick=()=>setView();
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>togglePanel(b.dataset.close,false);
addEventListener('keydown',e=>{
  const mod=e.metaKey||e.ctrlKey;
  if(mod&&e.code==='KeyB'){e.preventDefault();togglePanel(e.altKey?'params':'explorer');return}
  if(e.target.tagName==='INPUT'||mod)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();const i=ORDER.indexOf(state.vis),n=ORDER.length;
    select(ORDER[(i+(e.key==='ArrowDown'?1:n-1))%n]);
  }
  if(e.key==='r'||e.key==='R'){if(chargeUI())resetRun();else if(VIS_BY[state.vis].random)randomize()}
  const v=VIS_BY[state.vis];
  if((e.key==='s'||e.key==='S')&&!v.uniform){toggleSpacing();buildParams()}
  if((e.key==='c'||e.key==='C')&&v.circuit)toggleCircuit();
  if(chargeUI()||PART.list.length){
    if(e.target.tagName==='BUTTON')e.target.blur();
    if(e.key===' '){e.preventDefault();togglePlay()}
    if(e.key==='Escape'){if(INS.on){exitInspect();return}setTool('orbit');selectP(null)}
    if(e.key==='i'||e.key==='I'){INS.on?exitInspect():enterInspect()}
    if(e.key==='f'||e.key==='F'){PART.follow=!PART.follow;syncToolbar()}
    if((e.key==='Backspace'||e.key==='Delete')&&PART.sel){e.preventDefault();removeParticle(PART.sel);refreshUI()}
  }
});
if(innerWidth<820){togglePanel('explorer',false);togglePanel('params',false)}

buildTree();
requestAnimationFrame(()=>{select(state.vis);frame()});
