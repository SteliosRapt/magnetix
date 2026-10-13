/* ---------- electric fields in the ring ----------
   1. RF cavity: E along the beam, E = E0·cos φ. The phase φ is locked to the lead charge q1
      (harmonic 1, as a beam-phase loop does): the field is at its crest whenever q1 is in the gap and
      reversed half a turn later. It has to oscillate: any static E has ∮E·dl = 0, so whatever a
      static field gave on one side of the ring it would take back on the other. As the beam speeds
      up, the RF frequency rises with it — exactly what low-energy synchrotrons do.
   2. Induced field of the ramping magnets (Faraday): E = −∂A/∂t, with A the vector potential of the
      same conductors (there are no charges, so there is no −∇V term). It curls around each magnet's
      changing flux: forwards on one side of the aperture, backwards on the other. Around the whole
      orbit it nearly cancels (∮E·dl = −dΦ/dt, and little net flux threads the ring), which is why a
      synchrotron needs RF cavities — unlike a betatron, where that net flux is the whole point. */
const E_COL='#89d185',EI_COL='#c5e8a3',E_MAG=1000,_ev=new THREE.Vector3();
const eGroup=new THREE.Group();scene.add(eGroup);
function glyphSet(max,color,op){
  const geo=new THREE.BufferGeometry(),pos=new Float32Array(max*6);
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));geo.setDrawRange(0,0);
  const lm=new THREE.LineBasicMaterial({color,transparent:true,opacity:op,depthWrite:false,depthTest:false}),cm=new THREE.MeshBasicMaterial({color,transparent:true,opacity:op,depthWrite:false,depthTest:false});
  const lines=new THREE.LineSegments(geo,lm),cones=new THREE.InstancedMesh(new THREE.ConeGeometry(.5,1,8),cm,max);
  cones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);lines.frustumCulled=cones.frustumCulled=false;cones.count=0;
  lines.renderOrder=cones.renderOrder=6;eGroup.add(lines,cones);
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sv=new THREE.Vector3(),c=new THREE.Vector3();let n=0;
  return {
    opacity(o){lm.opacity=cm.opacity=o},
    begin(){n=0},
    add(p,d,L,w){            // arrow of length L centred on p, pointing along unit d
      if(n>=max)return;const h=Math.min(L*.45,w*3);
      pos.set([p.x-d.x*L/2,p.y-d.y*L/2,p.z-d.z*L/2,p.x+d.x*(L/2-h*.8),p.y+d.y*(L/2-h*.8),p.z+d.z*(L/2-h*.8)],6*n);
      q.setFromUnitVectors(Y,d);c.copy(p).addScaledVector(d,L/2-h/2);sv.set(w*2,h,w*2);m4.compose(c,q,sv);cones.setMatrixAt(n++,m4);
    },
    end(){geo.setDrawRange(0,2*n);geo.attributes.position.needsUpdate=true;cones.count=n;cones.instanceMatrix.needsUpdate=true}};
}
const EF={rf:glyphSet(48,E_COL,.95),ind:glyphSet(700,EI_COL,.75),cav:null,samp:null,Amax:1,circ:0};
// sample points: across the RF gap, and around the ring across the aperture (A at the design currents;
// the actual A is that times the ramp, so the induced E is −A·(d ramp/dt))
function buildEField(){
  EF.cav=EF.samp=null;
  const A=cfg.accel;if(!A)return;
  const C=A.cav,cc=new THREE.Vector3(...C.c),cr=new THREE.Vector3(C.c[0],0,C.c[2]).normalize(),pts=[[0,0]];
  for(const [r,m] of [[.45,6],[.82,10]])for(let j=0;j<m;j++){const f=2*Math.PI*j/m+r*3;pts.push([r*A.a*Math.cos(f),r*A.a*Math.sin(f)])}
  EF.cav={t:new THREE.Vector3(...C.t),pts:pts.map(([x,y])=>cc.clone().addScaledVector(cr,x).addScaledVector(Y,y))};
  const M=Math.round(2*Math.PI*A.R/.18),s=[];let Amax=1e-30,circ=0;
  for(let i=0;i<M;i++){
    const th=2*Math.PI*(i+.5)/M,r=new THREE.Vector3(Math.cos(th),0,Math.sin(th)),t=new THREE.Vector3(-Math.sin(th),0,Math.cos(th));
    for(const o of [-.6,0,.6]){
      const p=r.clone().multiplyScalar(A.R+o*A.a),a=FIELD.A(p.x,p.y,p.z),v=new THREE.Vector3(a[0],a[1],a[2]);
      s.push({p,A:v});Amax=Math.max(Amax,v.length());if(o===0)circ+=v.dot(t)*2*Math.PI*A.R/M;
    }
  }
  EF.samp=s;EF.Amax=Amax;EF.circ=circ;          // circ = ∮A·dl = magnetic flux through the design orbit
}
function rfTrack(dT){                             // RF phase, locked to q1 (φ = 0 when q1 is at the gap)
  const q=PART.list[0],A=cfg.accel;
  if(q&&!q.gone){let d=Math.atan2(q.pos.z,q.pos.x)-A.cav.th;d-=2*Math.PI*Math.round(d/(2*Math.PI));PART.rfPh=d;PART.rfW=q.vel.length()/A.R}
  else PART.rfPh=(PART.rfPh||0)+(PART.rfW||A.v0/A.R)*dT;
}
function Eat(p,out){                              // total E at p: RF cavity + induced −∂A/∂t
  out.set(0,0,0);const A=cfg.accel;if(!A)return out;
  const e=cavityE(p);if(e)out.set(...A.cav.t).multiplyScalar(e);
  const r=PART.rampRate||0;if(r){const a=FIELD.A(p.x,p.y,p.z);out.x-=a[0]*r;out.y-=a[1]*r;out.z-=a[2]*r}
  return out;
}
// how strongly the magnets are ramping: 1 when the field rises by 10 % of its injection value per turn
function rampLevel(){const A=cfg.accel,sp=PART.list[0]?.vel.length()||A.v0;return Math.min(1,Math.abs(PART.rampRate||0)*2*Math.PI*A.R/sp/.1)}
const _ed=new THREE.Vector3();
function updateEField(){
  const A=cfg.accel,on=!!A&&PART.showE;
  EF.rf.begin();EF.ind.begin();
  if(on&&EF.cav&&PART.mode!=='setup'&&rfField()){
    const c=Math.cos(PART.rfPh||0);
    if(Math.abs(c)>.04){_ed.copy(EF.cav.t).multiplyScalar(Math.sign(c));const L=A.cav.L*.95*Math.abs(c);
      for(const p of EF.cav.pts)EF.rf.add(p,_ed,L,A.a*.055)}
  }
  const g=on&&EF.samp&&PART.mode!=='setup'?rampLevel():0;
  if(g>.01){
    const sg=-Math.sign(PART.rampRate);EF.ind.opacity((.25+.6*g)*(INS.on?.5:1));
    for(const s of EF.samp){const f=s.A.length()/EF.Amax,L=.45*f*g;if(L<.03)continue;
      _ed.copy(s.A).multiplyScalar(sg/s.A.length());EF.ind.add(s.p,_ed,L,INS.on?.008:.014)}
  }
  EF.rf.end();EF.ind.end();
  // magnets brighten as their current ramps up, and glow while it is changing (dB/dt ≠ 0)
  if(cfg.magMats){const f=Math.max(0,((PART.ramp||1)-1)/2);
    for(const m of Object.values(cfg.magMats)){m.opacity=Math.min(.8,m.userData.op*(1+1.4*f)+.12*g)*(INS.on?.45:1);m.emissive.copy(m.color).multiplyScalar(.55*f+.45*g)}}
  // the cavity glows green while its field points along the beam, orange while it points backwards
  if(cfg.cavMesh){const m=cfg.cavMesh.material,c=on&&PART.mode!=='setup'&&rfField()?Math.cos(PART.rfPh||0):0;
    m.opacity=(INS.on?.12:.22)+.4*Math.abs(c);m.emissive.set(c>=0?0x89d185:0xf48771).multiplyScalar(.9*Math.abs(c))}
}
// time trace: dipole field (ramp) and the RF field in the cavity
function drawScope(){
  const cv=$('#accscope');if(!cv||!cfg.accel)return;
  const dpr=Math.min(2,devicePixelRatio||1),W=Math.round(cv.clientWidth*dpr),H=Math.round(cv.clientHeight*dpr);
  if(!W||!H)return;if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
  const g=cv.getContext('2d'),hs=PART.scope,A=cfg.accel,sp=PART.list[0]?.vel.length()||A.v0;
  const win=2.5*2*Math.PI*A.R/Math.max(sp,1e-6),t1=Math.max(PART.simT,win*.25),t0=t1-win,X=t=>(t-t0)/win*W;
  g.clearRect(0,0,W,H);g.strokeStyle='#333';g.lineWidth=dpr;g.beginPath();g.moveTo(0,H/2);g.lineTo(W,H/2);g.stroke();
  // dB/dt as a shaded band under the field curve
  const yB=r=>H-4*dpr-((r-.8)/2.4)*(H-8*dpr),yE=c=>H/2-c*(H/2-5*dpr);
  g.fillStyle='rgba(79,193,255,.13)';g.beginPath();let first=true;
  for(const s of hs)if(s[0]>=t0){const x=X(s[0]);if(first){g.moveTo(x,H);first=false}g.lineTo(x,yB(s[1]))}
  if(!first){g.lineTo(X(hs[hs.length-1][0]),H);g.fill()}
  for(const [i,col,y] of [[2,E_COL,yE],[1,'#4fc1ff',yB]]){g.strokeStyle=col;g.lineWidth=1.6*dpr;g.beginPath();let f=true;
    for(const s of hs)if(s[0]>=t0){const x=X(s[0]),v=y(s[i]);f?g.moveTo(x,v):g.lineTo(x,v);f=false}g.stroke()}
  if(!hs.length){g.fillStyle='#6f6f6f';g.font=`${11*dpr}px system-ui,sans-serif`;g.fillText('run to record',8*dpr,14*dpr)}
}

