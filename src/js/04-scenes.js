/* ---------- parameters ---------- */
const m1=v=>v.toFixed(1)+' m', m2=v=>v.toFixed(2)+' m', int=v=>String(Math.round(v));
const prm=(key,label,min,max,step,value,fmt,extra)=>({key,label,min,max,step,value,fmt,...extra});
const pI=()=>prm('I','Current',0.5,20,0.5,5,v=>v.toFixed(1)+' A');
const pN=()=>prm('n','Line density',4,80,1,22,int);
const pPl=()=>prm('planes','Planes',1,6,1,2,int);
// diameters across the coil's interior (each closed line crosses once there), rotated about the
// y-axis and angled so no plane is seen edge-on from the default camera
const axialRakes=(P,E,th0=140,y=0)=>Array.from({length:P},(_,j)=>{const t=th0*Math.PI/180+(j-(P-1)/2)*Math.PI/P,c=Math.cos(t),s=Math.sin(t);return {a:[-E*c,y,-E*s],b:[E*c,y,E*s],n:[0,1,0]}});

/* ---------- visualisations ----------
   circuit:true → the Circuit switch applies. With it off, only the conductor itself enters the
   Biot–Savart sum (an isolated finite segment, a closed ring, an open helix…); with it on, the
   leads, return wire and battery are part of the current path and of the sum. */
const VIS=[
{id:'infwire',item:'Infinite',title:'Infinite wire',params:[pI(),pN()],
 build(p){
  return {phys:[{pts:[[0,-500,0],[0,500,0]],closed:false,I:p.I}],
    display:[{pts:subdiv([[0,-40,0],[0,40,0]],false,.25),closed:false,main:true}],
    rakes:[{a:[-4.6,0,0],b:[4.6,0,0],n:[0,0,1]}],
    box:boxOf(6,4,6)};
 }},
{id:'finwire',item:'Finite',title:'Finite wire',circuit:true,
 params:[pI(),prm('L','Length',1,8,.1,4,m1),prm('W','Return distance',1,6,.1,3.5,m1,{circuitOnly:true}),pN(),prm('levels','Levels',1,9,1,5,int)],
 build(p,st){
  const x0=-p.W/2,x1=p.W/2,y0=-p.L/2,y1=p.L/2;
  const A=[x0,y0,0],B=[x0,y1,0],C=[x1,y1,0],D=[x1,y0,0];
  const rakes=Array.from({length:p.levels},(_,j)=>{const y=p.levels<2?0:p.L/2*.85*(2*j/(p.levels-1)-1);return {a:[x0-2.6,y,0],b:[x0+p.W*.45,y,0],n:[0,0,1]}});
  // whole circuit: rakes that cross both vertical legs, and both horizontal legs, so every side gets its field
  const nv=Math.max(1,Math.round(p.levels*p.W/p.L)),fullRakes=[
    ...Array.from({length:p.levels},(_,j)=>{const y=p.levels<2?0:p.L/2*.8*(2*j/(p.levels-1)-1);return {a:[x0-2.6,y,0],b:[x1+2.6,y,0],n:[0,0,1]}}),
    ...Array.from({length:nv},(_,j)=>{const x=nv<2?0:p.W/2*.7*(2*j/(nv-1)-1);return {a:[x,y0-2.4,0],b:[x,y1+2.4,0],n:[0,0,1]}})];
  if(!st.display.circuit){
    const rk=rakes.map(r=>({a:r.a,b:[x0+2.6,r.b[1],0],n:r.n}));
    return {phys:[{pts:[A,B],closed:false,I:p.I}],display:[{pts:subdiv([A,B],false,.1),closed:false,main:true}],
      rakes:rk,box:{min:[x0-3.2,y0-2.8,-3.6],max:[x0+3.2,y1+2.8,3.6]}};
  }
  return {phys:[{pts:[A,B,C,D],closed:true,I:p.I}],
    display:[{pts:subdiv([A,B],false,.1),closed:false,main:true},{pts:subdiv([B,C,D,A],false,.1),closed:false,main:false}],
    battery:{pos:[x1,0,0],dir:[0,-1,0]},
    rakes:fullRakes,box:boxOf(p.W/2+3.2,p.L/2+2.8,3.6)};
 }},
{id:'random',item:'Random circuit',title:'Random circuit',random:true,
 params:[pI(),prm('K','Complexity',1,6,1,3,int),prm('size','Size',1,3,.1,2,m1),pN()],
 build(p,st){
  const rng=mulberry32(st.seed), g=()=>{let u=0;while(!u)u=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*rng())};
  const K=Math.round(p.K), co=[0,1,2].map(()=>Array.from({length:K},(_,k)=>[g()/(k+1),g()/(k+1)]));
  const M=320; let pts=[];
  for(let i=0;i<M;i++){const t=2*Math.PI*i/M;pts.push(co.map(row=>row.reduce((s,[a,b],k)=>s+a*Math.cos((k+1)*t)+b*Math.sin((k+1)*t),0)))}
  const c=scl(pts.reduce(add,[0,0,0]),1/M);
  pts=pts.map(q=>sub(q,c));
  const R=Math.max(...pts.map(q=>Math.hypot(...q)));
  pts=pts.map(q=>scl(q,p.size/R));
  let A=[0,0,0]; for(let i=0;i<M;i++)A=add(A,crs(pts[i],pts[(i+1)%M]));
  const n=nrm(A), u=nrm(crs(n,Math.abs(n[1])<.9?[0,1,0]:[1,0,0])), v=crs(n,u);
  return {phys:[{pts,closed:true,I:p.I}],display:[{pts,closed:true,main:true}],
    battery:{pos:pts[0],dir:nrm(sub(pts[1],pts[0]))},
    rakes:[{a:scl(u,-p.size*1.6),b:scl(u,p.size*1.6),n},{a:scl(v,-p.size*1.6),b:scl(v,p.size*1.6),n}],
    box:boxOf(p.size*2.1,p.size*2.1,p.size*2.1)};
 }},
{id:'loop',item:'Loop',title:'Circular loop',circuit:true,
 params:[pI(),prm('R','Radius',.5,3,.05,1.5,m2),pN(),pPl()],
 build(p,st){
  const R=p.R,M=Math.max(96,Math.round(R*80)),box=boxOf(R*2.4+1.4,R*2+.9,R*2.4+1.4),rakes=axialRakes(p.planes,R);
  if(!st.display.circuit){
    const c=circlePts(R,0,M);
    return {phys:[{pts:c,closed:true,I:p.I}],display:[{pts:c,closed:true,main:true}],rakes,box};
  }
  const gap=.045,d=Math.asin(gap/R),arc=[];
  for(let i=0;i<=M;i++){const f=d+(2*Math.PI-2*d)*i/M;arc.push([R*Math.cos(f),0,-R*Math.sin(f)])}
  const xc=R*Math.cos(d),xl=R+.5,xb=R+1.4,zb=.3;
  const lead=[[xc,0,gap],[xl,0,gap],[xl+.25,0,zb],[xb,0,zb],[xb,0,-zb],[xl+.25,0,-zb],[xl,0,-gap],[xc,0,-gap]];
  return {phys:[{pts:arc.concat(lead.slice(1,-1)),closed:true,I:p.I}],
    display:[{pts:arc,closed:false,main:true},{pts:subdiv(lead,false,.08),closed:false,main:false}],
    battery:{pos:[xb,0,0],dir:[0,0,-1]},rakes,box};
 }},
{id:'stacked',item:'Stacked loops',title:'Stacked loops',circuit:true,
 params:[pI(),prm('N','Loops',1,20,1,6,int),prm('R','Radius',.5,2.5,.05,1.2,m2),prm('s','Spacing',.06,1,.01,.1,m2),pN(),pPl()],
 build(p,st){
  const N=Math.round(p.N),R=p.R,s=p.s,M=Math.max(72,Math.round(R*70)),ys=k=>(k-(N-1)/2)*s;
  const rakes=axialRakes(p.planes,R),box=boxOf(R*2.6,(N-1)*s/2+R*2,R*2.6);
  if(!st.display.circuit){
    const phys=[],display=[];
    for(let k=0;k<N;k++){const c=circlePts(R,ys(k),M);phys.push({pts:c,closed:true,I:p.I});display.push({pts:c,closed:true,main:true})}
    return {phys,display,rakes,box};
  }
  // in series: each ring has a small gap; a short jumper crosses it up to the next ring
  const d=Math.asin(.045/R),path=[];
  for(let k=0;k<N;k++)for(let i=0;i<=M;i++){const f=d+(2*Math.PI-2*d)*i/M;path.push([R*Math.cos(f),ys(k),-R*Math.sin(f)])}
  const start=path[0],end=path[path.length-1],xr=R+1.2;
  const top=[xr,Math.max(ys(N-1),.5),0],bot=[xr,Math.min(ys(0),-.5),0];
  return {phys:[{pts:path.concat([top,bot]),closed:true,I:p.I}],
    display:[{pts:path,closed:false,main:true},{pts:subdiv([end,top,bot,start],false,.1),closed:false,main:false}],
    battery:{pos:[xr,0,0],dir:[0,-1,0]},rakes,box};
 }},
{id:'infsol',item:'Inf. solenoid',title:'Infinite solenoid',
 params:[pI(),prm('R','Radius',.4,2,.05,1,m2),prm('tpm','Turns per metre',2,12,1,6,v=>v+' /m'),prm('rings','Rings',1,8,1,4,int)],
 build(p){
  // physics: a 40 m helix (≫ radius), so the visible 10 m window behaves as an infinite solenoid
  const R=p.R,n=p.tpm,Y=20,Yv=5,T=Math.round(2*Y*n),phys=[],disp=[];
  const hp=u=>{const f=2*Math.PI*u;return [R*Math.cos(f),-Y+u/n,-R*Math.sin(f)]};
  for(let k=0;k<T;k++){
    const m=Math.abs(-Y+(k+.5)/n)<8?24:10;
    for(let j=0;j<m;j++)phys.push(hp(k+j/m));
  }
  phys.push(hp(T));
  for(let u=(Y-Yv)*n;u<=(Y+Yv)*n+1e-9;u+=1/24)disp.push(hp(u));
  // seeds on concentric circles in the mid cross-section; equal points per area (uniform B inside)
  const K=Math.round(p.rings),seedPts=[[0,0,0]];
  for(let k=1;k<=K;k++){const r=R*.86*k/K,m=6*k;for(let j=0;j<m;j++){const a=2*Math.PI*j/m+k*.37;seedPts.push([r*Math.cos(a),0,r*Math.sin(a)])}}
  return {phys:[{pts:phys,closed:false,I:p.I}],display:[{pts:disp,closed:false,main:true}],
    seedPts,box:boxOf(R+2.6,Yv,R+2.6),view:{dir:[.62,.62,.48],k:2.9}};
 }},
{id:'finsol',item:'Solenoid',title:'Finite solenoid',circuit:true,
 params:[pI(),prm('N','Turns',2,60,1,12,int),prm('R','Radius',.3,2,.05,.8,m2),prm('Ls','Length',.5,8,.1,4,m1),pN(),pPl()],
 build(p,st){
  const N=Math.round(p.N),R=p.R,Ls=p.Ls,m=24,h=[];
  for(let i=0;i<=N*m;i++){const u=i/m,f=2*Math.PI*u;h.push([R*Math.cos(f),-Ls/2+Ls*u/N,-R*Math.sin(f)])}
  const rakes=axialRakes(p.planes,R),box=boxOf(R+3.4,Ls/2+2.6,R+3.4);
  if(!st.display.circuit)return {phys:[{pts:h,closed:false,I:p.I}],display:[{pts:h,closed:false,main:true}],rakes,box};
  const xr=R+1.4,top=[xr,Ls/2,0],bot=[xr,-Ls/2,0],start=h[0],end=h[h.length-1];
  return {phys:[{pts:h.concat([top,bot]),closed:true,I:p.I}],
    display:[{pts:h,closed:false,main:true},{pts:subdiv([end,top,bot,start],false,.1),closed:false,main:false}],
    battery:{pos:[xr,0,0],dir:[0,-1,0]},rakes,box};
 }},
{id:'toroid',item:'Toroid',title:'Toroid',
 params:[pI(),prm('N','Turns',6,80,1,24,int),prm('Rm','Major radius',1,3,.05,2,m2),prm('r','Minor radius',.2,1.2,.05,.6,m2),pN()],
 build(p){
  const N=Math.round(p.N),Rm=p.Rm,r=Math.min(p.r,.8*Rm),m=20,M=N*m,pts=[];
  for(let i=0;i<M;i++){const t=2*Math.PI*i/m,f=t/N,q=Rm+r*Math.cos(t);pts.push([q*Math.cos(f),r*Math.sin(t),q*Math.sin(f)])}
  return {phys:[{pts,closed:true,I:p.I}],display:[{pts,closed:true,main:true}],
    rakes:[-.55,0,.55].map(f=>({a:[-(Rm+r)*1.3,f*r,0],b:[(Rm+r)*1.3,f*r,0],n:[0,0,1]}))
      // plus one across the hole: the winding's net circular current gives an axial field there
      .concat([{a:[-(Rm-r)*.95,0,0],b:[(Rm-r)*.95,0,0],n:[0,1,0]}]),
    box:boxOf(Rm+r+1.3,r+1.3,Rm+r+1.3),maxLen:2*Math.PI*(Rm+r)*1.08};
 }},
{id:'accel',item:'Ring accelerator',title:'Circular accelerator',
 params:[prm('cells','FODO cells',8,16,1,10,int),
   prm('dip','Dipole current',80,120,1,100,v=>Math.round(v)+'% of design'),
   prm('quad','Quadrupole current',0,200,1,100,v=>Math.round(v)+'% of design'),
   prm('rf','RF energy gain / turn',0,60,1,0,v=>Math.round(v)+'% of injection energy',{live:true}),
   prm('k','Field lines per magnet',0,8,1,4,int)],
 build(p){
  // ring of FODO cells: QF · dipole · QD · dipole, quadrupole polarity alternating
  const N=Math.round(p.cells),D=accelDesign(N),Id=D.sD*D.Id*p.dip/100,Iq=D.sQ*D.Iq*p.quad/100,a=ACC_A,k=Math.round(p.k);
  const phys=[],display=[],seedPts=[];
  for(const m of D.mags){
    const loops=magnetLoops(m,m.type==='D'?Id:m.type==='QF'?Iq:-Iq);phys.push(...loops);
    for(const l of loops)display.push({pts:l.pts,closed:true,main:true});
    const {c,r,y}=magnetFrame(m);
    for(let i=0;i<k;i++){   // seeds in each magnet's mid cross-section
      if(m.type==='D')seedPts.push(add(c,scl(r,a*.75*(2*(i+.5)/k-1))));
      else{const f=(i+.5)*2*Math.PI/k;seedPts.push(add(c,add(scl(r,.5*a*Math.cos(f)),scl(y,.5*a*Math.sin(f)))))}
    }
  }
  const Lc=D.Lc,thc=2*Math.PI*.425/N,cav={th:thc,L:.04*Lc,c:[ACC_R*Math.cos(thc),0,ACC_R*Math.sin(thc)],t:[-Math.sin(thc),0,Math.cos(thc)]};
  return {phys,display,seedPts,accel:{R:ACC_R,a,qm:D.qm,v0:D.v0,mags:D.mags,cav,Bd:D.Bd*p.dip/100},
    box:boxOf(ACC_R+1.6,1.6,ACC_R+1.6),maxLen:3,view:{dir:[.25,.85,.47],k:2.25}};
 }},
{id:'uniform',item:'Uniform field',title:'Uniform field',uniform:true,
 params:[prm('B','Field strength',.2,3,.1,1,v=>v.toFixed(1)+' T'),
   prm('tilt','Field tilt',0,90,1,0,v=>Math.round(v)+'°'),
   prm('n','Line density',2,16,1,3,int)],
 build(p){
  // an imposed homogeneous field (no source conductor to integrate)
  const t=p.tilt*Math.PI/180;
  return {phys:[],display:[],uniform:{dir:[Math.sin(t),Math.cos(t),0]},box:boxOf(6,6,6)};
 }},
];
const VIS_BY=Object.fromEntries(VIS.map(v=>[v.id,v]));
const GROUPS=[['wires',['infwire','finwire','random']],['coils',['loop','stacked','infsol','finsol','toroid']],['fields',['uniform']],['accelerators',['accel']]];
const ORDER=GROUPS.flatMap(g=>g[1]);

const state={vis:'finsol',params:{},seed:20261008,
  display:{arrows:true,flow:true,circuit:true,scale:'log',rotate:false,spacing:'flux'}};
for(const v of VIS){state.params[v.id]={};for(const d of v.params)state.params[v.id][d.key]=d.value}
const P=()=>state.params[state.vis];

