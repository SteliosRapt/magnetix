/* =====================================================================
   PHYSICS CORE (runs in a Web Worker)
   Every conductor is a chain of straight segments. The Biot–Savart law
       dB = (μ0/4π) I dl × r̂ / r²
   is integrated exactly over each straight segment and summed:
       B = (μ0 I/4π) (r1 × r2)(|r1|+|r2|) / (|r1||r2|(|r1||r2| + r1·r2))
   with r1, r2 the vectors from the segment ends to the field point.
   Inside the wire (radius RW) the field is smoothly regularised.
   Field lines: RK4 integration along B̂. Seeds: placed at equal-flux
   intervals along straight "rakes" on symmetry planes, so line spacing
   is inversely proportional to |B|.
   ===================================================================== */
function workerCore(){
  let S=null, NS=0, RW=0.03;
  const o=new Float64Array(4);

  function field(px,py,pz){
    let bx=0,by=0,bz=0,dmin=1e30;
    const s=S, a2=RW*RW, e=NS*7;
    for(let j=0;j<e;j+=7){
      const dx=s[j+3],dy=s[j+4],dz=s[j+5];
      const r1x=px-s[j],r1y=py-s[j+1],r1z=pz-s[j+2];
      const r2x=r1x-dx,r2y=r1y-dy,r2z=r1z-dz;
      const L2=dx*dx+dy*dy+dz*dz;
      let t=(r1x*dx+r1y*dy+r1z*dz)/L2; t=t<0?0:(t>1?1:t);
      const qx=r1x-t*dx,qy=r1y-t*dy,qz=r1z-t*dz,q2=qx*qx+qy*qy+qz*qz;
      if(q2<dmin)dmin=q2;
      const m1=Math.sqrt(r1x*r1x+r1y*r1y+r1z*r1z), m2=Math.sqrt(r2x*r2x+r2y*r2y+r2z*r2z);
      const cx=r1y*r2z-r1z*r2y, cy=r1z*r2x-r1x*r2z, cz=r1x*r2y-r1y*r2x;
      const den=m1*m2*(m1*m2+r1x*r2x+r1y*r2y+r1z*r2z);
      if(den<1e-24)continue;
      const p2=(cx*cx+cy*cy+cz*cz)/L2;            // squared distance to the segment's line
      const f=s[j+6]*(m1+m2)/den*(p2/(p2+a2));     // finite wire radius regularisation
      bx+=f*cx; by+=f*cy; bz+=f*cz;
    }
    o[0]=bx*1e-7; o[1]=by*1e-7; o[2]=bz*1e-7; o[3]=Math.sqrt(dmin); // μ0/4π = 1e-7
  }

  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

  function run(seed,dir,d,closeCheck){
    const bx0=d.box.min, bx1=d.box.max, H=d.H;
    const hMin=H*0.0015, hMax=H*0.02, maxLen=d.maxLen, tol0=0.015*H;
    const P=[],M=[];
    let x=seed[0],y=seed[1],z=seed[2],travel=0,closed=false,why='steps',prevD=1e30;
    for(let n=0;n<4000;n++){
      field(x,y,z);
      const m=Math.hypot(o[0],o[1],o[2]);
      P.push(x,y,z); M.push(m);
      if(m<1e-14){why='weak';break}
      if(n>0&&(x<bx0[0]||y<bx0[1]||z<bx0[2]||x>bx1[0]||y>bx1[1]||z>bx1[2])){why='box';break}
      if(travel>maxLen){why='len';break}
      const ah=Math.min(hMax,Math.max(hMin,0.3*o[3])), h=ah*dir;
      const k1x=o[0]/m,k1y=o[1]/m,k1z=o[2]/m;
      field(x+.5*h*k1x,y+.5*h*k1y,z+.5*h*k1z); let mm=Math.hypot(o[0],o[1],o[2])||1e-30;
      const k2x=o[0]/mm,k2y=o[1]/mm,k2z=o[2]/mm;
      field(x+.5*h*k2x,y+.5*h*k2y,z+.5*h*k2z); mm=Math.hypot(o[0],o[1],o[2])||1e-30;
      const k3x=o[0]/mm,k3y=o[1]/mm,k3z=o[2]/mm;
      field(x+h*k3x,y+h*k3y,z+h*k3z); mm=Math.hypot(o[0],o[1],o[2])||1e-30;
      const k4x=o[0]/mm,k4y=o[1]/mm,k4z=o[2]/mm;
      x+=h/6*(k1x+2*k2x+2*k3x+k4x);
      y+=h/6*(k1y+2*k2y+2*k3y+k4y);
      z+=h/6*(k1z+2*k2z+2*k3z+k4z);
      travel+=ah;
      if(closeCheck&&travel>Math.max(8*ah,4*tol0)){
        // close the loop when the line returns to its seed (allowing for small drift)
        const dd=Math.hypot(x-seed[0],y-seed[1],z-seed[2]),loose=Math.max(3*ah,2.5*tol0);
        if(dd<Math.max(1.5*ah,tol0)||(dd<loose&&dd>prevD)){P.push(seed[0],seed[1],seed[2]);M.push(M[0]);closed=true;why='closed';break}
        prevD=dd;
      }
    }
    return {P,M,closed,why};
  }

  function traceLine(seed,d){
    const f=run(seed,1,d,true);
    let P=f.P,M=f.M;
    if(!f.closed&&f.why!=='len'){
      const b=run(seed,-1,d,false), n=b.M.length, P2=[], M2=[];
      for(let i=n-1;i>=1;i--){P2.push(b.P[3*i],b.P[3*i+1],b.P[3*i+2]);M2.push(b.M[i])}
      P=P2.concat(P); M=M2.concat(M);
    }
    if(M.length<3)return null;
    return {p:new Float32Array(P),b:new Float32Array(M),closed:f.closed};
  }

  function compute(d,post){
    S=d.segs; NS=S.length/7; RW=d.rw;
    if(d.seedPts){traceAll(d.seedPts.map(q=>q.slice()),d,post);return}
    // Seed rakes: straight seed lines on symmetry planes. Field lines start at equal
    // flux intervals along them, so spacing between neighbouring lines ∝ 1/|B|.
    const K=600, smp=[];
    for(let r=0;r<d.rakes.length;r++){
      const rk=d.rakes[r], a=rk.a, b=rk.b, n=rk.n;
      const ds=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/K;
      for(let i=0;i<K;i++){
        const t=(i+.5)/K, x=a[0]+(b[0]-a[0])*t, y=a[1]+(b[1]-a[1])*t, z=a[2]+(b[2]-a[2])*t;
        field(x,y,z);
        const v=o[3]<4*RW?0:(o[0]*n[0]+o[1]*n[1]+o[2]*n[2])*ds;
        smp.push({r,i,v});
      }
    }
    // count each closed line once: on each rake use only the crossings in its dominant direction
    const sgn=d.rakes.map((_,r)=>{let pos=0,neg=0;for(const q of smp)if(q.r===r){if(q.v>0)pos+=q.v;else neg-=q.v}return pos>=0.2*neg?1:-1});
    for(const q of smp)q.v*=sgn[q.r];
    // 'flux' mode: weight = flux, so line spacing ∝ 1/|B|.
    // 'even' mode: weight = length, so lines are evenly spaced along each rake
    // (skipping the near-zero fringe so weak stray field doesn't get lines of its own).
    const even=d.mode==='even', vmax=d.rakes.map(()=>0);
    for(const q of smp)if(q.v>vmax[q.r])vmax[q.r]=q.v;
    for(const q of smp)q.w=even?(q.v>0.03*vmax[q.r]?1:0):Math.max(0,q.v);
    const C=new Float64Array(smp.length); let tot=0;
    for(let k=0;k<smp.length;k++){tot+=smp[k].w;C[k]=tot}
    if(tot<=0){post({type:'done',job:d.job});return}
    const seeds=[]; let k=0;
    for(let s=0;s<d.nSeeds;s++){
      const target=(s+.5)/d.nSeeds*tot;
      while(k<smp.length-1&&C[k]<target)k++;
      const q=smp[k], w=Math.max(1e-300,q.w), f=Math.min(1,Math.max(0,(target-(C[k]-w))/w));
      const rk=d.rakes[q.r], t=(q.i+f)/K;
      seeds.push([rk.a[0]+(rk.b[0]-rk.a[0])*t, rk.a[1]+(rk.b[1]-rk.a[1])*t, rk.a[2]+(rk.b[2]-rk.a[2])*t]);
    }
    traceAll(seeds,d,post);
  }
  function traceAll(seeds,d,post){
    let batch=[],bufs=[];
    for(let s=0;s<seeds.length;s++){
      const L=traceLine(seeds[s],d);
      if(L){batch.push(L);bufs.push(L.p.buffer,L.b.buffer)}
      if(batch.length>=6||s===seeds.length-1){
        if(batch.length)post({type:'lines',job:d.job,lines:batch},bufs);
        batch=[];bufs=[];
      }
    }
    post({type:'done',job:d.job});
  }

  if(typeof WorkerGlobalScope!=='undefined'&&self instanceof WorkerGlobalScope){
    self.onmessage=e=>compute(e.data,(m,tr)=>self.postMessage(m,tr||[]));
  }
  // Vector potential of the same segments: A = (μ0 I/4π) d̂ ln((|r1|+|r2|+L)/(|r1|+|r2|−L)).
  // Its time derivative gives the electric field induced by changing currents, E = −∂A/∂t.
  const oa=new Float64Array(3);
  function vpot(px,py,pz){
    let ax=0,ay=0,az=0;const s=S,e=NS*7;
    for(let j=0;j<e;j+=7){
      const dx=s[j+3],dy=s[j+4],dz=s[j+5],L=Math.sqrt(dx*dx+dy*dy+dz*dz);
      const r1x=px-s[j],r1y=py-s[j+1],r1z=pz-s[j+2],r2x=r1x-dx,r2y=r1y-dy,r2z=r1z-dz;
      const m=Math.sqrt(r1x*r1x+r1y*r1y+r1z*r1z)+Math.sqrt(r2x*r2x+r2y*r2y+r2z*r2z);
      const g=s[j+6]/L*Math.log((m+L)/Math.max(m-L,RW*RW/L));
      ax+=g*dx;ay+=g*dy;az+=g*dz;
    }
    oa[0]=ax*1e-7;oa[1]=ay*1e-7;oa[2]=az*1e-7;
  }
  compute.A=(x,y,z)=>{vpot(x,y,z);return oa};
  compute.load=(segs,rw)=>{S=segs;NS=segs.length/7;RW=rw};
  compute.at=(x,y,z)=>{field(x,y,z);return o};
  compute.o=o;
  return compute;
}

