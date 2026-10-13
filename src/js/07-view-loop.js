/* ---------- apply / view ---------- */
function applyVis(reset){
  const v=VIS_BY[state.vis];
  cfg=finish(v.build(P(),state));
  if(reset){clearLines();rebuildLineMesh()}
  rebuildConductor();
  startJob();
  onFieldChanged();
  if(reset)setView();
}
function setView(){
  const c=cfg.center,d=nrm(cfg.view?.dir||[.58,.42,.70]);
  const asp=persp.aspect||1.5;
  let dist=cfg.H*(cfg.view?.k||2.5);if(asp<1.3)dist*=Math.pow(1.3/asp,.8);
  camera=cfg.uniform?ortho:persp;controls.object=camera;
  if(cfg.uniform){orthoH=cfg.H*1.1*(asp<1.3?1.3/asp:1);ortho.zoom=1;fitOrtho();dist=cfg.H*5}
  camera.position.set(c[0]+d[0]*dist,c[1]+d[1]*dist,c[2]+d[2]*dist);
  controls.target.set(...c);controls.update();
}
let rbTimer=0;
const scheduleRebuild=()=>{clearTimeout(rbTimer);rbTimer=setTimeout(()=>applyVis(false),70)};

/* ---------- animation ---------- */
const _p=new THREE.Vector3(),_d=new THREE.Vector3(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_m=new THREE.Matrix4(),_c=new THREE.Color(),UP=new THREE.Vector3(0,1,0);
function place(mesh,k,Pp,cum,len,closed,a,size){
  let i=a.i;
  while(i<cum.length-2&&cum[i+1]<a.s)i++;
  a.i=i;
  const d=cum[i+1]-cum[i],f=d>0?(a.s-cum[i])/d:0,j=3*i;
  _p.set(Pp[j]+(Pp[j+3]-Pp[j])*f,Pp[j+1]+(Pp[j+4]-Pp[j+1])*f,Pp[j+2]+(Pp[j+5]-Pp[j+2])*f);
  _d.set(Pp[j+3]-Pp[j],Pp[j+4]-Pp[j+1],Pp[j+5]-Pp[j+2]).normalize();
  _q.setFromUnitVectors(UP,_d);
  const e=closed?1:Math.max(0,Math.min(1,a.s/(.3*cfg.sc),(len-a.s)/(.3*cfg.sc)));
  const sz=size*e;_s.set(sz,sz,sz);
  _m.compose(_p,_q,_s);mesh.setMatrixAt(k,_m);
  return i;
}
function advance(a,len,ds){a.s+=ds;if(a.s>=len){a.s-=len*Math.floor(a.s/len);a.i=0}}
function updateArrows(dt){
  arrowMesh.visible=state.display.arrows&&arrows.length>0&&!INS.on;
  if(!arrowMesh.visible)return;
  const vmax=cfg.H*.5,sc=cfg.sc;
  for(let k=0;k<arrows.length;k++){
    const a=arrows[k],L=a.L,t=L.t[a.i];
    advance(a,L.len,vmax*(.05+.95*Math.pow(t,1.5))*dt);
    const i=place(arrowMesh,k,L.p,L.cum,L.len,L.closed,a,sc*(.75+.5*L.t[a.i]));
    const c=ramp(L.t[i]);
    _c.setRGB(c[0]+(1-c[0])*.4,c[1]+(1-c[1])*.4,c[2]+(1-c[2])*.4,THREE.SRGBColorSpace);
    arrowMesh.setColorAt(k,_c);
  }
  arrowMesh.count=arrows.length;
  arrowMesh.instanceMatrix.needsUpdate=true;arrowMesh.instanceColor.needsUpdate=true;
}
function updateFlow(dt){
  flowMesh.visible=state.display.flow&&flow.length>0&&!INS.on;
  if(!flowMesh.visible)return;
  const v=cfg.H*(.03+.45*(P().I??5)/20),sz=cfg.sc*.8;
  for(let k=0;k<flow.length;k++){
    const a=flow[k],tr=a.tr;
    advance(a,tr.len,v*dt);
    place(flowMesh,k,tr.p,tr.cum,tr.len,tr.closed,a,sz);
  }
  flowMesh.count=flow.length;flowMesh.instanceMatrix.needsUpdate=true;
}
const clock=new THREE.Clock();
function frame(){
  requestAnimationFrame(frame);
  const dt=Math.min(clock.getDelta(),.05);
  controls.autoRotate=state.display.rotate&&!camAnim;
  stepCamAnim();
  controls.update();
  const d=camera.position.distanceTo(controls.target);
  if(camera.isOrthographicCamera){scene.fog.near=d+orthoH*.6;scene.fog.far=d+orthoH*3}
  else{scene.fog.near=d*.85;scene.fog.far=d*2.5}
  if(cfg){updateArrows(dt);updateFlow(dt);stepParticles(dt);updateUniformOverlay(dt);updateEField();updateInspect(dt)}
  renderer.render(scene,camera);
}

