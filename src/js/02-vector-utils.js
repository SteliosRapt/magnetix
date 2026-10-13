/* ===================================================================== */
const RW=0.03;
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scl=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return scl(a,1/l)};
function subdiv(pts,closed,maxL){
  const out=[],n=pts.length,m=closed?n:n-1;
  for(let i=0;i<m;i++){
    const a=pts[i],b=pts[(i+1)%n],k=Math.max(1,Math.ceil(Math.hypot(...sub(b,a))/maxL));
    for(let j=0;j<k;j++)out.push(add(a,scl(sub(b,a),j/k)));
  }
  if(!closed)out.push(pts[n-1]);
  return out;
}
const boxOf=(hx,hy,hz)=>({min:[-hx,-hy,-hz],max:[hx,hy,hz]});
const circlePts=(R,y,M)=>{const a=[];for(let i=0;i<M;i++){const f=2*Math.PI*i/M;a.push([R*Math.cos(f),y,-R*Math.sin(f)])}return a};
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

