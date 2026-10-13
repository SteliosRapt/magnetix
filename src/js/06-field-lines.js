/* ---------- state for current visualisation ---------- */
let cfg=null, lines=[], arrows=[], tracks=[], flow=[];

function finish(c){
  c.center=[0,1,2].map(i=>(c.box.min[i]+c.box.max[i])/2);
  c.H=Math.max(...[0,1,2].map(i=>(c.box.max[i]-c.box.min[i])/2));
  c.sc=c.H/5; c.maxLen=c.maxLen||c.H*6;
  return c;
}
function buildSegs(paths){
  const a=[];
  for(const p of paths){const n=p.pts.length,m=p.closed?n:n-1;
    for(let i=0;i<m;i++){const A=p.pts[i],B=p.pts[(i+1)%n],d=sub(B,A);
      if(d[0]*d[0]+d[1]*d[1]+d[2]*d[2]<1e-12)continue;a.push(A[0],A[1],A[2],d[0],d[1],d[2],p.I)}}
  return new Float64Array(a);
}
function makeBattery(pos,dir){
  const g=new THREE.Group(),s=1;
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.12*s,.12*s,.44*s,32),matBatt);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.124*s,.124*s,.08*s,32),matMain);band.position.y=.17*s;
  const nub=new THREE.Mesh(new THREE.CylinderGeometry(.045*s,.045*s,.05*s,16),matTerm);nub.position.y=.245*s;
  const neg=new THREE.Mesh(new THREE.CylinderGeometry(.1*s,.1*s,.02*s,24),matTerm);neg.position.y=-.225*s;
  g.add(body,band,nub,neg);
  g.position.set(...pos);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...dir).normalize());
  return g;
}
function clipRuns(pts,closed,box){
  const e=1.15,inside=p=>p[0]>=box.min[0]*e&&p[1]>=box.min[1]*e&&p[2]>=box.min[2]*e&&p[0]<=box.max[0]*e&&p[1]<=box.max[1]*e&&p[2]<=box.max[2]*e;
  if(closed&&pts.every(inside))return [{pts:pts.concat([pts[0]]),closed:true}];
  const runs=[],seq=closed?pts.concat([pts[0]]):pts;let cur=[];
  for(const p of seq){if(inside(p))cur.push(p);else{if(cur.length>1)runs.push({pts:cur,closed:false});cur=[]}}
  if(cur.length>1)runs.push({pts:cur,closed:false});
  return runs;
}
function rebuildConductor(){
  for(const o of [...conductor.children]){o.traverse(x=>x.geometry&&x.geometry.dispose());conductor.remove(o)}
  tracks=[];
  for(const d of cfg.display){
    const curve=new PolyCurve(d.pts,d.closed);
    const segs=Math.min(9000,Math.max(d.pts.length,Math.ceil(curve.L/.3)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,segs,RW,7,d.closed),d.main?matMain:matCirc);
    mesh.userData.main=d.main;conductor.add(mesh);
    for(const r of clipRuns(d.pts,d.closed,cfg.box)){
      const p=new Float32Array(r.pts.flat()),c=cumOf(p);
      if(c[c.length-1]>1e-3)tracks.push({p,cum:c,len:c[c.length-1],closed:r.closed,main:d.main});
    }
  }
  if(cfg.battery)conductor.add(makeBattery(cfg.battery.pos,cfg.battery.dir));
  if(cfg.accel){                                   // display only: no iron in the field model
    const A=cfg.accel,glass=(color,opacity)=>new THREE.MeshStandardMaterial({color,metalness:.3,roughness:.4,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false});
    const pipe=new THREE.Mesh(new THREE.TorusGeometry(A.R,A.a*.85,16,240),glass(0xa0a8b0,.12));pipe.rotation.x=Math.PI/2;conductor.add(pipe);
    const mats={D:glass(0x3794ff,.13),QF:glass(0xf48771,.2),QD:glass(0x4ec9b0,.2)};
    for(const m of Object.values(mats))m.userData.op=m.opacity;cfg.magMats=mats;
    for(const m of A.mags){
      const {c,t,y}=magnetFrame(m),sh=new THREE.Mesh(new THREE.CylinderGeometry(A.a*1.45,A.a*1.45,m.L*.98,40,1,true),mats[m.type]);
      sh.position.set(...c);sh.quaternion.setFromUnitVectors(Y,new THREE.Vector3(...t));conductor.add(sh);
      if(m.type!=='D'){const l=textSprite(m.type,m.type==='QF'?'#f48771':'#4ec9b0',96);l.scale.setScalar(.42);l.position.set(c[0],A.a*2.3,c[2]);conductor.add(l)}
    }
    { // RF cavity: a short accelerating gap with an oscillating electric field along the beam
      const C=A.cav,cv=new THREE.Mesh(new THREE.CylinderGeometry(A.a*1.75,A.a*1.75,C.L,40,1,true),glass(0xdcdcaa,.3));
      cv.position.set(...C.c);cv.quaternion.setFromUnitVectors(Y,new THREE.Vector3(...C.t));conductor.add(cv);cfg.cavMesh=cv;cfg.cavPulse=0;
      const l=textSprite('RF','#dcdcaa',96);l.scale.setScalar(.42);l.position.set(C.c[0],A.a*2.5,C.c[2]);conductor.add(l);
    }
  }
  setupFlow();
}
function setupFlow(){
  flow=[];
  const vis=tracks;
  const total=vis.reduce((s,t)=>s+t.len,0);
  const sp=Math.max(cfg.sc*.8,total/MAXF);
  for(const tr of vis){const n=Math.max(1,Math.floor(tr.len/sp));for(let j=0;j<n;j++)flow.push({tr,s:(j+.5)/n*tr.len,i:0})}
}

/* ---------- field lines ---------- */
function computeT(L){
  const rk=cfg?.accel?PART.ramp||1:1;
  if(L.fixedT!=null){L.t.fill(L.fixedT);return}
  const k=(P().I||1)/(L.I0||1)*rk;for(let i=0;i<L.t.length;i++)L.t[i]=tOf(L.b0[i]*k);
}
function rebuildLineMesh(){
  let ns=0;for(const L of lines)ns+=L.t.length-1;
  const pos=new Float32Array(ns*6),col=new Float32Array(ns*6);let k=0;
  for(const L of lines){
    const Pp=L.p,T=L.t;
    let c0=ramp(T[0]);
    for(let i=0;i<T.length-1;i++){
      const j=3*i,c1=ramp(T[i+1]);
      pos[k]=Pp[j];pos[k+1]=Pp[j+1];pos[k+2]=Pp[j+2];pos[k+3]=Pp[j+3];pos[k+4]=Pp[j+4];pos[k+5]=Pp[j+5];
      col[k]=lin(c0[0]);col[k+1]=lin(c0[1]);col[k+2]=lin(c0[2]);col[k+3]=lin(c1[0]);col[k+4]=lin(c1[1]);col[k+5]=lin(c1[2]);
      c0=c1;k+=6;
    }
  }
  lineMesh.geometry.dispose();
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  lineMesh.geometry=g;
}
function recolorAll(){for(const L of lines)computeT(L);rebuildLineMesh()}
function clearLines(){lines=[];arrows=[]}
let jobI=5;
function addLine(raw){
  const cum=cumOf(raw.p),len=cum[cum.length-1];
  if(len<1e-4)return;
  const L={p:raw.p,b0:raw.b,I0:jobI,closed:raw.closed,cum,len,t:new Float32Array(raw.b.length),fixedT:raw.fixedT};
  computeT(L);lines.push(L);
  const sp=raw.arrowSp||cfg.H*.42,n=Math.max(1,Math.floor(len/sp)),off=0;
  for(let j=0;j<n&&arrows.length<MAXA;j++)arrows.push({L,s:(j+off)/n*len,i:0});
}

/* ---------- worker job ---------- */
const computeSync=workerCore();
const workerURL=URL.createObjectURL(new Blob(['('+workerCore.toString()+')();'],{type:'text/javascript'}));
let worker=null,jobId=0,awaitFirst=false,useWorker=true;
const spin=$('#spin');
function onJobMsg(m){
  if(m.job!==jobId)return;
  if(m.type==='lines'){
    if(awaitFirst){clearLines();awaitFirst=false}
    for(const L of m.lines)addLine(L);
    rebuildLineMesh();
  }else if(m.type==='done'){
    if(awaitFirst){clearLines();rebuildLineMesh();awaitFirst=false}
    spin.classList.remove('on');
  }
}
// uniform field: straight parallel lines on a square grid across the plane ⊥ B
function uniformLines(){
  clearLines();
  const p=P(),b=Bhat(),u=new THREE.Vector3().crossVectors(b,Math.abs(b.y)<.9?Y:X).normalize(),w=new THREE.Vector3().crossVectors(b,u);
  // spacing set by density across a 12 m frame; lines run far past the view along B (the field is infinite)
  const sp=12/Math.round(p.n),G=Math.ceil(7.5/sp),Lh=22,K=177,t=.3+.5*(p.B-.2)/2.8;
  for(let i=-G;i<G;i++)for(let j=-G;j<G;j++){
    const o=u.clone().multiplyScalar((i+.5)*sp).addScaledVector(w,(j+.5)*sp);
    const pts=new Float32Array(3*K);
    for(let k=0;k<K;k++){const s=-Lh+2*Lh*k/(K-1);pts[3*k]=o.x+b.x*s;pts[3*k+1]=o.y+b.y*s;pts[3*k+2]=o.z+b.z*s}
    addLine({p:pts,b:new Float32Array(K).fill(p.B),closed:false,fixedT:t,arrowSp:cfg.H*1.2});
  }
  rebuildLineMesh();
}
function startJob(){
  if(worker){worker.terminate();worker=null}
  axesGroup.scale.setScalar(cfg.uniform?2.2:1);
  if(cfg.uniform){jobId++;awaitFirst=false;uniformLines();spin.classList.remove('on');return}
  const id=++jobId;awaitFirst=true;jobI=P().I;spin.classList.add('on');
  const msg={job:id,segs:buildSegs(cfg.phys),rw:RW,rakes:cfg.rakes,seedPts:cfg.seedPts,mode:state.display.spacing,nSeeds:Math.round(P().n*(P().planes||P().levels||1)),
    seed:1337,box:cfg.box,H:cfg.H,maxLen:cfg.maxLen};
  if(useWorker){
    try{
      worker=new Worker(workerURL);
      worker.onmessage=e=>onJobMsg(e.data);
      worker.onerror=()=>{useWorker=false;worker=null;setTimeout(()=>computeSync(msg,onJobMsg),0)};
      worker.postMessage(msg);return;
    }catch(err){useWorker=false}
  }
  setTimeout(()=>computeSync(msg,onJobMsg),0);
}

