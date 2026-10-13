/* ---------- presets (every scene) ----------
   Each preset lists charges in world coordinates. `r` asks for a starting gyroradius:
   q/m is then chosen from the local field so the first loop has that radius
   (qmRef = point whose field sets it; defaults to the start point). */
const PRESETS={
  infwire:[
    {k:'par',label:'Parallel to I',title:'Moving along the current: it gyrates while being pulled towards the wire, like two parallel currents attracting',make:()=>[{p:[1.5,0,0],v:[0,1.2,0],r:.45}]},
    {k:'anti',label:'Against I',title:'Moving against the current: pushed away from the wire',make:()=>[{p:[1.5,0,0],v:[0,-1.2,0],r:.45}]},
    {k:'toward',label:'Toward the wire',title:'Fired straight at the wire: deflected along it',make:()=>[{p:[2.6,0,0],v:[-1.2,0,0],r:.6}]},
    {k:'pm',label:'± pair',title:'Same start, opposite charges: mirror-image paths',make:()=>[{p:[1.5,0,0],v:[0,1.2,0],r:.45},{p:[1.5,0,0],v:[0,1.2,0],r:.45,sign:-1}]}],
  finwire:[
    {k:'beside',label:'Beside the wire',title:'Moving along the wire: gyrates and is drawn in',make:p=>[{p:[-p.W/2+1,0,0],v:[0,1,0],r:.4}]},
    {k:'cross',label:'Across the wire',title:'Fired across the wire at mid-height',make:p=>[{p:[-p.W/2+2,0,.4],v:[-1.2,0,0],r:.5}]},
    {k:'pm',label:'± pair',title:'Same start, opposite charges',make:p=>[{p:[-p.W/2+1,0,0],v:[0,1,0],r:.4},{p:[-p.W/2+1,0,0],v:[0,1,0],r:.4,sign:-1}]}],
  random:[
    {k:'fan',label:'Fan',title:'Six charges fired from the centre in different directions',make:()=>[0,1,2,3,4,5].map(i=>{const a=i*Math.PI/3;return {p:[0,0,0],v:[1.2*Math.cos(a),.7*Math.sin(a),1.2*Math.sin(a)*.8],r:.5,qmRef:[0,0,0]}})},
    {k:'pm',label:'± pair',title:'Same start, opposite charges',make:()=>[{p:[0,0,0],v:[1.2,0,0],r:.5},{p:[0,0,0],v:[1.2,0,0],r:.5,sign:-1}]}],
  loop:[
    {k:'axis',label:'Along the axis',title:'On the axis B is parallel to v: no force, it passes straight through',make:()=>[{p:[0,-3.5,0],v:[0,1.2,0]}]},
    {k:'off',label:'Off-axis pass',title:'Parallel to the axis but off-centre: twisted as it crosses the loop',make:p=>[{p:[.55*p.R,-3.5,0],v:[0,1.2,0],qmRef:[0,0,0],r:.6}]},
    {k:'circ',label:'Circling inside',title:'In the loop plane, moving sideways: gyrates around the strong central field',make:p=>[{p:[.35*p.R,0,0],v:[0,0,1],r:.35}]},
    {k:'pm',label:'± pair',title:'Opposite charges through the loop, off-axis',make:p=>[{p:[.55*p.R,-3.5,0],v:[0,1.2,0],qmRef:[0,0,0],r:.6},{p:[.55*p.R,-3.5,0],v:[0,1.2,0],qmRef:[0,0,0],r:.6,sign:-1}]}],
  stacked:[
    {k:'axis',label:'Along the axis',title:'No force on the axis',make:()=>[{p:[0,-3,0],v:[0,1.2,0]}]},
    {k:'circ',label:'Circling inside',title:'Gyrates inside the coil',make:p=>[{p:[.3*p.R,0,0],v:[0,0,1],r:.3}]},
    {k:'bottle',label:'Magnetic bottle',title:'Two loops far apart: the field is stronger at the loops than between them, so a charge with mostly sideways velocity bounces back and forth (magnetic mirror)',
      params:{N:2,R:.5,s:1},make:()=>[{p:[.06,0,0],v:[0,.45,1.05],r:.06}]}],
  infsol:[
    {k:'cyc',label:'Cyclotron circle',title:'Uniform field inside: a perfect circle',make:p=>[{p:[.4*p.R,0,0],v:[0,0,1],r:.3*p.R}]},
    {k:'helix',label:'Helix',title:'Some velocity along the axis: a helix along the field',make:p=>[{p:[.4*p.R,-3,0],v:[0,.35,1],r:.3*p.R}]},
    {k:'inout',label:'Inside / outside',title:'Same charge and speed: circles inside, almost no force outside',make:p=>[{p:[.4*p.R,0,0],v:[0,0,1],r:.3*p.R},{p:[p.R+1.2,0,0],v:[0,0,1],r:.3*p.R,qmRef:[0,0,0]}]}],
  finsol:[
    {k:'cyc',label:'Cyclotron circle',title:'Near the centre the field is nearly uniform: a circle',make:p=>[{p:[.4*p.R,0,0],v:[0,0,1],r:.3*p.R}]},
    {k:'end',label:'Out of the end',title:'A helix that leaves the coil: it widens as the field weakens and spreads at the end',make:p=>[{p:[.3*p.R,-.25*p.Ls,0],v:[0,.5,1],r:.25*p.R}]},
    {k:'axis',label:'Along the axis',title:'No force on the axis',make:p=>[{p:[0,-p.Ls/2-2,0],v:[0,1.2,0]}]}],
  toroid:[
    {k:'trap',label:'Trapped in the tube',title:'Follows the field around the torus but drifts vertically (curvature and gradient drift) and escapes: why tokamaks add a twisting field',
      make:p=>[{p:[p.Rm,0,0],v:[.5,0,1.5],r:.08}]},
    {k:'hole',label:'Through the hole',title:'Through the central hole: only the weak field of the winding\'s net circular current acts',make:()=>[{p:[0,-2,0],v:[0,1.2,0]}]},
    {k:'inout',label:'Inside / outside',title:'Same charge: gyrates inside the tube, nearly free outside',make:p=>[{p:[p.Rm,0,0],v:[.5,0,1.5],r:.08},{p:[p.Rm+p.r+.8,0,0],v:[0,0,1.5],r:.08,qmRef:[p.Rm,0,0]}]}],
  uniform:[
    {k:'pair',label:'± pair',title:'+ and − with the same start: equal circles, opposite senses',plane:'perpB',make:()=>{const {e1}=basisOf(Bhat());return [{p:[0,0,0],v:e1.clone().multiplyScalar(2).toArray()},{p:[0,0,0],v:e1.clone().multiplyScalar(2).toArray(),sign:-1}]}},
    {k:'helix',label:'Helix',title:'Velocity tilted towards B: a helix',plane:'xy',make:()=>{const b=Bhat(),{e1}=basisOf(b),c=Math.cos(.26),s=Math.sin(.26);return [{p:b.clone().multiplyScalar(-5).toArray(),v:e1.clone().multiplyScalar(2.5*c).addScaledVector(b,2.5*s).toArray()}]}},
    {k:'fan',label:'Speed fan',title:'Four speeds: nested circles, same period',plane:'perpB',make:()=>{const {e1}=basisOf(Bhat());return [1,2,3,4].map(s=>({p:[0,0,0],v:e1.clone().multiplyScalar(s).toArray()}))}},
    {k:'mass',label:'Mass ratio',title:'q/m and q/3m: radius and period scale with m',plane:'perpB',make:()=>{const {e1}=basisOf(Bhat()),v=e1.clone().multiplyScalar(1.5).toArray();return [{p:[0,0,0],v},{p:[0,0,0],v,qm:cfg.qm0/3}]}},
    {k:'hpair',label:'Helix pair',title:'+ and − helices: opposite handedness',plane:'xy',make:()=>{const b=Bhat(),{e1}=basisOf(b),v=e1.clone().multiplyScalar(2.2).addScaledVector(b,.7).toArray(),p=b.clone().multiplyScalar(-5).toArray();return [{p,v},{p,v,sign:-1}]}}],
  accel:[
    {k:'bunch',label:'Inject bunch',title:'One charge on the design orbit and four offset 5 cm sideways and up/down: they oscillate around it (betatron motion) as the quadrupoles alternately focus and defocus',params:{rf:0},make:()=>accelBeam([[0,0],[.05,0],[-.05,0],[0,.05],[0,-.05]])},
    {k:'acc',label:'Accelerate',title:'RF on: the cavity\'s oscillating electric field adds energy every turn, and the magnets ramp up with the beam (a synchrotron)',params:{rf:35},timeScale:4,make:()=>accelBeam([[0,0],[.03,0],[0,.03]])},
    {k:'beta',label:'Betatron',title:'A single charge 8 cm off the orbit: watch the force flip between QF and QD',params:{rf:0},make:()=>accelBeam([[.08,0]])},
    {k:'vert',label:'Vertical',title:'Offset 8 cm upwards: vertical focusing comes from the other quadrupole type',params:{rf:0},make:()=>accelBeam([[0,.08]])},
    {k:'mom',label:'Momentum spread',title:'Speeds −1 %, 0, +1 %: off-momentum orbits shift (dispersion)',params:{rf:0},make:()=>accelBeam([[0,0,.99],[0,0,1],[0,0,1.01]])},
    {k:'halo',label:'Beam halo',title:'Eight charges on a 6 cm ring around the orbit',params:{rf:0},make:()=>accelBeam(Array.from({length:8},(_,i)=>[.06*Math.cos(i*Math.PI/4),.06*Math.sin(i*Math.PI/4)]))},
    {k:'sign',label:'Wrong sign',title:'A negative charge bends the wrong way and is lost at once',params:{rf:0},make:()=>accelBeam([[0,0],[0,0,1,-1]])},
    {k:'slow',label:'Too slow',title:'5 % below design speed: over-bent, spirals inwards and is lost',params:{rf:0},make:()=>accelBeam([[0,0],[0,0,.95]])}],
};
function accelBeam(list){
  const A=cfg.accel;
  return list.map(([dx,dy,f=1,sign=1])=>({p:[A.R+dx,dy,0],v:[0,0,A.v0*f],sign,qm:A.qm}));
}
function qmFor(s){
  const B=Bat(new THREE.Vector3(...(s.qmRef||s.p)),new THREE.Vector3()),Bm=B.length();
  if(Bm<1e-15)return cfg.qm0;
  const v=new THREE.Vector3(...s.v),b=B.multiplyScalar(1/Bm),vp=v.clone().addScaledVector(b,-v.dot(b)).length()||v.length();
  return vp/(Bm*s.r);
}
// place a charge given in world coordinates, choosing a plane that contains its velocity
function chargeFrom(s,qm){
  const v=new THREE.Vector3(...s.v),sp=v.length(),p=new THREE.Vector3(...s.p);
  const cands=[PART.plane,'xy','yz','zx',...(cfg.uniform?['perpB']:[])].filter(k=>k&&k!=='view');
  let pl=null;
  for(const k of cands){const n=planeNormal(k);if(Math.abs(v.dot(n))<1e-6*Math.max(sp,1)){pl={key:k};break}}
  if(!pl){const n=v.clone().cross(Math.abs(v.y)<.9*sp?Y:X).normalize();pl={key:'view',n}}
  const {e1,e2,n}=basisOf(planeN(pl));
  return makeParticle({sign:s.sign??1,qm,plane:pl,u:p.dot(e1),v:p.dot(e2),w:p.dot(n),s:sp,th:Math.atan2(v.dot(e2),v.dot(e1))});
}
function runPreset(pr){
  if(INS.on)exitInspect();
  for(const a of [...PART.list])removeParticle(a);
  PART.mode='setup';PART.used=true;PART.nextId=1;PART.ramp=1;PART.rfMax=false;PART.turns=0;PART.rampRate=0;PART.rfPh=0;PART.simT=0;PART.scope=[];
  if(pr.params){
    const v=VIS_BY[state.vis],live=k=>v.params.find(d=>d.key===k)?.live;
    const rebuild=Object.entries(pr.params).some(([k,x])=>!live(k)&&P()[k]!==x);
    Object.assign(P(),pr.params);buildParams();if(rebuild)applyVis(false);
  }
  for(const s of pr.make(P(),cfg))chargeFrom(s,s.qm??(s.r?qmFor(s):cfg.qm0));
  if(pr.timeScale)PART.timeScale=pr.timeScale;
  PART.sel=PART.list[0];
  if(pr.plane)setPlane(pr.plane,true);else if(cfg.accel)setPlane('zx',false);
  refreshUI();
}

