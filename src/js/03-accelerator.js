/* ---------- circular accelerator (FODO ring, LHC-style cos-θ magnets) ----------
   Each magnet is built from conductors running along the beam at radius a around the pipe.
   Currents follow cos(nφ) around the aperture (n=1 dipole, n=2 quadrupole), the classic
   cos-θ / cos-2θ windings of superconducting accelerator magnets. Opposite-current
   conductors are joined into closed loops by arcs over the magnet ends. Everything is
   ordinary Biot–Savart; there is no iron. */
const ACC_R=5,ACC_A=.22;
function accelGeometry(N){
  const Lc=2*Math.PI*ACC_R/N,mags=[];
  for(let c=0;c<N;c++)for(const [f,type] of [[0,'QF'],[.25,'D'],[.5,'QD'],[.75,'D']])
    mags.push({type,th:2*Math.PI*(c+f)/N,L:type==='D'?.3*Lc:.1*Lc});
  return {mags,Lc};
}
function magnetFrame(m){
  const R=ACC_R;
  return {c:[R*Math.cos(m.th),0,R*Math.sin(m.th)],t:[-Math.sin(m.th),0,Math.cos(m.th)],r:[Math.cos(m.th),0,Math.sin(m.th)],y:[0,1,0]};
}
function magnetLoops(m,I){
  const {c,t,r,y}=magnetFrame(m),a=ACC_A,n=m.type==='D'?1:2;
  const phis=Array.from({length:8},(_,k)=>(k+.5)*Math.PI/4);
  const pairs=n===1?[[0,4],[1,5],[2,6],[3,7]]:[[0,2],[1,3],[4,6],[5,7]];
  const at=(phi,s)=>add(add(c,scl(t,s)),add(scl(r,a*Math.cos(phi)),scl(y,a*Math.sin(phi))));
  return pairs.map(([k1,k2])=>{
    const p1=phis[k1],p2=phis[k2],w=Math.cos(n*p1),L2=m.L/2,K=Math.max(3,Math.round((p2-p1)/(Math.PI/12)));
    const pts=[at(p1,-L2),at(p1,L2)];
    for(let j=1;j<K;j++)pts.push(at(p1+(p2-p1)*j/K,L2));
    pts.push(at(p2,L2),at(p2,-L2));
    for(let j=K-1;j>0;j--)pts.push(at(p1+(p2-p1)*j/K,-L2));
    return {pts,closed:true,I:I*w};
  });
}
// Design: pick q/m so that ∮(q/m)B_y ds / v = 2π (one full turn of bending from the dipoles),
// and the quadrupole current for thin-lens FODO with 90° phase advance per cell.
const ACC_DESIGN={};
function accelDesign(N){
  if(ACC_DESIGN[N])return ACC_DESIGN[N];
  const {mags,Lc}=accelGeometry(N),core=workerCore(),R=ACC_R,v0=2,Id=5;
  core.load(buildSegs(mags.filter(m=>m.type==='D').flatMap(m=>magnetLoops(m,1))),RW);
  let S=0;const M=1440;
  for(let i=0;i<M;i++){const th=2*Math.PI*(i+.5)/M,o=core.at(R*Math.cos(th),0,R*Math.sin(th));S+=o[1]*R*2*Math.PI/M}
  const sD=Math.sign(S)||1,qm=2*Math.PI*v0/(Math.abs(S)*Id);
  core.load(buildSegs(magnetLoops(mags[0],1)),RW);       // QF centred at θ = 0, beam along +z
  const d=.02,K=600,span=Lc/2;let FB=0;
  for(let i=0;i<K;i++){const s=-span/2+span*(i+.5)/K,o=core.at(R+d,0,s);FB+=o[1]*span/K}
  const invf=qm/v0*FB/d,sQ=Math.sign(invf)||1;            // 1/f per amp (> 0: focusing for + charges)
  const target=4*Math.sin(Math.PI/8)/Lc;                   // f = Lc / (4 sin(μ/2)), μ = 90°
  core.load(buildSegs(magnetLoops(mags[1],1)),RW);
  const Bd=Math.abs(core.at(...magnetFrame(mags[1]).c)[1])*Id;
  return ACC_DESIGN[N]={sD,Id,qm,v0,sQ,Iq:target/Math.abs(invf),Lc,mags,Bd};
}

