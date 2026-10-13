/* modes */
function play(){
  if(!PART.list.length)return;
  if(PART.mode==='setup'){for(const a of PART.list){applyInit(a);resetTrail(a)}PART.ramp=1;PART.rfMax=false;PART.turns=0;PART.lastTh=0;PART.rampRate=0;PART.rfPh=0;PART.simT=0;PART.scope=[];INS.hist=[];INS.simT=0}
  PART.mode='run';PART.used=true;PART.list.forEach(syncVis);refreshUI();
}
function pauseRun(){PART.mode='pause';refreshUI()}
function togglePlay(){PART.mode==='run'?pauseRun():play()}
function resetRun(){
  PART.mode='setup';PART.ramp=1;PART.rfMax=false;PART.turns=0;PART.rampRate=0;PART.rfPh=0;PART.simT=0;PART.scope=[];if(cfg?.accel)recolorAll();
  for(const a of PART.list){a.n=0;a.trail.geometry.setDrawRange(0,0);applyInit(a)}
  refreshUI();
}
function refreshUI(){PART.list.forEach(syncVis);syncToolbar();buildParticlePanel();updateGizmo();updateHint()}
function selectP(a){PART.sel=a;if(!a&&INS.on)exitInspect();if(INS.on)INS.fresh=true;buildParticlePanel();updateGizmo();syncToolbar()}

/* working plane + gizmo */
function setPlane(key,snap){
  PART.plane=key;
  if(key==='view'){PART.viewN.copy(camera.position).sub(controls.target).normalize();PART.p0.copy(controls.target)}
  else PART.p0.set(0,0,0);
  PART.n.copy(planeNormal(key));
  if(snap&&key!=='view')flyTo(PART.n);
  updateGizmo();syncToolbar();
}
// the gizmo shows the selected charge's plane while setting up, otherwise the working plane
function updateGizmo(){
  const a=PART.sel;
  if(a&&PART.mode==='setup'){const {n}=initState(a);planeGroup.position.copy(n).multiplyScalar(a.w);planeGroup.quaternion.setFromUnitVectors(Y,n)}
  else{planeGroup.position.copy(PART.p0);planeGroup.quaternion.setFromUnitVectors(Y,PART.n)}
}
function onFieldChanged(){           // geometry, current or B changed
  if(!cfg.uniform)FIELD.load(buildSegs(cfg.phys),RW);
  cfg.I0=P().I||1;
  buildEField();
  const Bref=sceneBref();
  cfg.qm0=cfg.accel?cfg.accel.qm:niceNum(1/Bref);
  // typical |q v×B|/m in the scene → force arrows about 0.9 m long at typical strength
  cfg.aRef=cfg.accel?cfg.accel.v0**2/(.6*cfg.accel.R):2*cfg.qm0*Bref;cfg.fk=.9/cfg.aRef;
  if(PART.plane==='perpB')PART.n.copy(Bhat());
  if(PART.mode==='setup')PART.list.forEach(applyInit);
  updateGizmo();buildParticlePanel();
}
let camAnim=null;
function flyTo(n){
  const t=controls.target,off=camera.position.clone().sub(t),dist=off.length(),d0=off.normalize();
  const d1=n.clone();                                   // always view from +n so screen axes match the panel
  if(Math.abs(d1.y)>.995){d1.z+=.006;d1.normalize()}
  camAnim={d0,dist,q:new THREE.Quaternion().setFromUnitVectors(d0,d1),t0:performance.now()};
}
const _qa=new THREE.Quaternion();
function stepCamAnim(){
  if(!camAnim)return;
  const k=Math.min(1,(performance.now()-camAnim.t0)/480),e=1-Math.pow(1-k,3);
  _qa.identity().slerp(camAnim.q,e);
  camera.position.copy(controls.target).addScaledVector(camAnim.d0.clone().applyQuaternion(_qa),camAnim.dist);
  if(k>=1)camAnim=null;
}

/* pointer interaction: click selects, drag moves a charge within its plane (setup only) */
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),cvs=renderer.domElement;
function setRay(e){const r=cvs.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera)}
function hitPlane(n,p0){
  const pl=new THREE.Plane().setFromNormalAndCoplanarPoint(n,p0),out=new THREE.Vector3();
  if(Math.abs(ray.ray.direction.dot(n))>.2)return ray.ray.intersectPlane(pl,out);
  const vn=camera.getWorldDirection(new THREE.Vector3());
  if(!ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(vn,p0),out))return null;
  return pl.projectPoint(out,new THREE.Vector3());
}
function pick(e){
  const r=cvs.getBoundingClientRect();let best=null,bd=18;
  for(const a of PART.list){
    if(a.hidden)continue;
    const s=a.pos.clone().project(camera);if(s.z>1)continue;
    const d=Math.hypot((s.x+1)/2*r.width+r.left-e.clientX,(1-s.y)/2*r.height+r.top-e.clientY);
    if(d<bd){bd=d;best=a}
  }
  return best;
}
// Inspect: drag to look around the charge, double-click to return behind it
view.addEventListener('pointerdown',e=>{
  if(!INS.on||e.target!==cvs||e.button!==0)return;
  e.stopImmediatePropagation();e.preventDefault();INS.drag={x:e.clientX,y:e.clientY};cvs.style.cursor='grabbing';
},{capture:true});
addEventListener('pointermove',e=>{
  if(!INS.drag)return;
  INS.yaw-=(e.clientX-INS.drag.x)*.006;INS.pitch=Math.max(-1.45,Math.min(1.45,INS.pitch+(e.clientY-INS.drag.y)*.006));
  INS.drag={x:e.clientX,y:e.clientY};
});
addEventListener('pointerup',()=>{if(INS.drag){INS.drag=null;cvs.style.cursor=''}});
view.addEventListener('dblclick',e=>{if(INS.on&&e.target===cvs){INS.yaw=0;INS.pitch=.4}});
view.addEventListener('pointerdown',e=>{
  if(!cfg||e.target!==cvs||e.button!==0)return;
  setRay(e);const hit=pick(e),setup=PART.mode==='setup';
  if(hit){
    e.stopPropagation();e.preventDefault();if(!chargeUI())setTab('charges');selectP(hit);
    if(setup)PART.drag={a:hit,x:e.clientX,y:e.clientY,moved:false};
    return;
  }
  if(PART.tool!=='orbit'&&setup&&chargeUI()){
    const pt=hitPlane(PART.n,PART.p0);if(!pt)return;
    e.stopPropagation();e.preventDefault();
    const pl=PART.plane==='view'?{key:'view',n:PART.viewN.clone()}:{key:PART.plane},{e1,e2,n}=basisOf(planeN(pl));
    const a=makeParticle({sign:PART.tool==='pos'?1:-1,plane:pl,u:pt.dot(e1),v:pt.dot(e2),w:pt.dot(n)});
    PART.used=true;selectP(a);updateHint();
    PART.drag={a,x:e.clientX,y:e.clientY,moved:false};
    return;
  }
  PART.click={x:e.clientX,y:e.clientY};          // orbit drag, or a click on empty space (= deselect)
},{capture:true});
addEventListener('pointermove',e=>{
  if(PART.click&&Math.hypot(e.clientX-PART.click.x,e.clientY-PART.click.y)>4)PART.click=null;
  const D=PART.drag;
  if(D){
    if(Math.hypot(e.clientX-D.x,e.clientY-D.y)>4)D.moved=true;
    if(!D.moved)return;
    setRay(e);const a=D.a,{e1,e2,n}=initState(a),pt=hitPlane(n,n.clone().multiplyScalar(a.w));
    if(pt){a.u=pt.dot(e1);a.v=pt.dot(e2);applyInit(a);syncInspector()}
    return;
  }
  if(!cfg||e.target!==cvs)return;
  const h=pick(e);
  cvs.style.cursor=h?(PART.mode==='setup'?'grab':'pointer'):(PART.tool!=='orbit'&&PART.mode==='setup'&&chargeUI()?'crosshair':'');
});
addEventListener('pointerup',()=>{
  if(PART.drag){PART.drag=null}
  else if(PART.click&&PART.sel&&chargeUI()){selectP(null)}
  PART.click=null;
});
function updateHint(){
  const h=$('#hint');
  h.textContent=PART.mode==='setup'?'Pick + or − and click the plane to place a charge · select it to set its velocity in the panel · Space runs':'';
  h.classList.toggle('on',!!cfg&&chargeUI()&&!PART.used&&!PART.list.length);
}
function setTool(t){PART.tool=t;cvs.style.cursor=t!=='orbit'&&PART.mode==='setup'?'crosshair':'';syncToolbar()}

/* off-screen indicators + follow camera */
const offs=$('#offs'),offEls=new Map(),_s3=new THREE.Vector3();let statTick=0,lastRamp=1;
function updateUniformOverlay(dt){
  if(!cfg)return;
  const W=view.clientWidth,H=view.clientHeight;
  for(const a of PART.list){
    let el=offEls.get(a.id);
    if(!el){el=document.createElement('div');el.className='offi';offs.appendChild(el);offEls.set(a.id,el)}
    _s3.copy(a.pos).project(camera);
    const behind=_s3.z>1;let x=_s3.x,y=_s3.y;if(behind){x=-x;y=-y}
    const inside=!behind&&Math.abs(x)<.98&&Math.abs(y)<.97;
    if(a.hidden||inside){el.style.display='none';continue}
    const k=Math.min(.93/Math.max(Math.abs(x),1e-6),.9/Math.max(Math.abs(y),1e-6));
    el.style.display='block';el.style.setProperty('--c',colOf(a));
    el.style.transform=`translate(${(x*k+1)/2*W}px,${(1-y*k)/2*H}px) rotate(${Math.atan2(-y,x)}rad)`;
    el.classList.toggle('sel',a===PART.sel);
  }
  // markers keep a constant on-screen size however far you zoom (pixels → world units)
  const ort=camera.isOrthographicCamera,kp=2*Math.tan(camera.fov*Math.PI/360)/Math.max(1,H);
  const wppAt=p=>ort?2*orthoH/ortho.zoom/Math.max(1,H):camera.position.distanceTo(p)*kp;
  for(const a of PART.list){a.sprite.scale.setScalar(30*wppAt(a.pos));a.mark.scale.setScalar(15*wppAt(a.mark.position))}
  if(PART.sel)selRing.scale.setScalar(54*wppAt(PART.sel.pos));
  const s=PART.sel;
  selRing.visible=!!s&&!s.hidden;if(s)selRing.position.copy(s.pos);
  updateForces();
  if(PART.mode==='run'&&statTick%10===0)PART.list.forEach(updateRow);
  if(cfg.accel&&++statTick%10===0){
    const st=$('#simstat');
    if(st){const sp=PART.list[0]?.vel.length()||0;
      const A=cfg.accel,E0=rfField(),rr=PART.rampRate||0,emf=-EF.circ*rr,rfV=E0*A.cav.L;
      st.innerHTML=`Turn <b>${PART.turns}</b> · q1 speed <b>${sp.toFixed(2)} m/s</b> · magnets <b>${Math.round(PART.ramp*P().dip)} %</b>`+
        `<br>Dipole field <b>${fmtB(A.Bd*(PART.ramp||1))}</b> · dB/dt <b>${fmtB(Math.abs(A.Bd*rr))}/s</b>`+
        (E0?`<br>RF field <b>${(Math.cos(PART.rfPh||0)>=0?'forward':'backward')}</b> · ${(Math.abs(Math.cos(PART.rfPh||0))*100).toFixed(0)} % of peak`:'')+
        (E0&&Math.abs(rr)>1e-9?`<br>Induced EMF per turn: <b>${(emf/rfV*100).toFixed(2)} %</b> of the RF kick`:'')+
        (PART.rfMax?'<br>Magnets at maximum field: RF switched off.':'')}
    drawScope();
    if(Math.abs((PART.ramp||1)-lastRamp)>.03){lastRamp=PART.ramp||1;recolorAll()}
  }
  if(PART.follow&&s&&!camAnim&&!INS.on){
    const d=s.pos.clone().sub(controls.target),k=PART.mode==='run'?Math.min(1,dt*20):Math.min(1,dt*6);   // tight while running so fast charges stay centred
    controls.target.addScaledVector(d,k);camera.position.addScaledVector(d,k);
  }
}

