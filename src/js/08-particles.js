/* ---------- uniform field: charged particles ----------
   Workflow: SETUP (place charges, set each one's plane, position and velocity from the side
   panel) → RUN → RESET back to the same initial conditions.
   Each charge's initial state is stored in coordinates of its own plane (u, v along the
   plane's axes, w = offset along the normal; speed s and direction θ within the plane),
   so its velocity is guaranteed to lie in that plane.
   Motion: F = q v × B. In a uniform B the velocity rotates about B at ω = qB/m; each sub-step
   rotates v exactly and advances x by the mean velocity, so circles and helices close. */
const PART={list:[],sel:null,tool:'orbit',plane:'perpB',viewN:new THREE.Vector3(0,1,0),
  n:new THREE.Vector3(0,1,0),p0:new THREE.Vector3(),mode:'setup',follow:false,timeScale:1,showForce:true,showE:true,ramp:1,rampRate:0,rfPh:0,rfW:0,simT:0,scope:[],rfMax:false,turns:0,lastTh:0,drag:null,click:null,used:false,nextId:1};
const partGroup=new THREE.Group(),planeGroup=new THREE.Group(),axesGroup=new THREE.Group();
scene.add(planeGroup,axesGroup,partGroup);
const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
const COL_POS='#f48771',COL_NEG='#c586c0',COL_F='#dcdcaa',VMAX=6;

{ // plane gizmo (built lying in XZ, normal +y, then rotated onto the plane normal)
  const S=12;
  const grid=new THREE.GridHelper(S,24,0x3794ff,0x3794ff);
  grid.material.transparent=true;grid.material.opacity=.13;grid.material.depthWrite=false;
  const fill=new THREE.Mesh(new THREE.PlaneGeometry(S,S),new THREE.MeshBasicMaterial({color:0x007acc,transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false}));
  fill.rotation.x=-Math.PI/2;
  const edge=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>new THREE.Vector3(a*S/2,0,b*S/2))),
    new THREE.LineBasicMaterial({color:0x3794ff,transparent:true,opacity:.5}));
  planeGroup.add(fill,grid,edge);
}
function textSprite(txt,color,px=64){
  const c=document.createElement('canvas');c.width=c.height=px;const g=c.getContext('2d');
  g.font=`500 ${px*.6}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif`;
  g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.fillText(txt,px/2,px/2+2);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));
}
{ // axes triad at the origin
  for(const [v,c,l] of [[X,'#f48771','x'],[Y,'#89d185','y'],[Z,'#4fc1ff','z']]){
    const a=new THREE.ArrowHelper(v,new THREE.Vector3(),1.3,new THREE.Color(c),.24,.12);
    a.line.material.transparent=true;a.line.material.opacity=.95;
    for(const m of [a.line,a.cone]){m.material.depthTest=false;m.renderOrder=11}axesGroup.add(a);
    const s=textSprite(l,c,96);s.material.depthTest=false;s.renderOrder=11;s.scale.setScalar(.42);s.position.copy(v).multiplyScalar(1.6);axesGroup.add(s);
  }
}
function chargeTexture(q){
  const S=128,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');
  const col=q>0?COL_POS:COL_NEG,grd=g.createRadialGradient(S/2,S/2,S*.2,S/2,S/2,S*.5);
  grd.addColorStop(0,col+'88');grd.addColorStop(1,col+'00');g.fillStyle=grd;g.fillRect(0,0,S,S);
  g.beginPath();g.arc(S/2,S/2,S*.3,0,Math.PI*2);g.fillStyle=col;g.fill();
  g.lineWidth=S*.03;g.strokeStyle='rgba(255,255,255,.75)';g.stroke();
  g.strokeStyle='#fff';g.lineWidth=S*.065;g.lineCap='round';g.beginPath();
  g.moveTo(S*.38,S/2);g.lineTo(S*.62,S/2);if(q>0){g.moveTo(S/2,S*.38);g.lineTo(S/2,S*.62)}g.stroke();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function ringTexture(w){
  const S=128,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');
  g.beginPath();g.arc(S/2,S/2,S*.42,0,Math.PI*2);g.lineWidth=S*w;g.strokeStyle='#fff';g.stroke();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const TEX={pos:chargeTexture(1),neg:chargeTexture(-1),ring:ringTexture(.045),mark:ringTexture(.09)};
const selRing=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.ring,depthTest:false,depthWrite:false,transparent:true}));selRing.renderOrder=12;selRing.visible=false;partGroup.add(selRing);
const MAXT=2400;
const colOf=a=>a.sign>0?COL_POS:COL_NEG;

/* plane geometry */
const Bhat=()=>new THREE.Vector3(...(cfg?.uniform?.dir||[0,1,0])).normalize();
function planeNormal(key){return {xy:Z,yz:X,zx:Y,perpB:Bhat(),view:PART.viewN}[key].clone()}
const planeN=pl=>pl.key==='view'?pl.n.clone():planeNormal(pl.key);
// in-plane axes as seen when looking at the plane from +n with the usual "up" (matches flyTo)
function basisOf(n){
  const up0=Math.abs(n.y)<.995?Y:new THREE.Vector3(0,0,-1);
  const e1=new THREE.Vector3().crossVectors(up0,n).normalize(),e2=new THREE.Vector3().crossVectors(n,e1);
  return {e1,e2,n};
}
function axisLabel(v,fallback){
  for(const [ax,l] of [[X,'x'],[Y,'y'],[Z,'z']]){const d=v.dot(ax);if(Math.abs(d)>.999)return (d>0?'+':'−')+l}
  return fallback;
}
const PLANE_NAME={xy:'XY',yz:'YZ',zx:'ZX',perpB:'⊥B',view:'View'};

/* particles */
function makeParticle(o){
  const a={id:PART.nextId++,sign:1,qm:cfg?.qm0||1,plane:{key:PART.plane==='perpB'?'perpB':'xy'},u:0,v:0,w:0,s:0,th:0,hidden:false,...o,
    pos:new THREE.Vector3(),vel:new THREE.Vector3(),n:0,gone:false};
  a.sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:a.sign>0?TEX.pos:TEX.neg,depthTest:false,depthWrite:false,transparent:true}));a.sprite.renderOrder=10;
  a.arr=new Float32Array(MAXT*3);a.carr=new Float32Array(MAXT*3);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(a.arr,3).setUsage(THREE.DynamicDrawUsage));g.setDrawRange(0,0);
  g.setAttribute('color',new THREE.BufferAttribute(a.carr,3).setUsage(THREE.DynamicDrawUsage));
  a.trail=new THREE.Line(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.85,depthWrite:false}));
  a.trail.frustumCulled=false;a.trail.renderOrder=9;
  a.mark=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.mark,color:colOf(a),transparent:true,opacity:.55,depthTest:false,depthWrite:false}));a.mark.renderOrder=8;
  a.arrow=new THREE.ArrowHelper(X,new THREE.Vector3(),1,new THREE.Color(colOf(a)),.25,.13);
  a.arrow.line.material.depthTest=false;a.arrow.cone.material.depthTest=false;a.arrow.renderOrder=11;
  a.farrow=new THREE.ArrowHelper(X,new THREE.Vector3(),1,new THREE.Color(COL_F),.2,.1);a.farrow.visible=false;
  a.farrow.line.material.depthTest=false;a.farrow.cone.material.depthTest=false;a.farrow.renderOrder=11;
  a.earrow=new THREE.ArrowHelper(X,new THREE.Vector3(),1,new THREE.Color('#89d185'),.2,.1);a.earrow.visible=false;
  a.earrow.line.material.depthTest=false;a.earrow.cone.material.depthTest=false;a.earrow.renderOrder=11;
  partGroup.add(a.trail,a.mark,a.arrow,a.farrow,a.earrow,a.sprite);
  PART.list.push(a);applyInit(a);syncVis(a);
  return a;
}
function setSign(a,s){
  a.sign=s;a.sprite.material.map=s>0?TEX.pos:TEX.neg;a.sprite.material.needsUpdate=true;
  a.mark.material.color.set(colOf(a));a.arrow.setColor(colOf(a));
}
function removeParticle(a){
  partGroup.remove(a.sprite,a.trail,a.mark,a.arrow,a.farrow,a.earrow);a.trail.geometry.dispose();a.sprite.material.dispose();a.mark.material.dispose();
  PART.list.splice(PART.list.indexOf(a),1);
  if(PART.sel===a)PART.sel=null;
  offEls.get(a.id)?.remove();offEls.delete(a.id);
}
function clearParticles(){for(const a of [...PART.list])removeParticle(a);PART.mode='setup';refreshUI()}
function initState(a){
  const {e1,e2,n}=basisOf(planeN(a.plane));
  const p=e1.clone().multiplyScalar(a.u).addScaledVector(e2,a.v).addScaledVector(n,a.w);
  const v=e1.clone().multiplyScalar(a.s*Math.cos(a.th)).addScaledVector(e2,a.s*Math.sin(a.th));
  return {p,v,e1,e2,n};
}
function applyInit(a){                       // show the initial conditions (setup mode)
  const {p,v}=initState(a);
  a.pos.copy(p);a.vel.copy(v);a.gone=a.lost=false;a.sprite.material.opacity=1;a.sprite.position.copy(p);a.mark.position.copy(p);
  const sp=v.length();a.arrow.position.copy(p);
  if(sp>.02){a.arrow.setDirection(v.clone().normalize());a.arrow.setLength(sp,Math.min(.3,sp*.35),Math.min(.15,sp*.2))}
  a.arrowLen=sp;syncVis(a);
}
function syncVis(a){
  const setup=PART.mode==='setup';
  a.sprite.visible=!a.hidden;
  a.arrow.visible=!a.hidden&&setup&&a.arrowLen>.02;
  a.trail.visible=a.mark.visible=!a.hidden&&!setup;
}
function resetTrail(a){a.n=0;a.trail.geometry.setDrawRange(0,0);pushTrail(a,true)}
const _tc=new THREE.Color(),_gold=new THREE.Color('#ffe27a');
function pushTrail(a,force){
  const j=3*(a.n-1);
  if(!force&&a.n>0&&Math.hypot(a.arr[j]-a.pos.x,a.arr[j+1]-a.pos.y,a.arr[j+2]-a.pos.z)<.02)return;
  if(a.n>=MAXT){a.arr.copyWithin(0,3*600);a.carr.copyWithin(0,3*600);a.n-=600}
  a.arr[3*a.n]=a.pos.x;a.arr[3*a.n+1]=a.pos.y;a.arr[3*a.n+2]=a.pos.z;
  _tc.set(colOf(a));
  if(cfg?.accel){const f=Math.max(0,Math.min(1,(a.vel.length()/cfg.accel.v0-1)/1.2));_tc.lerp(_gold,f)}
  a.carr[3*a.n]=_tc.r;a.carr[3*a.n+1]=_tc.g;a.carr[3*a.n+2]=_tc.b;a.n++;
  a.trail.geometry.setDrawRange(0,a.n);a.trail.geometry.attributes.position.needsUpdate=true;a.trail.geometry.attributes.color.needsUpdate=true;
}
const _v0=new THREE.Vector3();
/* B at a point: imposed for the uniform scene, otherwise Biot–Savart from the conductor
   (segments loaded at build time; rescaled live by the current slider) */
const FIELD=workerCore(),_cv=new THREE.Vector3(),_ct=new THREE.Vector3(),_B=new THREE.Vector3(),_bh=new THREE.Vector3(),_c3=new THREE.Vector3();
function Bat(p,out){
  if(cfg.uniform)return out.copy(Bhat()).multiplyScalar(P().B);
  const o=FIELD.at(p.x,p.y,p.z),k=(P().I||1)/(cfg.I0||1)*(cfg.accel?PART.ramp||1:1);
  return out.set(o[0]*k,o[1]*k,o[2]*k);
}
function sceneBref(){                // typical |B| in the scene: median over points away from the wires
  if(cfg.uniform)return P().B;
  const rng=mulberry32(11),v=[],mn=cfg.box.min,mx=cfg.box.max,o=FIELD.o;
  for(let i=0;i<400&&v.length<60;i++){
    const x=(mn[0]+(mx[0]-mn[0])*rng())*.8,y=(mn[1]+(mx[1]-mn[1])*rng())*.8,z=(mn[2]+(mx[2]-mn[2])*rng())*.8;
    FIELD.at(x,y,z);if(o[3]<cfg.sc*.6)continue;v.push(Math.hypot(o[0],o[1],o[2]));
  }
  v.sort((a,b)=>a-b);return v.length?v[v.length>>1]:1e-5;
}
const niceNum=x=>{const e=Math.floor(Math.log10(x)),m=x/10**e;return (m<1.5?1:m<3.5?2:m<7.5?5:10)*10**e};
// Boris scheme: half drift, rotate v about the local B by −(q/m)|B|h, half drift.
// |v| is conserved exactly (magnetic forces do no work); step size adapts to the local
// cyclotron rate and, near wires, to the distance from the conductor.
function stepParticles(dt){
  if(!cfg||PART.mode!=='run')return;
  const T=dt*PART.timeScale,far=cfg.H*12;_c3.set(...cfg.center);
  if(cfg.accel){_cv.set(...cfg.accel.cav.c);_ct.set(...cfg.accel.cav.t)}
  // all charges advance together in short slices; between slices the ring's magnets are
  // re-ramped to the lead charge's momentum, so they never lag behind an RF kick
  const slice=cfg.accel?.02:T;
  for(let t0=0;t0<T-1e-12;t0+=slice){
    const dT=Math.min(slice,T-t0),Erf=rfField(),r0=PART.ramp||1;
    if(cfg.accel)rfTrack(dT);
    for(const a of PART.list){
      if(a.gone)continue;
      const sp=a.vel.length();let t=0,it=0;
      while(t<dT&&it++<3000){
        Bat(a.pos,_B);
        let h=Math.min(dT-t,.05/Math.max(a.qm*_B.length(),1e-12));
        if(!cfg.uniform&&sp>1e-9)h=Math.min(h,Math.max(.3*FIELD.o[3],.004*cfg.H)/sp);
        if(Erf&&a.pos.distanceTo(_cv)<2*cfg.accel.cav.L)h=Math.min(h,cfg.accel.cav.L/(8*Math.max(sp,1e-9)));
        a.pos.addScaledVector(a.vel,h/2);
        Bat(a.pos,_B);const Bm=_B.length();
        if(Bm>0)a.vel.applyAxisAngle(_bh.copy(_B).multiplyScalar(1/Bm),-a.sign*a.qm*Bm*h);
        a.pos.addScaledVector(a.vel,h/2);t+=h;
        if(Erf){const e=cavityE(a.pos);if(e)a.vel.addScaledVector(_ct,a.sign*a.qm*e*h)}   // F = qE along the beam (E oscillates)
      }
      // induced field of the ramping magnets, E = −(∂A/∂t) = −A·(d ramp/dt), applied once per slice
      if(cfg.accel&&!a.gone&&PART.rampRate){const Av=FIELD.A(a.pos.x,a.pos.y,a.pos.z),k=-a.sign*a.qm*PART.rampRate*dT;
        a.vel.x+=Av[0]*k;a.vel.y+=Av[1]*k;a.vel.z+=Av[2]*k}
      if(a.pos.distanceTo(_c3)>far)a.gone=true;
      if(cfg.accel){const A=cfg.accel;
        if(Math.hypot(Math.hypot(a.pos.x,a.pos.z)-A.R,a.pos.y)>A.a*.85){a.gone=a.lost=true;a.sprite.material.opacity=.35;updateRow(a)}}
    }
    if(cfg.accel&&PART.list.length){
      // magnets follow the momentum of the lead charge (q1) while RF is on, as in a synchrotron
      const q=PART.list[0],A=cfg.accel;
      if(Erf&&!q.gone){PART.ramp=Math.max(.3,q.vel.length()/A.v0);if(PART.ramp>=3){PART.ramp=3;PART.rfMax=true}}
      if(!q.gone){const th=Math.atan2(q.pos.z,q.pos.x);if(PART.lastTh<0&&th>=0&&q.pos.x>0)PART.turns++;PART.lastTh=th}
    }
    if(cfg.accel){
      // dB/dt: the ramp jumps a little at each RF kick; a real synchrotron ramps smoothly, so the rate
      // that drives the induced field is the ramp's rise averaged over about half a turn
      const A=cfg.accel,sp=PART.list[0]&&!PART.list[0].gone?PART.list[0].vel.length():A.v0,tau=Math.PI*A.R/Math.max(sp,1e-6);
      PART.rampRate+=(((PART.ramp||1)-r0)/dT-PART.rampRate)*Math.min(1,dT/tau);
      PART.simT+=dT;
      const sc=PART.scope,last=sc[sc.length-1];
      if(!last||PART.simT-last[0]>=.05){sc.push([PART.simT,PART.ramp||1,rfField()?Math.cos(PART.rfPh):0,PART.rampRate]);if(sc.length>2400)sc.splice(0,600)}
    }
  }
  for(const a of PART.list){a.sprite.position.copy(a.pos);if(!a.gone||a.n<2)pushTrail(a)}
}

/* force arrows: F/m = (q/m) v × B at the charge's current (or, in setup, initial) state */
const _fa=new THREE.Vector3();let forceTick=0;
function updateForces(){
  for(const a of PART.list){
    if(!PART.showForce||a.hidden||a.gone||!cfg||(INS.on&&a!==PART.sel)){a.farrow.visible=a.earrow.visible=false;continue}
    // normal view: length ∝ |F| on the scene's scale; Inspect: ∝ |F| relative to the recent maximum, sized to the camera distance
    const len=f=>INS.on?INS.dist*.36*Math.min(1,f/Math.max(INS.fmax,1e-12)):Math.min(f*cfg.fk,3);
    const head=L=>INS.on?[Math.min(L*.3,INS.dist*.07),Math.min(L*.12,INS.dist*.03)]:[Math.min(.22,L*.35),Math.min(.11,L*.2)];
    let pos=a.pos,vel=a.vel;if(PART.mode==='setup'){const st=initState(a);pos=st.p;vel=st.v}
    // electric force qE: the RF cavity's field plus the field induced by the ramping magnets
    // In the RF gap it is drawn on the same scale as the magnetic force. Elsewhere only the induced
    // field acts, about 1000× weaker, so that arrow is drawn ×E_MAG in a paler green to stay visible.
    const Ev=PART.mode==='run'&&cfg.accel?Eat(pos,_ev):null,fe=Ev?Ev.length()*a.qm:0;
    const inGap=!!(Ev&&cavityE(pos)),Le=fe?len(inGap?fe:fe*E_MAG):0;
    a.earrow.visible=Le>=(INS.on?INS.dist*.01:.03);
    if(a.earrow.visible){a.earrow.setColor(inGap?E_COL:EI_COL);a.earrow.position.copy(pos);a.earrow.setDirection(Ev.multiplyScalar(a.sign/Ev.length()));a.earrow.setLength(Le,...head(Le))}
    Bat(pos,_B);_fa.copy(vel).cross(_B).multiplyScalar(a.sign*a.qm);
    const am=_fa.length(),L=len(am);
    if(L<(INS.on?INS.dist*.01:.03)){a.farrow.visible=false;continue}
    a.farrow.visible=true;a.farrow.position.copy(pos);a.farrow.setDirection(_fa.multiplyScalar(1/am));
    a.farrow.setLength(L,...head(L));
  }
  if(PART.mode==='run'&&++forceTick%6===0)syncInspector();
}
