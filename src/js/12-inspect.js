/* ---------- inspect: ride along with the selected charge ----------
   Chase camera behind the charge, a live grid of B arrows in its cross-section,
   and a HUD with the vectors, their components and a force history. */
const INS={on:false,saved:null,hist:[],eye:new THREE.Vector3(),look:new THREE.Vector3(),off:new THREE.Vector3(),lookOff:new THREE.Vector3(),upv:new THREE.Vector3(0,1,0),
  fresh:true,dist:1,simT:0,fmax:1e-9,yaw:0,pitch:.4,drag:null};
const GN=11,glyphGroup=new THREE.Group();glyphGroup.visible=false;scene.add(glyphGroup);
const gCones=new THREE.InstancedMesh(new THREE.ConeGeometry(.5,1,10),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.95}),GN*GN);
gCones.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(GN*GN*3),3);gCones.frustumCulled=false;
const gLineGeo=new THREE.BufferGeometry();
gLineGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(GN*GN*6),3));
gLineGeo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(GN*GN*6),3));
const gLines=new THREE.LineSegments(gLineGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9}));gLines.frustumCulled=false;
const gFrame=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>new THREE.Vector3(a,b,0))),new THREE.LineBasicMaterial({color:0x3794ff,transparent:true,opacity:.5}));
glyphGroup.add(gLines,gCones,gFrame);
const hud=$('#hud'),hudSvg=$('#hudx'),hudNum=$('#hudnum'),hudC=$('#hudc');
function insFrame(pos,vel){
  let t,up;
  if(cfg.accel){const r=new THREE.Vector3(pos.x,0,pos.z).normalize();t=r.clone().cross(Y);if(t.dot(vel)<0)t.negate();up=Y.clone()}
  else{
    t=vel.lengthSq()>1e-12?vel.clone().normalize():Z.clone();
    up=Y.clone().addScaledVector(t,-t.y);if(up.lengthSq()<1e-4)up=Z.clone().addScaledVector(t,-t.z);up.normalize();
  }
  return {t,up,side:up.clone().cross(t)};
}
function enterInspect(){
  if(!PART.sel||INS.on)return;
  INS.on=true;INS.fresh=true;INS.hist=[];INS.simT=0;INS.fmax=1e-9;INS.yaw=0;INS.pitch=.4;
  INS.dist=cfg.accel?1.15:Math.max(1.3,cfg.H*.3);
  INS.saved={cam:camera,pos:camera.position.clone(),target:controls.target.clone(),zoom:ortho.zoom};
  camera=persp;controls.object=persp;controls.enabled=false;PART.follow=false;
  lineMesh.material.opacity=.28;planeGroup.visible=axesGroup.visible=false;
  glyphGroup.visible=true;hud.hidden=false;
  if(state.tab!=='charges')setTab('charges');
  placeHud();$('#tabCharges').scrollTop=0;
  Object.assign(matMain,{transparent:true,opacity:.32,depthWrite:false,needsUpdate:true});Object.assign(matCirc,{transparent:true,opacity:.25,depthWrite:false,needsUpdate:true});
  conductor.traverse(o=>{if(o.isSprite)o.visible=false;else if(o.material?.transparent&&o.material.opacity<.35&&o.material!==matMain&&o.material!==matCirc)o.material.opacity*=.45});
  syncToolbar();
}
// read-outs live at the top of the Charges tab; if the panel is closed they float top-right
function placeHud(){
  const docked=!$('#params').classList.contains('closed')&&state.tab==='charges';
  if(docked){if(hud.parentNode!==$('#tabCharges'))$('#tabCharges').prepend(hud)}
  else if(hud.parentNode!==view)view.appendChild(hud);
  hud.classList.toggle('docked',docked);
}
function exitInspect(){
  if(!INS.on)return;
  INS.on=false;const s=INS.saved;
  camera=s.cam;controls.object=camera;camera.position.copy(s.pos);controls.target.copy(s.target);ortho.zoom=s.zoom;ortho.updateProjectionMatrix();
  controls.enabled=true;lineMesh.material.opacity=.95;glyphGroup.visible=false;hud.hidden=true;
  Object.assign(matMain,{transparent:false,opacity:1,depthWrite:true,needsUpdate:true});Object.assign(matCirc,{transparent:false,opacity:1,depthWrite:true,needsUpdate:true});camera.up.set(0,1,0);persp.up.set(0,1,0);
  rebuildConductor();
  applyChargeUI();
}
view.addEventListener('wheel',e=>{if(!INS.on)return;e.preventDefault();e.stopPropagation();INS.dist=Math.min(cfg.H*1.5,Math.max(.3,INS.dist*Math.exp(e.deltaY*.0012)))},{capture:true,passive:false});
const _gp=new THREE.Vector3(),_gb=new THREE.Vector3(),_gq=new THREE.Quaternion(),_gm=new THREE.Matrix4(),_gs=new THREE.Vector3(),_gc=new THREE.Color();
function updateInspect(dt){
  if(!INS.on)return;
  const a=PART.sel;if(!a||!cfg){exitInspect();return}
  const setup=PART.mode==='setup',st=setup?initState(a):null,pos=setup?st.p:a.pos.clone(),vel=setup?st.v:a.vel.clone();
  const {t,up,side}=insFrame(pos,vel);
  // chase camera: behind and a little above, looking ahead along the path
  // the camera orbits the charge: yaw/pitch are measured in the charge's own frame (behind = yaw 0),
  // and the offsets are smoothed relative to the charge so it never drifts off-centre
  const cp=Math.cos(INS.pitch),dir=side.clone().multiplyScalar(Math.sin(INS.yaw)*cp).addScaledVector(up,Math.sin(INS.pitch)).addScaledVector(t,-Math.cos(INS.yaw)*cp);
  const offT=dir.multiplyScalar(INS.dist),lookOffT=t.clone().multiplyScalar(INS.dist*.45*Math.max(0,Math.cos(INS.yaw)*cp));
  const k=INS.fresh||INS.drag?1:Math.min(1,dt*9);INS.fresh=false;
  INS.off.lerp(offT,k);INS.lookOff.lerp(lookOffT,k);INS.upv.lerp(up,k).normalize();
  INS.eye.copy(pos).add(INS.off);INS.look.copy(pos).add(INS.lookOff);
  camera.up.copy(INS.upv);camera.position.copy(INS.eye);controls.target.copy(INS.look);camera.lookAt(INS.look);
  scene.fog.near=INS.dist*2.5;scene.fog.far=INS.dist*14;
  // B arrows across the cross-section (centred on the design orbit in the ring, else on the charge)
  const ctr=cfg.accel?new THREE.Vector3(pos.x,0,pos.z).setLength(cfg.accel.R):pos.clone();
  const span=cfg.accel?cfg.accel.a*1.15:INS.dist*.36,cell=2*span/(GN-1),Bs=[];let Bmax=1e-30;
  for(let j=0;j<GN;j++)for(let i=0;i<GN;i++){
    const p=ctr.clone().addScaledVector(side,-span+i*cell).addScaledVector(up,-span+j*cell),B=Bat(p,new THREE.Vector3());
    Bs.push([p,B]);Bmax=Math.max(Bmax,B.length());
  }
  const lp=gLineGeo.attributes.position.array,lc=gLineGeo.attributes.color.array;
  Bs.forEach(([p,B],n)=>{
    const m=B.length(),f=m/Bmax,L=cell*.9*(.3+.7*f),d=m>0?B.multiplyScalar(1/m):t.clone();
    const c=ramp(.45+.55*f),cl=[lin(c[0]),lin(c[1]),lin(c[2])];
    const p0=p.clone().addScaledVector(d,-L/2),p1=p.clone().addScaledVector(d,L/2-cell*.25);
    lp.set([p0.x,p0.y,p0.z,p1.x,p1.y,p1.z],6*n);lc.set([...cl,...cl],6*n);
    _gq.setFromUnitVectors(Y,d);_gs.set(cell*.12,cell*.24,cell*.12);_gp.copy(p).addScaledVector(d,L/2-cell*.15);
    _gm.compose(_gp,_gq,_gs);gCones.setMatrixAt(n,_gm);_gc.setRGB(c[0],c[1],c[2],THREE.SRGBColorSpace);gCones.setColorAt(n,_gc);
  });
  gLineGeo.attributes.position.needsUpdate=gLineGeo.attributes.color.needsUpdate=true;
  gCones.instanceMatrix.needsUpdate=true;gCones.instanceColor.needsUpdate=true;
  gFrame.position.copy(ctr);gFrame.scale.setScalar(span*1.08);gFrame.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,up,t));
  // forces at the charge
  const B=Bat(pos,new THREE.Vector3()),Fm=vel.clone().cross(B).multiplyScalar(a.sign*a.qm);
  const Fe=cfg.accel&&!setup?Eat(pos,new THREE.Vector3()).multiplyScalar(a.sign*a.qm):new THREE.Vector3();
  const F=Fm.clone().add(Fe),comp=v=>[v.dot(side),v.dot(up),v.dot(t)];
  if(PART.mode==='run'){INS.simT+=dt*PART.timeScale;INS.hist.push([INS.simT,F.dot(side),F.dot(up),B.length()]);if(INS.hist.length>900)INS.hist.shift()}
  drawHud(a,pos,vel,B,Fm,Fe,{t,up,side},comp);
}
function cavityE(p){
  const A=cfg.accel;if(!A||PART.rfMax)return 0;const E=rfField();if(!E)return 0;
  const C=A.cav,dx=p.x-C.c[0],dy=p.y-C.c[1],dz=p.z-C.c[2],s=dx*C.t[0]+dy*C.t[1]+dz*C.t[2];
  return Math.abs(s)<C.L/2&&dx*dx+dy*dy+dz*dz-s*s<A.a*A.a?E*Math.cos(PART.rfPh||0):0;   // signed: E0·cos φ
}
const rfField=()=>{                // RF amplitude E0, chosen so a crest crossing adds rf % of the injection energy
  const A=cfg.accel;return A&&P().rf>0&&!PART.rfMax?P().rf/100*A.v0*A.v0/2/(A.qm*A.cav.L):0};
function fmtF(x){const a=Math.abs(x);return a>=100?x.toFixed(0):a>=1?x.toFixed(2):x.toFixed(3)}
function drawHud(a,pos,vel,B,Fm,Fe,fr,comp){
  const acc=!!cfg.accel,S=176,C=S/2,NS='http://www.w3.org/2000/svg';
  const L1=acc?'out':'side',L2=acc?'up':'up';
  let h=`<rect x="0" y="0" width="${S}" height="${S}" rx="10" class="hx-bg"/>`;
  h+=`<line x1="10" y1="${C}" x2="${S-10}" y2="${C}" class="hx-ax"/><line x1="${C}" y1="10" x2="${C}" y2="${S-10}" class="hx-ax"/>`;
  h+=`<text x="${S-12}" y="${C-6}" class="hx-l" text-anchor="end">${L1}</text><text x="${C+6}" y="20" class="hx-l">${L2}</text>`;
  let cx=C,cy=C;
  if(acc){const A=cfg.accel,k=(C-14)/(A.a*.95),dx=Math.hypot(pos.x,pos.z)-A.R,dy=pos.y;
    h+=`<circle cx="${C}" cy="${C}" r="${A.a*.85*k}" class="hx-pipe"/><circle cx="${C}" cy="${C}" r="2.5" class="hx-orb"/>`;
    cx=C+dx*k;cy=C-dy*k;}
  // vectors from the charge, in the cross-section (side, up)
  const arrow=(v,len,cls)=>{const m=Math.hypot(v[0],v[1]);if(m<1e-9||len<2)return '';
    const dx=v[0]/m,dy=-v[1]/m,x2=cx+dx*len,y2=cy+dy*len;          // screen direction (y down)
    return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" class="${cls}"/><path d="M${x2+dx*8} ${y2+dy*8} L${x2-dy*4.5} ${y2+dx*4.5} L${x2+dy*4.5} ${y2-dx*4.5}Z" class="${cls}f"/>`};
  const Bc=comp(B),Bm=B.length(),Fc=comp(Fm),Ec=comp(Fe),Fmag=Math.hypot(...Fc)+Math.hypot(...Ec);
  INS.fmax=Math.max(INS.fmax*.995,Fmag);
  h+=arrow(Bc,Bm>0?62*Math.hypot(Bc[0],Bc[1])/Bm:0,'hx-b');
  h+=arrow(Fc,62*Math.hypot(Fc[0],Fc[1])/INS.fmax,'hx-f');
  h+=arrow(Ec,62*Math.abs(Ec[2])/INS.fmax,'hx-e');
  h+=`<circle cx="${cx}" cy="${cy}" r="7" class="hx-q ${a.sign>0?'pos':'neg'}"/><line x1="${cx-3.5}" y1="${cy-3.5}" x2="${cx+3.5}" y2="${cy+3.5}" class="hx-x"/><line x1="${cx+3.5}" y1="${cy-3.5}" x2="${cx-3.5}" y2="${cy+3.5}" class="hx-x"/>`;
  hudSvg.innerHTML=h;
  const bu=Bm>=.1?[1,'T']:Bm>=1e-4?[1e-3,'mT']:[1e-6,'µT'];
  const sp=vel.length(),row=(l,v,c='')=>`<span class="${c}">${l}</span><b>${v}</b>`;
  const Ftot=Fm.clone().add(Fe),Ft=comp(Ftot);
  hudNum.innerHTML=
    row('speed',sp.toFixed(3)+' m/s')+row('energy/m',(sp*sp/2).toFixed(3)+' J/kg')+
    row('|B|',fmtB(Bm),'cb')+row(`B ${L1}/up/along`,Bc.map(x=>(x/bu[0]).toFixed(2)).join(' · ')+' '+bu[1],'cb')+
    row('|F|/m',fmtF(Math.hypot(...Ft))+' m/s²','cf')+row(`F ${L1}`,fmtF(Ft[0]),'cf')+row('F up',fmtF(Ft[1]),'cf')+row('F along',fmtF(Ft[2]),Fe.lengthSq()?'ce':'cf')+(acc?row('qE/m',fmtF(Fe.length())+' m/s²','ce'):'')+
    (acc?row('turn',PART.turns)+row('magnets',Math.round((PART.ramp||1)*P().dip)+' %'):'');
  // force history (sideways and vertical components)
  const g=hudC.getContext('2d'),W=hudC.width,H=hudC.height,dpr=hudC.width/hudC.clientWidth||1;
  g.clearRect(0,0,W,H);
  const hs=INS.hist,win=acc?Math.max(4,4*Math.PI*cfg.accel.R/(sp||1)/10):8,t1=INS.simT,t0=t1-win;
  let m=1e-12,bm=1e-30;for(const s of hs)if(s[0]>=t0){m=Math.max(m,Math.abs(s[1]),Math.abs(s[2]));bm=Math.max(bm,s[3])}
  const X=t=>(t-t0)/win*W,Yv=v=>H/2-v/m*(H/2-6*dpr);
  g.fillStyle='rgba(55,148,255,.14)';g.beginPath();g.moveTo(X(t0),H);
  for(const s of hs)if(s[0]>=t0)g.lineTo(X(s[0]),H-(s[3]/bm)*(H-8*dpr));g.lineTo(X(t1),H);g.fill();
  g.strokeStyle='#3c3c3c';g.lineWidth=dpr;g.beginPath();g.moveTo(0,H/2);g.lineTo(W,H/2);g.stroke();
  for(const [i,col] of [[1,'#f48771'],[2,'#c586c0']]){g.strokeStyle=col;g.lineWidth=1.6*dpr;g.beginPath();let f=true;
    for(const s of hs)if(s[0]>=t0){const x=X(s[0]),y=Yv(s[i]);f?g.moveTo(x,y):g.lineTo(x,y);f=false}g.stroke()}
  $('#hudlab').innerHTML=`<i class="k1"></i>F ${L1}<i class="k2"></i>F up<i class="k3"></i>|B|<span>${hs.length?win.toFixed(0)+' s':'run to record'}</span>`;
  $('#hudq').innerHTML=`<span class="dot ${a.sign>0?'pos':'neg'}">${a.sign>0?'+':'−'}</span>q${a.id}${a.lost?' · lost':''}`;
}

