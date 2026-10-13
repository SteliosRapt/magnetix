/* ---------- three.js setup ---------- */
const $=s=>document.querySelector(s);
const view=$('#view');
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
view.prepend(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x1e1e1e);
scene.fog=new THREE.Fog(0x1e1e1e,10,40);
scene.environment=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),0.04).texture;
// perspective for the conductor scenes; orthographic for the uniform field, so that looking
// along a plane gives a true flat projection (circles stay circles, end-on lines become points)
const persp=new THREE.PerspectiveCamera(38,1,0.05,800);
const ortho=new THREE.OrthographicCamera(-1,1,1,-1,0.05,800);
let camera=persp,orthoH=6;
const controls=new OrbitControls(camera,renderer.domElement);
function fitOrtho(){
  const a=persp.aspect||1.5;
  Object.assign(ortho,{left:-orthoH*a,right:orthoH*a,top:orthoH,bottom:-orthoH});ortho.updateProjectionMatrix();
}
controls.enableDamping=true;controls.dampingFactor=.08;controls.autoRotateSpeed=.7;
scene.add(new THREE.HemisphereLight(0xd6e4ff,0x202020,.6));
const dl=new THREE.DirectionalLight(0xffffff,1.2);dl.position.set(5,9,7);scene.add(dl);

new ResizeObserver(()=>{
  const w=view.clientWidth,h=view.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h,false);persp.aspect=w/h;persp.updateProjectionMatrix();fitOrtho();
}).observe(view);

const matMain=new THREE.MeshStandardMaterial({color:0xd4a867,metalness:.9,roughness:.3,envMapIntensity:.8});
const matCirc=new THREE.MeshStandardMaterial({color:0x8c826f,metalness:.7,roughness:.45,envMapIntensity:.5});
const matBatt=new THREE.MeshStandardMaterial({color:0x2c2f34,metalness:.4,roughness:.5,envMapIntensity:.5});
const matTerm=new THREE.MeshStandardMaterial({color:0xd8d8d8,metalness:.9,roughness:.25,envMapIntensity:.8});

const conductor=new THREE.Group();scene.add(conductor);
const lineMesh=new THREE.LineSegments(new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.95,depthWrite:false}));
lineMesh.frustumCulled=false;scene.add(lineMesh);

const MAXA=6000,MAXF=500;
const coneGeo=new THREE.ConeGeometry(.045,.15,10);
const arrowMesh=new THREE.InstancedMesh(coneGeo,new THREE.MeshBasicMaterial({color:0xffffff}),MAXA);
arrowMesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(MAXA*3),3);
arrowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);arrowMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
arrowMesh.frustumCulled=false;arrowMesh.count=0;scene.add(arrowMesh);
const flowMesh=new THREE.InstancedMesh(new THREE.ConeGeometry(.05,.14,10),new THREE.MeshBasicMaterial({color:0xffd9a0}),MAXF);
flowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);flowMesh.frustumCulled=false;flowMesh.count=0;scene.add(flowMesh);

/* ---------- curve helper for tubes ---------- */
function cumOf(P){const n=P.length/3,c=new Float32Array(n);for(let i=1;i<n;i++){const j=3*i;c[i]=c[i-1]+Math.hypot(P[j]-P[j-3],P[j+1]-P[j-2],P[j+2]-P[j-1])}return c}
function segAt(c,s){let lo=0,hi=c.length-2;while(lo<hi){const m=(lo+hi+1)>>1;if(c[m]<=s)lo=m;else hi=m-1}return Math.max(0,lo)}
class PolyCurve extends THREE.Curve{
  constructor(pts,closed){super();const a=closed?pts.concat([pts[0]]):pts;this.P=new Float32Array(a.flat());this.c=cumOf(this.P);this.L=this.c[this.c.length-1]}
  getUtoTmapping(u){return u}
  getPoint(t,target=new THREE.Vector3()){
    const s=t*this.L,i=segAt(this.c,s),P=this.P,j=3*i,d=this.c[i+1]-this.c[i],f=d>0?(s-this.c[i])/d:0;
    return target.set(P[j]+(P[j+3]-P[j])*f,P[j+1]+(P[j+4]-P[j+1])*f,P[j+2]+(P[j+5]-P[j+2])*f);
  }
  getTangent(t,target=new THREE.Vector3()){
    const i=segAt(this.c,t*this.L),P=this.P,j=3*i;
    return target.set(P[j+3]-P[j],P[j+4]-P[j+1],P[j+5]-P[j+2]).normalize();
  }
}

/* ---------- colour ramp (VS Code blues) ---------- */
const STOPS=[[0,[.08,.13,.19]],[.3,[.04,.30,.55]],[.6,[.10,.55,.90]],[.82,[.31,.76,1]],[1,[.88,.96,1]]];
// even-spacing mode: colour alone carries |B|, so every line stays clearly visible
// (VS Code palette: blue → cyan → teal → yellow → orange)
const STOPS_EVEN=[[0,[.17,.33,.62]],[.3,[.31,.62,.95]],[.5,[.31,.79,.69]],[.75,[.86,.86,.67]],[1,[.95,.55,.40]]];
function ramp(t){
  const S=state.display.spacing==='even'?STOPS_EVEN:STOPS;
  for(let i=1;i<S.length;i++)if(t<=S[i][0]){
    const [t0,a]=S[i-1],[t1,b]=S[i],f=(t-t0)/(t1-t0);
    return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];
  }
  return S[S.length-1][1];
}
const lin=c=>Math.pow(c,2.2);
const B_LOG_TOP=6e-5,B_LOG_DEC=3,B_LIN_TOP=4e-5;
function tOf(b){
  if(state.display.scale==='log'){const v=(Math.log10(b+1e-30)-Math.log10(B_LOG_TOP)+B_LOG_DEC)/B_LOG_DEC;return v<0?0:v>1?1:v}
  const v=b/B_LIN_TOP;return v>1?1:v;
}

