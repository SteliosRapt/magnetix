/* side panel → Charges tab: simulation controls, charge list, inspector, presets */
const pp=$('#ppanel');
const fmt2=v=>(Math.abs(v)<.005?0:v).toFixed(2);
const SUP={'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
function fmtSci(x,unit){
  if(x>=.01&&x<1000)return x.toPrecision(2)+' '+unit;
  const e=Math.floor(Math.log10(x)),m=x/10**e;
  return `${m.toFixed(1)}×10${String(e).replace(/./g,c=>SUP[c])} ${unit}`;
}
function fmtB(b){return b>=.1?b.toFixed(2)+' T':b>=1e-4?(b*1e3).toFixed(2)+' mT':(b*1e6).toFixed(2)+' µT'}
const chargeMeta=p=>p.lost?'lost: hit the beam pipe':`${fmtSci(p.qm,'C/kg')} · ${(PART.mode==='setup'?p.s:p.vel.length()).toFixed(2)} m/s`;
function buildParticlePanel(){
  const badge=document.querySelector('[data-tab=charges] .badge');
  if(badge){badge.textContent=PART.list.length||'';badge.hidden=!PART.list.length}
  if(state.tab!=='charges'||!cfg){return}
  const v=VIS_BY[state.vis],setup=PART.mode==='setup',a=PART.sel;
  const status=setup?(PART.list.length?'Setup — edit the charges, then run.':'Setup — add charges to start.')
    :PART.mode==='run'?'Running.':'Paused.';
  const PRE=PRESETS[state.vis]||[];
  let h=PRE.length?`<div class="sec">Presets</div><div class="plist"><div class="pgrid">${PRE.map(r=>`<button class="btn" data-preset="${r.k}" title="${r.title||''}">${r.label}</button>`).join('')}</div></div>`:'';
  h+=`<div class="sec">Simulation</div><div class="plist">
      <div class="simrow">
        <button class="btn" data-sim="play" ${PART.list.length?'':'disabled'}>${PART.mode==='run'?ICON.pause+'<span>Pause</span>':ICON.play+`<span>${PART.mode==='pause'?'Resume':'Run'}</span>`}</button>
        <button class="btn" data-sim="reset" ${setup?'disabled':''}>${ICON.reset}<span>Reset</span></button></div>
      <div id="simspeed"></div>
      <div class="trow"><span class="fk"><i></i>Force arrows</span><button class="tg${PART.showForce?'':' off'}" data-force>${PART.showForce?'On':'Off'}</button></div>
      ${cfg.accel?`<div class="trow"><span class="fk fe"><i></i>Electric field</span><button class="tg${PART.showE?'':' off'}" data-efield>${PART.showE?'On':'Off'}</button></div>`:''}
      <div class="note">${status} ${v.uniform?'':'Charges move in the Biot–Savart field of this conductor; they don\'t act on it or on each other.'} Yellow arrows show the magnetic force q v × B${cfg.accel?', green the electric force qE (pale green, drawn ×1000, when only the weak induced field acts). The magnetic force only steers; every bit of speed comes from E: the RF cavity\'s oscillating field (bright green arrows in the gap) and, while the magnets ramp, the weak field they induce, E = −∂A/∂t (pale green arrows curling around each magnet)':''}.</div>
      ${cfg.accel?`<div class="simstat" id="simstat"></div><canvas id="accscope"></canvas>
        <div class="sclg"><span><i style="background:#4fc1ff"></i>dipole field B</span><span><i style="background:${E_COL}"></i>RF field in the cavity (+ forward)</span></div>`:''}</div>
    <div class="sec sech"><span>Charges</span><span class="sbtn">
      <button data-add="1" title="Add a positive charge on the working plane" ${setup?'':'disabled'}><span class="dot pos">+</span></button>
      <button data-add="-1" title="Add a negative charge on the working plane" ${setup?'':'disabled'}><span class="dot neg">−</span></button></span></div>
    <div class="plist"><div class="clist">`;
  if(!PART.list.length)h+=`<div class="empty">No charges yet. Use + / − here or in the toolbar${v.uniform?', or a preset':''}.</div>`;
  for(const p of PART.list)h+=`<div class="crow${p===a?' sel':''}${p.hidden?' hid':''}" data-id="${p.id}">
      <span class="dot ${p.sign>0?'pos':'neg'}">${p.sign>0?'+':'−'}</span><span class="cname">q${p.id}</span>
      <span class="cmeta">${chargeMeta(p)}</span>
      <button class="ib" data-eye title="${p.hidden?'Show':'Hide'}">${p.hidden?ICON.eyeOff:ICON.eye}</button>
      <button class="ib" data-del title="Delete">${ICON.x}</button></div>`;
  h+=`</div></div>`;
  if(a)h+=`<div class="sec">q${a.id} · ${setup?'initial conditions':'running'}</div><div class="plist" id="insp"></div>`;
  pp.innerHTML=h;
  // simulation speed slider
  { const box=$('#simspeed'),row=document.createElement('div');row.className='row';
    row.innerHTML=`<div class="lab"><span>Simulation speed</span><span class="val"></span></div>`;
    const inp=document.createElement('input');Object.assign(inp,{type:'range',min:.1,max:10,step:.1,value:PART.timeScale});
    const sync=()=>{row.querySelector('.val').textContent=PART.timeScale.toFixed(1)+'×';setFill(inp)};
    inp.oninput=()=>{PART.timeScale=+inp.value;sync()};row.appendChild(inp);box.appendChild(row);sync(); }
  pp.querySelector('[data-sim=play]').onclick=togglePlay;
  pp.querySelector('[data-force]').onclick=()=>{PART.showForce=!PART.showForce;buildParticlePanel()};
  pp.querySelector('[data-efield]')?.addEventListener('click',()=>{PART.showE=!PART.showE;buildParticlePanel()});
  pp.querySelector('[data-sim=reset]').onclick=resetRun;
  pp.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{
    const pl=PART.plane==='view'?{key:'view',n:PART.viewN.clone()}:{key:PART.plane},{e1,e2,n}=basisOf(planeN(pl));
    const p0=PART.p0,o=makeParticle({sign:+b.dataset.add,plane:pl,u:p0.dot(e1),v:p0.dot(e2),w:p0.dot(n)});
    PART.used=true;updateHint();selectP(o);syncToolbar();
  });
  pp.querySelectorAll('.crow').forEach(r=>{
    const p=PART.list.find(q=>q.id===+r.dataset.id);
    r.onclick=e=>{if(e.target.closest('[data-eye],[data-del]'))return;selectP(p===PART.sel?null:p)};
    r.querySelector('[data-eye]').onclick=()=>{p.hidden=!p.hidden;syncVis(p);buildParticlePanel()};
    r.querySelector('[data-del]').onclick=()=>{removeParticle(p);refreshUI()};
  });
  pp.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>runPreset(PRE.find(r=>r.k===b.dataset.preset)));
  if(a)buildInspector(a,setup);
}
let insp=null;     // live handles into the inspector, for cheap updates while dragging
const _Bi=new THREE.Vector3();
function buildInspector(a,setup){
  const box=$('#insp'),{e1,e2,n,p:p0}=initState(a),uni=!!cfg.uniform;
  const L1=axisLabel(e1,'u'),L2=axisLabel(e2,'v'),LN=axisLabel(n,'n');
  const dis=setup?'':'disabled',E=Math.max(6,cfg.H*1.2);
  const keys=['xy','yz','zx',...(uni?['perpB']:[]),'view'];
  box.innerHTML=`
    <div class="trow"><span>Sign</span><span class="mseg">
      <button data-sign="1" class="${a.sign>0?'on':''}" ${dis}>+</button><button data-sign="-1" class="${a.sign<0?'on':''}" ${dis}>−</button></span></div>
    <div class="trow"><span>Plane</span><span class="mseg">${keys.map(k=>
      `<button data-pl="${k}" class="${a.plane.key===k?'on':''}" ${dis} title="${k==='view'?'The plane facing you right now':'Velocity and drag stay in '+PLANE_NAME[k]}">${PLANE_NAME[k]}</button>`).join('')}</span>
      <button class="ib" data-look title="Look at this plane">${ICON.look}</button></div>
    <div class="padwrap"><svg class="pad" viewBox="0 0 176 176" width="176" height="176"></svg></div>
    <div id="islid"></div>
    <div class="rgrid" id="ro"></div>
    ${setup?'':'<div class="note">Reset (R) to edit the initial conditions.</div>'}
    ${setup?`<button class="btn danger" data-delsel>Delete q${a.id}</button>`:''}`;
  box.querySelectorAll('[data-sign]').forEach(b=>b.onclick=()=>{setSign(a,+b.dataset.sign);applyInit(a);buildParticlePanel()});
  box.querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>{
    const p=initState(a).p,pl=b.dataset.pl==='view'?{key:'view',n:camera.position.clone().sub(controls.target).normalize()}:{key:b.dataset.pl};
    const B=basisOf(planeN(pl));a.plane=pl;a.u=p.dot(B.e1);a.v=p.dot(B.e2);a.w=p.dot(B.n);   // keep the charge where it is
    applyInit(a);buildParticlePanel();updateGizmo();
  });
  box.querySelector('[data-look]').onclick=()=>flyTo(initState(a).n);
  box.querySelector('[data-delsel]')?.addEventListener('click',()=>{removeParticle(a);refreshUI()});
  // sliders
  const sl=$('#islid'),rows={};
  const add=(key,label,min,max,step,get,set,fmt)=>{
    const row=document.createElement('div');row.className='row';
    row.innerHTML=`<div class="lab"><span>${label}</span><span class="val"></span></div>`;
    const inp=document.createElement('input');Object.assign(inp,{type:'range',min,max,step,value:get(),disabled:!setup});
    const val=row.querySelector('.val');
    const sync=()=>{inp.value=get();val.textContent=fmt(get());setFill(inp)};
    inp.oninput=()=>{set(+inp.value);applyInit(a);syncInspector();updateRow(a)};
    row.appendChild(inp);sl.appendChild(row);rows[key]=sync;sync();
  };
  add('s','Speed',0,VMAX,.05,()=>a.s,v=>a.s=v,v=>v.toFixed(2)+' m/s');
  add('th','Direction',-180,180,1,()=>Math.round(a.th*180/Math.PI),v=>a.th=v*Math.PI/180,v=>`${Math.round(v)}° from ${L1}`);
  // charge-to-mass ratio (the only particle property the motion depends on), log scale around the
  // value that makes the cyclotron rate ≈ 1 rad/s in this scene's typical field
  const q0=cfg.qm0,lo=Math.log10(Math.min(q0/30,a.qm)),hi=Math.log10(Math.max(q0*30,a.qm));
  add('qm','Charge / mass  |q|/m',lo,hi,.01,()=>Math.log10(a.qm),v=>{const x=10**v,e=10**Math.floor(Math.log10(x));a.qm=Math.round(x/e*10)/10*e},v=>fmtSci(10**v,'C/kg'));
  add('u','Position along '+L1,-E,E,.05,()=>a.u,v=>a.u=v,v=>fmt2(v)+' m');
  add('v','Position along '+L2,-E,E,.05,()=>a.v,v=>a.v=v,v=>fmt2(v)+' m');
  add('w','Plane offset '+LN,-E,E,.05,()=>a.w,v=>{a.w=v;updateGizmo()},v=>fmt2(v)+' m');
  // velocity pad: the disc IS the charge's plane, seen from +n (same orientation as "look at plane")
  const svg=box.querySelector('.pad'),C=88,R=74,k=R/VMAX,NS='http://www.w3.org/2000/svg';
  const mk=(t,at)=>{const el=document.createElementNS(NS,t);for(const q in at)el.setAttribute(q,at[q]);svg.appendChild(el);return el};
  for(let s=1;s<=VMAX;s++)mk('circle',{cx:C,cy:C,r:s*k,class:s===VMAX?'pring outer':'pring'});
  mk('line',{x1:C-R,y1:C,x2:C+R,y2:C,class:'pax'});mk('line',{x1:C,y1:C-R,x2:C,y2:C+R,class:'pax'});
  mk('text',{x:C+R-2,y:C-5,class:'plab','text-anchor':'end'}).textContent=L1;
  mk('text',{x:C+5,y:C-R+10,class:'plab'}).textContent=L2;
  // direction of B at the charge's starting point, relative to this plane
  const b=Bat(p0,_Bi).clone();const bl=b.length();if(bl>0)b.multiplyScalar(1/bl);
  const bn=b.dot(n),b1=b.dot(e1),b2=b.dot(e2),bp=Math.hypot(b1,b2),tag=uni?'B':'B here';
  if(bl>0&&bp>.05){const L=R*.92*bp;mk('line',{x1:C,y1:C,x2:C+b1/bp*L,y2:C-b2/bp*L,class:'pb'});
    mk('text',{x:C+b1/bp*(L+9),y:C-b2/bp*(L+9)+4,class:'pblab','text-anchor':'middle'}).textContent='B'}
  if(bl>0&&Math.abs(bn)>.05){const gx=C+R-6,gy=C+R-6;mk('circle',{cx:gx,cy:gy,r:7,class:'pbsym'});
    if(bn>0)mk('circle',{cx:gx,cy:gy,r:1.8,class:'pbdot'});
    else{mk('line',{x1:gx-4,y1:gy-4,x2:gx+4,y2:gy+4,class:'pbx'});mk('line',{x1:gx+4,y1:gy-4,x2:gx-4,y2:gy+4,class:'pbx'})}
    mk('text',{x:gx-12,y:gy+4,class:'pblab','text-anchor':'end'}).textContent=bn>0?tag+' out':tag+' in'}
  const hl=mk('line',{x1:C,y1:C,class:'pv'}),hd=mk('circle',{r:6.5,class:'ph'});
  hl.style.stroke=colOf(a);hd.style.fill=colOf(a);
  const drawPad=()=>{const x=C+a.s*k*Math.cos(a.th),y=C-a.s*k*Math.sin(a.th);hl.setAttribute('x2',x);hl.setAttribute('y2',y);hd.setAttribute('cx',x);hd.setAttribute('cy',y)};
  if(setup){
    svg.classList.add('live');
    const fromEvt=e=>{
      const r=svg.getBoundingClientRect(),x=(e.clientX-r.left)*176/r.width-C,y=C-(e.clientY-r.top)*176/r.height;
      let s=Math.min(VMAX,Math.hypot(x,y)/k),th=Math.atan2(y,x);
      if(e.shiftKey){th=Math.round(th/(Math.PI/12))*Math.PI/12;s=Math.round(s*4)/4}   // shift: 15° and 0.25 m/s steps
      a.s=Math.round(s*20)/20;a.th=th;applyInit(a);syncInspector();updateRow(a);
    };
    svg.onpointerdown=e=>{svg.setPointerCapture(e.pointerId);fromEvt(e);svg.onpointermove=fromEvt};
    svg.onpointerup=svg.onpointercancel=()=>{svg.onpointermove=null};
  }
  insp={a,rows,drawPad,ro:$('#ro')};
  syncInspector();
}
function syncInspector(){
  if(!insp||insp.a!==PART.sel||!document.body.contains(insp.ro))return;
  const a=insp.a;for(const k in insp.rows)insp.rows[k]();insp.drawPad();
  const setup=PART.mode==='setup',st=initState(a),pos=setup?st.p:a.pos,v=setup?st.v:a.vel;
  const B=Bat(pos,_Bi),Bm=B.length(),b=Bm>0?B.clone().multiplyScalar(1/Bm):Y.clone();
  const vpar=v.dot(b),vperp=v.clone().addScaledVector(b,-vpar).length(),w=a.qm*Bm,T=w>0?2*Math.PI/w:Infinity,loc=cfg.uniform?'':' (local)';
  insp.ro.innerHTML=[['|B|'+(setup?' at start':' here'),fmtB(Bm)],['force / mass',(a.qm*vperp*Bm).toFixed(2)+' m/s²'],['v⊥',vperp.toFixed(2)+' m/s'],['v∥',vpar.toFixed(2)+' m/s'],
    ['radius r'+loc,vperp>.005&&w>0?(vperp/w).toFixed(2)+' m':'—'],['period T'+loc,isFinite(T)?T.toFixed(2)+' s':'—'],
    ['pitch'+loc,Math.abs(vpar)>.005&&vperp>.005&&isFinite(T)?Math.abs(vpar*T).toFixed(2)+' m':'—'],['sense (from +B)',a.sign>0?'clockwise':'anticlockwise']]
    .map(([l,v])=>`<span>${l}</span><b>${v}</b>`).join('');
}
function updateRow(a){
  const r=pp.querySelector(`.crow[data-id="${a.id}"] .cmeta`);
  if(r)r.textContent=chargeMeta(a);
}

