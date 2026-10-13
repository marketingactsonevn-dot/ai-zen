import{S as e,b as t,d as n,f as r,i,u as a,v as o,x as s,y as c}from"./index-BPzRJPxW.js";import{B as l,C as u,E as d,F as f,G as p,K as m,M as h,P as g,R as ee,T as _,U as v,W as y,_ as b,a as x,c as S,h as C,i as w,j as T,l as E,m as D,p as te,s as ne,t as re,x as ie,y as O,z as k}from"./three-stage-nn3fpVax.js";import{r as ae}from"./logo-Bqqw4v7J.js";var A={id:9,kicker:`From one flat photo, AI sculpts a koi that can swim.`,scenes:{pipeline:{label:`Six steps to a shape`,prompt:`Spin it, then continue`,aria:`A 3D koi model. Drag or use the arrow keys to rotate it.`,valueText:`Rotated {deg} degrees`,stepsLabel:`Six steps of AI 3D creation`,stepAria:`Step {n}: {name}`,of:`{n} / 6`,orText:`or: “red and white koi, long fins”`,back:`Back side: not in the photo`,steps:[{name:`Photo or text`,short:`Photo / text`,caption:`You give it a photo or a short description. A photo is flat: one side only.`},{name:`Many views (multi-view)`,short:`Many views`,caption:`AI guesses the object from the front, back, top and sides — even parts the photo doesn’t show.`},{name:`Build the shape (mesh)`,short:`Shape`,caption:`The views join into a 3D shape: a shell made of many tiny triangles.`},{name:`Add materials (texture, PBR)`,short:`Materials`,caption:`Texture is the image wrapped around it; PBR adds roughness and bumps so light looks real.`},{name:`Clean mesh, add bones`,short:`Mesh & bones`,caption:`Retopology: tidy a messy mesh into a clean one. Rig: add a skeleton so it can move.`},{name:`Put it to use`,short:`Put it to use`,caption:`Export a 3D file: keep editing in Blender, drop it into a game, or view it in AR.`}],maps:{label:`View each material layer`,items:[`All`,`Color`,`Roughness`,`Bumps`]},uses:{label:`Where to use it`,items:[{name:`Blender`,note:{text:`Blender: free, open-source 3D software for refining the model.`,asOf:`2026-10-12`,source:`t09-blender`}},{name:`Game`,note:`In a game: a clean mesh with bones, so the fish can swim.`},{name:`AR`,note:`AR (augmented reality): the fish appears on a real table through your phone camera.`}]},insight:`AI builds 3D like an assembly line: guess the views, shape the form, add materials, then tidy up for use.`,detail:`What the photo doesn’t show, AI must guess — so the back is sometimes wrong. A 3D artist still needs to check.`,noWebgl:`Still image: six steps turn a koi photo into a 3D model.`},splats:{label:`Sprinkled from real photos`,prompt:`Shoot around the lantern`,title:`A sibling technique`,aria:`A stone lantern built from soft, blurry dabs of color. Drag or use the arrow keys to walk around it.`,valueText:`Standing at {deg} degrees`,shutter:`Take a photo from this angle`,count:`{n}/8 photos`,more:`Walk to an unshot side`,insight:{text:`Gaussian splatting builds 3D from many real photos taken around an object: countless soft dabs of color layered together.`,asOf:`2026-10-12`,source:`t09-3dgs`},detail:`Unlike AI 3D generation, splats only record what was photographed. Any angle not shot stays blurry or empty.`,noWebgl:`Still image: a stone lantern emerges from soft dabs of color, pieced together from many photos around it.`},input:{label:`A good input photo`,prompt:`Fix each photo flaw`,photo:`Your photo`,result:`The AI’s 3D version`,group:`The photo’s flaws`,status:`Fixed {n}/4`,fixes:[{flaw:`Busy background`,fix:`Plain background`},{flaw:`Shot at an angle`,fix:`Shot head-on`},{flaw:`Tail cut off`,fix:`Whole object in frame`},{flaw:`Blocked, glare`,fix:`Clean, clear photo`}],fixAria:`Flaw: “{flaw}”. Tap to fix it: {fix}`,fixedAria:`Fixed: {fix}`,insight:`A good photo for 3D AI: clean, clear, shot head-on, plain background, nothing cut off.`,detail:{text:`The AI’s version usually still needs fixing in Blender (3D modeling software) before real use.`,asOf:`2026-10-12`,source:`brief-2026-10-12`,kind:`opinion`},noWebgl:`Still image: a clear, head-on photo on a plain background gives a cleaner 3D result.`},models:{label:`The 3D workshops`,prompt:`Tap each stone`,group:`Notable AI 3D models`,released:`Released {date}`,items:[{company:`meshy`,model:`Meshy 7`},{company:`hyper3d`,model:`Rodin Gen-2.5`},{company:`tripo`,model:`Tripo P1.0 / H3.1`},{company:`tencent`,model:`Hunyuan 3D 3.1`},{company:`tencent`,model:`Pixal3D`},{company:`microsoft`,model:`TRELLIS.2`}],insight:`Each tool shines in its own way. Try a few with the same photo, then compare the results.`,detail:`The strengths noted here are general opinions; AI changes weekly, so they may be out of date.`,groups:[`Use online`,`Open source, download`]}},quiz:{q:`Why should a photo for 3D AI be clear, head-on and show the whole object?`,options:[`So the file is smaller`,`So AI has less hidden stuff to guess`,`So AI runs faster`,`Because blurry photos are banned`],answer:1,explain:`AI must guess whatever the photo doesn’t show; the clearer and fuller the photo, the fewer wrong guesses.`},summary:`3D AI guesses hidden sides, shapes the form, adds materials — people still tidy up.`,sources:{"t09-3dgs":{title:`3D Gaussian Splatting for Real-Time Radiance Field Rendering`,publisher:`Kerbl, Kopanas, Leimkühler, Drettakis · ACM Transactions on Graphics (SIGGRAPH 2023)`,date:`2023-07`,url:`https://arxiv.org/abs/2308.04079`,note:`The paper that introduced Gaussian splatting.`},"t09-blender":{title:`About Blender`,publisher:`Blender Foundation`,url:`https://www.blender.org/about/`,note:`The Blender Foundation’s about page: Blender is free, open-source 3D software.`}}},j=`
float h3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float n3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`,M=e=>Math.round(e*10)/10;function oe(e,t=12){let n=[];for(let r=0;r<e.length-1;r++){let i=e[Math.max(0,r-1)],a=e[r],o=e[r+1],s=e[Math.min(e.length-1,r+2)];for(let e=0;e<t;e++){let r=e/t,c=r*r,l=c*r,u=(e,t,n,i)=>.5*(2*t+(-e+n)*r+(2*e-5*t+4*n-i)*c+(-e+3*t-3*n+i)*l);n.push([u(i[0],a[0],o[0],s[0]),u(i[1],a[1],o[1],s[1])])}}return n.push(e[e.length-1]),n}function se(e,t,n=0){let r=[],i=[],a=e.length;for(let o=0;o<a;o++){let s=o/(a-1),c=e[Math.max(0,o-1)],l=e[Math.min(a-1,o+1)],u=l[0]-c[0],d=l[1]-c[1],f=Math.hypot(u,d)||1,p=Math.min(1,s/.06)**.6*(1-.82*Math.max(0,(s-.55)/.45)**1.4),m=t/2*p*(.86+.14*Math.sin(s*23+n)*Math.sin(s*7+n*2));r.push([e[o][0]-d/f*m,e[o][1]+u/f*m]),i.push([e[o][0]+d/f*m,e[o][1]-u/f*m])}let o=e=>`${M(e[0])} ${M(e[1])}`;return`M${r.map(o).join(`L`)}L${i.reverse().map(o).join(`L`)}Z`}function ce(e){let t=e.clientWidth,n=e.clientHeight;return t<n*1.05?`tall`:n<330?`short`:`wide`}function le(e,t){e.classList.add(`is-static`),e.append(s(`svg`,{class:`t9-fallback`,viewBox:`0 0 320 200`,role:`img`,"aria-label":t},s(`ellipse`,{class:`fb-sh`,cx:160,cy:168,rx:110,ry:12}),s(`path`,{class:`fb-body`,d:`M250 96c-10-26-60-38-118-30-34 5-62 16-80 30l-30-22c4 16 4 34 0 50l30-20c20 14 50 22 84 24 54 3 104-6 114-32z`}),s(`path`,{class:`fb-red`,d:`M232 80c-16-10-44-12-62-6 10 10 34 14 62 6zM150 70c-18-2-40 2-52 10 16 6 38 4 52-10z`}),s(`circle`,{class:`fb-eye`,cx:236,cy:92,r:3})),c(`p`,{class:`visually-hidden`},t))}var ue=1.1,N=1.72,de=-.6199999999999999,fe=.68,P=2.4,F=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},I=(e,t,n)=>e+(t-e)*n,pe=e=>{let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]};function me(e){return()=>{e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}var he=(e,t,n)=>{let r=Math.imul(e,374761393)+Math.imul(t,668265263)+Math.imul(n,1440662683)|0;return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967296};function ge(e,t,n){let r=Math.floor(e),i=Math.floor(t),a=Math.floor(n),o=e-r,s=t-i,c=n-a,l=o*o*(3-2*o),u=s*s*(3-2*s),d=c*c*(3-2*c),f=(e,t,n)=>he(r+e,i+t,a+n),p=I(f(0,0,0),f(1,0,0),l),m=I(f(0,1,0),f(1,1,0),l),h=I(f(0,0,1),f(1,0,1),l),g=I(f(0,1,1),f(1,1,1),l);return I(I(p,m,u),I(h,g,u),d)}var _e=(.6/1.45)**.6*.5862068965517242**.85,ve=.13;function ye(e){return e**.6*(1-e)**.85/_e*.87+ve*F(.5,1,e)}var L=e=>.035*Math.sin(Math.PI*e)-.01;function R(e,t){let n=ye(e),r=Math.cos(t),i=Math.sin(t),a=Math.sign(r)*Math.abs(r)**.85,o=Math.sign(i)*Math.abs(i)**.9;return[ue-e*N,L(e)+o*n*(i>0?.33:.26),a*n*.285]}function z(e,t){return pe([+(e<.04),t[1]-L(e),t[2]])}function B(e,t,n=1){let r=(ge(e[0]*2.6+4,e[1]*2.6,e[2]*2.6)-.5)*.17+(ge(e[0]*6.5,e[1]*6.5+9,e[2]*6.5)-.5)*.05;return[t[0]*r*n,t[1]*r*n,t[2]*r*n]}function be(e,t,n){let r=Math.min(1.3,Math.max(0,(ue-e)/P));return t*.17*(.1+r*r)*Math.sin(n-r*5.2)}function xe(e){return e<=1?[ue-e*N,L(e),0]:[de-(e-1)*(fe/.35),L(1),0]}var Se=()=>({pos:[],uv:[],au:[],raw:[],part:[],idx:[]});function V(e,t=!0){let n=new x;return n.setAttribute(`position`,new D(e.pos,3)),n.setAttribute(`uv`,new D(e.uv,2)),n.setAttribute(`aU`,new D(e.au,1)),n.setAttribute(`aRaw`,new D(e.raw,3)),n.setAttribute(`aPart`,new D(e.part,1)),e.idx.length&&n.setIndex(e.idx),t&&n.computeVertexNormals(),n}function H(e,t){let n=Se();for(let r=0;r<=e;r++){let i=(r/e)**1.45;for(let e=0;e<=t;e++){let r=R(i,-Math.PI/2+e/t*Math.PI*2);n.pos.push(...r),n.uv.push(i,e/t),n.au.push(i),n.raw.push(...B(r,z(i,r))),n.part.push(0)}}for(let r=0;r<e;r++)for(let e=0;e<t;e++){let i=r*(t+1)+e,a=i+t+1;n.idx.push(i,i+1,a,a,i+1,a+1)}let r=n.pos.length/3,i=R(1,0);n.pos.push(de,L(1),0),n.uv.push(1,.5),n.au.push(1),n.raw.push(...B(i,[-1,0,0],.3)),n.part.push(0);let a=e*(t+1);for(let e=0;e<t;e++)n.idx.push(r,a+e,a+e+1);return n}function Ce(){let e=Se();for(let t of[1,-1]){let n=R(.075,t>0?.42:Math.PI-.42),r=z(.075,n),i=[n[0]+r[0]*.004,n[1]+r[1]*.004,n[2]+r[2]*.004],a=new l(.03,12,8),o=e.pos.length/3,s=a.attributes.position;for(let t=0;t<s.count;t++)e.pos.push(i[0]+s.getX(t),i[1]+s.getY(t)*.9,i[2]+s.getZ(t)*.7),e.uv.push(0,0),e.au.push(.075),e.raw.push(0,0,0),e.part.push(2);let c=a.index;for(let t=0;t<c.count;t++)e.idx.push(o+c.getX(t));a.dispose()}return e}function U(e,t,n,r,i){let a=e.pos.length/3;for(let a=0;a<=n;a++)for(let o=0;o<=r;o++){let s=a/n,c=o/r,l=t(s,c);e.pos.push(...l),e.uv.push(s,c),e.au.push(i(s));let u=ge(l[0]*5,l[1]*5,l[2]*5)-.5;e.raw.push(0,u*.05*s,u*.07*s),e.part.push(1)}for(let t=0;t<n;t++)for(let n=0;n<r;n++){let i=a+t*(r+1)+n,o=i+r+1;e.idx.push(i,o,i+1,i+1,o,o+1)}}function we(e){let t=Se(),n=e?6:10,r=e?10:18,i=(e,t,n,r,i,a)=>(o,s)=>{let c=pe([I(t[0],n[0],s),I(t[1],n[1],s),I(t[2],n[2],s)]),l=r(s)*o;return[e[0]+i[0]*s+c[0]*l,e[1]+i[1]*s+c[1]*l-a*o*o,e[2]+i[2]*s+c[2]*l]};for(let e of[1,-1])U(t,i(R(.24,e>0?-.62:Math.PI+.62),[.2,-.14,e],[-1,-.16,e*.35],e=>.34*(.68+.32*Math.sin(Math.PI*e)),[-.1,0,0],.05),n,r,()=>.24),U(t,i(R(.56,e>0?-1.12:Math.PI+1.12),[-.15,-1,e*.55],[-1,-.45,e*.25],e=>.17*(.75+.25*Math.sin(Math.PI*e)),[-.06,0,0],.02),n-2,r-6,()=>.56);let a=R(.79,-Math.PI/2);return U(t,i([a[0],a[1]+.01,a[2]],[-.25,-1,0],[-1,-.35,0],e=>.12*(.7+.3*Math.sin(Math.PI*e)),[-.06,0,0],0),n-3,r-8,()=>.79),U(t,(e,t)=>{let n=R(I(.3,.68,t),Math.PI/2),r=.16*F(0,.14,t)*(1-.6*t)*(1-.6*F(.85,1,t))+.008,i=pe([-.5,1,0]);return[n[0]+i[0]*r*e,n[1]-.012+i[1]*r*e,n[2]]},n-4,r+6,()=>.48),U(t,(e,t)=>{let n=I(.78,-.72,t),r=fe*(.58+.42*Math.abs(2*t-1)**.75),i=1+.15*e;return[-.5899999999999999-Math.cos(n)*r*e,L(1)+(.5-t)*.06+Math.sin(n)*r*e*i,0]},n+2,r+4,e=>1+.35*e),t}function Te(e,t,n){let r=new x;return r.setAttribute(`position`,new D(e,3)),r.setAttribute(`aU`,new D(t,1)),r.setAttribute(`aRaw`,new D(n,3)),r}function W(e){let t=[],n=[],r=[],i=(e,i)=>(t.push(...e),n.push(i),r.push(0,0,0)),a=(e,t)=>{let n=R(e,t),r=z(e,n);return[n[0]+r[0]*.007,n[1]+r[1]*.007,n[2]+r[2]*.007]},o=e?11:16,s=e?20:28;for(let e=1;e<=o;e++){let t=(e/o)**1.3;for(let e=0;e<s;e++)i(a(t,e/s*Math.PI*2),t),i(a(t,(e+1)/s*Math.PI*2),t)}let c=e?10:14;for(let e=0;e<c;e++){let t=e/c*Math.PI*2;for(let e=0;e<40;e++){let n=(e/40)**1.3,r=((e+1)/40)**1.3;i(a(n,t),n),i(a(r,t),r)}}let l=(e,t)=>{let n=I(.78,-.72,t),r=fe*(.58+.42*Math.abs(2*t-1)**.75);return[-.5899999999999999-Math.cos(n)*r*e,L(1)+(.5-t)*.06+Math.sin(n)*r*e*(1+.15*e),.004]};for(let e=0;e<=6;e++)for(let t=0;t<8;t++)i(l(t/8,e/6),1+.35*t/8),i(l((t+1)/8,e/6),1+.35*(t+1)/8);for(let e of[.5,1])for(let t=0;t<12;t++)i(l(e,t/12),1+.35*e),i(l(e,(t+1)/12),1+.35*e);return Te(t,n,r)}function G(e){let t=me(909),n=e?22:34,r=e?14:20,i=[];for(let e=0;e<=n;e++){let a=[];for(let i=0;i<r;i++){let o=e===0||e===n?0:(t()-.5)*.7,s=e===0?0:(t()-.5)*.7,c=Math.min(1,Math.max(0,((e+o)/n)**1.35)),l=(i+s)/r*Math.PI*2,u=R(c,l),d=z(c,u);a.push({p:[u[0]+d[0]*.008,u[1]+d[1]*.008,u[2]+d[2]*.008],u:c,raw:B(R(c,l),d)})}i.push(a)}let a=[],o=[],s=[],c=(e,t)=>{a.push(...e.p,...t.p),o.push(e.u,t.u),s.push(...e.raw,...t.raw)};for(let e=0;e<=n;e++)for(let a=0;a<r;a++){let o=i[e][a],s=i[e][(a+1)%r];if(e>0&&c(o,s),e<n){let n=i[e+1][a],l=i[e+1][(a+1)%r];c(o,n),t()<.5?c(o,l):c(s,n)}}return Te(a,o,s)}function K(e){let t=V(H(e?44:76,e?24:40)),n=e?24:40,r=t.attributes.normal,i=(e?44:76)+1;for(let e=0;e<i;e++){let t=e*(n+1),i=t+n,a=new y(r.getX(t)+r.getX(i),r.getY(t)+r.getY(i),r.getZ(t)+r.getZ(i)).normalize();r.setXYZ(t,a.x,a.y,a.z),r.setXYZ(i,a.x,a.y,a.z)}return{body:Ee(t,V(Ce())),fins:V(we(e)),wireQuad:W(e),wireRaw:G(e)}}function Ee(e,t){let n=new x;for(let r of Object.keys(e.attributes)){let i=e.attributes[r],a=t.attributes[r],o=new Float32Array(i.array.length+a.array.length);o.set(i.array),o.set(a.array,i.array.length),n.setAttribute(r,new w(o,i.itemSize))}let r=e.index.array,i=t.index.array,a=e.attributes.position.count,o=new Uint32Array(r.length+i.length);o.set(r);for(let e=0;e<i.length;e++)o[r.length+e]=i[e]+a;return n.setIndex(new w(o,1)),e.dispose(),t.dispose(),n}var De=`
uniform float uSwim;
uniform float uPhase;
float koiS(float x) { return clamp((${ue.toFixed(3)} - x) / ${P.toFixed(3)}, 0.0, 1.3); }
vec3 koiBend(vec3 p) {
  float s = koiS(p.x);
  p.z += uSwim * 0.17 * (0.1 + s * s) * sin(uPhase - s * 5.2);
  return p;
}
float koiSlope(float x) {
  float s = koiS(x);
  float d = uSwim * 0.17 * (2.0 * s * sin(uPhase - s * 5.2) - 5.2 * (0.1 + s * s) * cos(uPhase - s * 5.2));
  return -d / ${P.toFixed(3)};
}`,Oe=`
float leafMask(vec3 o) {
  vec2 q = (o.xy - vec2(0.22, 0.0)) * mat2(0.94, 0.34, -0.34, 0.94);
  float l = length(q * vec2(1.0, 1.9));
  return (1.0 - smoothstep(0.15, 0.2, l)) * smoothstep(0.0, 0.06, o.z);
}`,ke=`
${De}
${Oe}
uniform float uNoise;
uniform float uDent;
attribute vec3 aRaw;
attribute float aU;
attribute float aPart;
varying vec3 vN;
varying vec3 vW;
varying vec3 vO;
varying vec2 vUv;
varying float vU;
varying float vPart;
void main() {
  vO = position;
  vUv = uv;
  vU = aU;
  vPart = aPart;
  vec3 p = koiBend(position + aRaw * uNoise - normal * uDent * leafMask(position) * 0.07);
  float k = koiSlope(position.x);
  vec3 n = normalize(vec3(normal.x - k * normal.z, normal.y, normal.z));
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,Ae=`
uniform vec3 uWhite;
uniform vec3 uRed;
uniform vec3 uInk;
uniform vec3 uShade;
uniform vec3 uClay;
uniform vec3 uRim;
uniform vec3 uSpecC;
uniform vec3 uLight;
uniform float uRimA;
uniform float uFacet;
uniform float uPaint;
uniform float uForm;
uniform vec4 uMapW;
uniform float uSketch;
uniform float uAlpha;
uniform float uGlare;
uniform float uCut;
uniform float uSolid;
uniform vec3 uLeafC;
varying vec3 vN;
varying vec3 vW;
varying vec3 vO;
varying vec2 vUv;
varying float vU;
varying float vPart;
${j}
${Oe}
// Koi scales: staggered columns of discs, each one's free (tail-side) edge lying over the next column, so the
// eye reads overlapping crescents. Smaller toward head and tail. x = relief (rises toward the free edge), y = edge line.
vec2 koiScales(vec2 uv) {
  float u = uv.x;
  float gx = (u + 0.055 * sin(6.2832 * u)) * 25.0;
  float gy = uv.y * 30.0;
  float c = floor(gx);
  const float R = 1.18;
  // the column in front (toward the head) lies on top
  float c0 = c - 1.0;
  float o0 = 0.5 * mod(c0, 2.0);
  float d0 = length(vec2(gx - c0, fract(gy - o0 + 0.5) - 0.5));
  float o1 = 0.5 * mod(c, 2.0);
  float d1 = length(vec2(gx - c, fract(gy - o1 + 0.5) - 0.5));
  float d = d0 < R ? d0 : d1;
  float h = smoothstep(0.0, R, d) * (1.0 - smoothstep(R - 0.09, R, d));
  float edge = smoothstep(R - 0.16, R - 0.02, d) * (1.0 - smoothstep(R - 0.02, R, d));
  float k = smoothstep(0.1, 0.2, u) * smoothstep(1.0, 0.92, u);
  return vec2(h, edge) * k;
}
void main() {
  bool fin = vPart > 0.5 && vPart < 1.5;
  bool eye = vPart > 1.5;
  if (vO.x < uCut) discard;
  // dissolve in (mesh being formed), with an ink edge
  float fn = n3(vO * 5.0 + 2.0);
  float thr = uForm * 1.2 - 0.1;
  if (fn > thr) discard;
  float formEdge = smoothstep(thr - 0.07, thr, fn) * step(uForm, 0.999);

  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 fnrm = normalize(cross(dFdx(vW), dFdy(vW)));
  n = normalize(mix(n, fnrm, uFacet));

  // paint sweeps from head to tail with a ragged, wet edge
  float E = uPaint * 1.65 - 0.25;
  float en = n3(vO * 7.0) - 0.5;
  float pm = 1.0 - smoothstep(E - 0.06, E + 0.02, vU + en * 0.14);
  float wet = smoothstep(E - 0.14, E - 0.03, vU + en * 0.14) * pm;

  // kohaku pattern: vermilion islands on the back, a cap on the head, white flanks and belly
  float top = smoothstep(0.0, 0.11, vO.y);
  float pn = n3(vO * vec3(2.2, 3.0, 3.0) + vec3(3.1, 0.0, 0.0)) * 0.75 + n3(vO * 6.0 + 11.0) * 0.25;
  float red = smoothstep(0.5, 0.535, pn) * top;
  float cap = smoothstep(0.16, 0.11, length((vO.xz - vec2(0.82, 0.0)) * vec2(1.0, 1.3))) * smoothstep(0.02, 0.09, vO.y);
  red = max(red, cap) * smoothstep(1.06, 0.99, vO.x) * smoothstep(${(-.5799999999999998).toFixed(3)}, ${(-.45999999999999985).toFixed(3)}, vO.x);
  float rays = 0.0;
  if (fin) {
    red = 0.0;
    rays = 1.0 - smoothstep(0.0, 0.32, abs(fract(vUv.y * 13.0) - 0.5) * 2.0);
    rays *= smoothstep(0.05, 0.25, vUv.x);
  }
  vec2 sc = fin || eye ? vec2(0.0) : koiScales(vUv);
  float scl = sc.x;
  // a bad photo bakes its flaws into the texture: a blown-out glare streak that wipes the pattern, the leaf that hid the flank
  vec2 gq = (vO.xy - vec2(0.62, 0.11)) * mat2(0.8, -0.6, 0.6, 0.8);
  float gl = uGlare * (1.0 - smoothstep(0.2, 0.3, length(gq * vec2(1.0, 4.2)))) * smoothstep(0.0, 0.05, vO.z + 0.06);
  float lf = fin || eye ? 0.0 : uGlare * leafMask(vO);
  red *= 1.0 - gl;

  vec3 painted = eye ? uInk : fin ? mix(uWhite, uShade, rays * 0.35 + vUv.x * 0.08) : mix(uWhite, uRed, red);
  // the scale edges: a faint sheen in colour, never a grid
  painted *= 1.0 - sc.y * mix(0.025, 0.05, red);
  float rough = eye ? 0.15 : fin ? 0.62 : mix(0.34, 0.28, red) + (0.5 - scl) * 0.06;
  vec3 albedo = mix(uClay, painted, pm);
  albedo = mix(albedo, albedo * 0.82, wet * 0.6);
  rough = mix(0.92, rough, pm);
  // "solid" viewport look while the topology is being worked on
  albedo = mix(albedo, mix(uClay, uWhite, 0.55), uSolid);
  rough = mix(rough, 0.8, uSolid);
  float lfVein = lf * (1.0 - smoothstep(0.0, 0.012, abs((vO.y - 0.0) - (vO.x - 0.22) * 0.36)));
  albedo = mix(albedo, uLeafC, lf * 0.88);
  albedo = mix(albedo, uLeafC * 0.7, lfVein * 0.6);
  albedo = mix(albedo, uWhite * 1.18 + 0.06, gl);
  rough = mix(rough, 0.08, gl);

  // relief from the scales
  vec3 dpx = dFdx(vW), dpy = dFdy(vW);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  float hb = scl * pm * (1.0 - uSolid) * (1.0 - lf) * 0.0021; // world-space relief height
  vec3 grad = sign(det) * (dFdx(hb) * r1 + dFdy(hb) * r2);
  vec3 nb = normalize(abs(det) * n - grad);
  vec3 nb2 = normalize(abs(det) * n - grad * 6.5);

  vec3 L = normalize(uLight);
  vec3 V = normalize(cameraPosition - vW);
  float diff = smoothstep(-0.5, 1.0, dot(nb, L));
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(nb, H), 0.0), mix(110.0, 7.0, rough)) * (1.0 - rough) * 1.25;
  float fres = pow(1.0 - max(dot(n, V), 0.0), 2.5);

  vec3 lit = albedo * mix(uShade, vec3(1.0), diff) + uSpecC * spec;
  lit = mix(lit, uRim, fres * uRimA);
  vec3 colOnly = albedo * (0.86 + 0.14 * diff);
  vec3 roughV = mix(vec3(0.06), vec3(0.88), rough) * (0.8 + 0.2 * diff);
  vec3 bumpV = mix(vec3(0.3), vec3(0.92), smoothstep(-0.4, 1.0, dot(nb2, L)));
  vec3 col = lit * uMapW.x + colOnly * uMapW.y + roughV * uMapW.z + bumpV * uMapW.w;
  col = mix(col, uInk, formEdge * 0.85);

  float a = uAlpha;
  if (fin) a *= mix(0.94, (0.5 + rays * 0.3) * (1.0 - 0.35 * smoothstep(0.75, 1.0, vUv.x)), pm * uMapW.x) ;

  if (uSketch > 0.5) {
    float fs = pow(1.0 - max(dot(normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), V), 0.0), 1.6);
    float ds = smoothstep(-0.2, 1.0, dot(normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), L));
    float line = fin ? 0.1 + rays * 0.3 + fs * 0.25 : smoothstep(0.45, 0.95, fs) * 0.95;
    float shade = fin ? 0.0 : (1.0 - ds) * 0.3;
    if (eye) line = 1.0;
    gl_FragColor = vec4(clamp(line, 0.0, 1.0), red, shade, fin ? 0.55 : 1.0);
    return;
  }
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`,je=`
${De}
uniform float uNoise;
attribute vec3 aRaw;
attribute float aU;
varying float vU;
void main() {
  vU = aU;
  vec3 p = koiBend(position + aRaw * uNoise);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,Me=`
uniform vec3 uColor;
uniform float uOpacity;
uniform float uReveal;
varying float vU;
void main() {
  float r = 1.0 - smoothstep(uReveal * 1.5 - 0.15, uReveal * 1.5, vU);
  if (r < 0.01) discard;
  gl_FragColor = vec4(uColor, uOpacity * r);
  #include <colorspace_fragment>
}`,Ne=class{group=new C;body;fins;wireRaw;wireQuad;U;bodyMat;finMat;rawMat;quadMat;constructor(e){let t=K(e);this.U={uSwim:{value:0},uPhase:{value:0},uNoise:{value:0},uWhite:{value:new S},uRed:{value:new S},uInk:{value:new S},uShade:{value:new S},uClay:{value:new S},uRim:{value:new S},uSpecC:{value:new S},uLight:{value:new y(-.5,1,.65)},uRimA:{value:0},uFacet:{value:0},uPaint:{value:1},uForm:{value:1},uMapW:{value:new p(1,0,0,0)},uSketch:{value:0},uAlpha:{value:1},uGlare:{value:0},uCut:{value:-9},uSolid:{value:0},uDent:{value:0},uLeafC:{value:new S}};let n=e=>new k({vertexShader:ke,fragmentShader:Ae,uniforms:this.U,transparent:e,side:2,depthWrite:!e});this.bodyMat=n(!1),this.bodyMat.side=0,this.finMat=n(!0);let r=e=>new k({vertexShader:je,fragmentShader:Me,transparent:!0,depthWrite:!1,uniforms:{uSwim:this.U.uSwim,uPhase:this.U.uPhase,uNoise:this.U.uNoise,uColor:{value:new S(e)},uOpacity:{value:0},uReveal:{value:1}}});this.rawMat=r(`#000`),this.quadMat=r(`#000`),this.body=new _(t.body,this.bodyMat),this.fins=new _(t.fins,this.finMat),this.wireRaw=new ie(t.wireRaw,this.rawMat),this.wireQuad=new ie(t.wireQuad,this.quadMat),this.body.renderOrder=2,this.fins.renderOrder=3,this.wireRaw.renderOrder=4,this.wireQuad.renderOrder=4,this.group.add(this.body,this.fins,this.wireRaw,this.wireQuad),this.group.traverse(e=>void(e.frustumCulled=!1))}set rawOpacity(e){this.rawMat.uniforms.uOpacity.value=e,this.wireRaw.visible=e>.003}set quadOpacity(e){this.quadMat.uniforms.uOpacity.value=e}set quadReveal(e){this.quadMat.uniforms.uReveal.value=e,this.wireQuad.visible=e>.003&&this.quadMat.uniforms.uOpacity.value>.003}theme(){let e=r.theme===`dark`,t=e=>new S(a(e)),n=this.U;n.uWhite.value=t(e?`--ink`:`--card`),n.uRed.value=t(`--vermilion`),n.uInk.value=t(e?`--paper`:`--ink`),n.uShade.value=e?t(`--stone`).multiplyScalar(.9):t(`--stone`),n.uClay.value=t(e?`--stone`:`--stone-2`),n.uRim.value=t(e?`--moss`:`--card`),n.uSpecC.value=e?t(`--ink`).multiplyScalar(.8):new S(1,.98,.94),n.uRimA.value=e?.55:.3,n.uLeafC.value=t(`--moss-2`),this.rawMat.uniforms.uColor.value=t(`--ink-2`),this.quadMat.uniforms.uColor.value=t(`--moss`)}},q=A.scenes.pipeline,Pe={card:1,slot:0,ring:0,collapse:0,dust:0,dustP:0,form:0,noise:1,facet:1,paint:0,raw:0,quad:0,bones:0,swim:0,use:0,fit:1.3,fitW:1.05,shadow:0,zen:.7,solid:0},Fe=[{card:1,slot:0,ring:0,collapse:0,dust:0,dustP:0,form:0,noise:1,facet:1,paint:0,raw:0,quad:0,bones:0,swim:0,use:0,fit:1.3,fitW:1.05,shadow:0,zen:.45,solid:0},{card:1,slot:1,ring:1,collapse:0,dust:.7,dustP:0,form:0,noise:1,facet:1,paint:0,raw:0,quad:0,bones:0,swim:0,use:0,fit:1.95,fitW:2.72,shadow:0,zen:.45,solid:0},{card:0,slot:1,ring:0,collapse:1,dust:0,dustP:1,form:1,noise:.9,facet:1,paint:0,raw:.85,quad:0,bones:0,swim:0,use:0,fit:1.18,fitW:1.3,shadow:1,zen:1,solid:0},{card:0,slot:1,ring:0,collapse:1,dust:0,dustP:1,form:1,noise:.15,facet:0,paint:1,raw:.14,quad:0,bones:0,swim:0,use:0,fit:1.18,fitW:1.3,shadow:1,zen:1,solid:0},{card:0,slot:1,ring:0,collapse:1,dust:0,dustP:1,form:1,noise:0,facet:0,paint:1,raw:0,quad:1,bones:1,swim:.55,use:0,fit:1.18,fitW:1.3,shadow:1,zen:1,solid:.9},{card:0,slot:1,ring:0,collapse:1,dust:0,dustP:1,form:1,noise:0,facet:0,paint:1,raw:0,quad:0,bones:0,swim:1,use:1,fit:2.05,fitW:2.1,shadow:1,zen:0,solid:0}],Ie=[{},{slot:[1.6,0],ring:[1.8,.5],dust:[2,.9],fit:[1.8,0],fitW:[1.8,0]},{collapse:[1.5,0],card:[1,.4],dustP:[2.4,.1],form:[2,1],dust:[1.2,2.3],raw:[1.2,2.4],shadow:[1.6,1],fit:[1.8,.2]},{paint:[2.8,0],noise:[2.2,.2],facet:[2.2,.2],raw:[1.6,.4]},{raw:[.9,0],solid:[1,0],quad:[1.8,.4],noise:[1.4,.5],facet:[1.4,.5],bones:[1.4,1.6],swim:[2,2.8]},{quad:[.8,0],bones:[.8,0],solid:[1.4,.3],swim:[1.4,.2],use:[2.6,.1],fit:[2.4,.1],zen:[1.2,0]}],Le=[.06,.42,.34,.3,.3,.7],Re=2,ze=[0,1,2,3,4,5].map(e=>{let t=e*2*Math.PI/6;return[Math.sin(t)*Re,-.1,Math.cos(t)*Re]}),Be=[[.18,.28,1],[.95,.3,.45],[.32,1,.5],[-.2,.25,-1],[-.85,.42,-.5],[.55,.45,-.8]],Ve=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,He=`
uniform sampler2D uTex;
uniform float uSketch;
uniform float uAlpha;
uniform float uSeed;
uniform float uShadeK;
uniform float uTexel;
uniform vec3 uPaperC;
uniform vec3 uPaper2;
uniform vec3 uInkC;
uniform vec3 uRedC;
uniform vec3 uEdgeC;
varying vec2 vUv;
${j}
void main() {
  vec2 p = (vUv - 0.5) * vec2(1.6, 1.2);
  vec2 q = abs(p) - vec2(0.77, 0.57);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.02;
  d += (n3(vec3(vUv * vec2(48.0, 36.0), uSeed)) - 0.5) * 0.02;
  float a = 1.0 - smoothstep(-0.004, 0.004, d);
  if (a * uAlpha < 0.01) discard;
  float fibre = n3(vec3(vUv * vec2(160.0, 120.0), uSeed + 3.0));
  float vig = smoothstep(0.95, 0.15, length((vUv - 0.5) * vec2(1.3, 1.5)));
  vec3 bg = mix(uPaper2, uPaperC, vig * 0.85 + 0.15);
  vec3 col = bg;
  if (gl_FrontFacing) {
    vec2 iuv = (vUv - 0.5) / 0.9 + 0.5;
    float inside = step(0.0, iuv.x) * step(iuv.x, 1.0) * step(0.0, iuv.y) * step(iuv.y, 1.0);
    vec4 t = texture2D(uTex, iuv) * inside;
    if (uSketch > 0.5) {
      // sumi-e: a pale uneven wash for the body, a second wash on the shadow side, red dabbed loosely
      // over the patches, then one ink contour traced round the silhouette with a wobbling brush
      float grain = 0.7 + 0.3 * fibre;
      float pool = n3(vec3(iuv * 5.0, uSeed));
      col = mix(bg, uInkC, t.a * (0.1 + 0.09 * pool));
      col = mix(col, uInkC, clamp(t.b * uShadeK, 0.0, 1.0) * 0.2 * grain);
      vec2 jit = (vec2(n3(vec3(iuv * 7.0, uSeed + 1.0)), n3(vec3(iuv * 7.0, uSeed + 2.0))) - 0.5) * 0.035;
      float red = texture2D(uTex, iuv + jit).g * inside;
      col = mix(col, uRedC, smoothstep(0.2, 0.6, red) * (0.62 + 0.25 * pool) * grain);
      float rr = (1.3 + 1.4 * n3(vec3(iuv * 11.0, uSeed + 5.0))) * uTexel;
      float mn = 1.0, mx = 0.0;
      for (int k = 0; k < 8; k++) {
        float ang = float(k) * 0.7853982;
        float sa = texture2D(uTex, iuv + vec2(cos(ang), sin(ang)) * rr).a;
        mn = min(mn, sa);
        mx = max(mx, sa);
      }
      float contour = smoothstep(0.3, 0.8, mx - mn);
      col = mix(col, uInkC, clamp(contour * 0.88 + t.r * 0.45, 0.0, 1.0) * grain);
    } else {
      col = bg * (1.0 - t.a) + t.rgb;
    }
  } else {
    col = mix(bg, uEdgeC, 0.08 + 0.06 * fibre);
  }
  col = mix(col, uEdgeC, smoothstep(-0.035, 0.0, d) * 0.45 + (fibre - 0.5) * 0.04);
  gl_FragColor = vec4(col, a * uAlpha);
  #include <colorspace_fragment>
}`,Ue=`
uniform float uProg;
uniform float uTime;
uniform float uSize;
uniform float uScale;
attribute vec3 aStart;
attribute float aDelay;
varying float vA;
void main() {
  float k = clamp((uProg - aDelay * 0.5) / 0.5, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  vec3 drift = vec3(sin(uTime * 0.6 + aDelay * 40.0), cos(uTime * 0.5 + aDelay * 31.0), sin(uTime * 0.55 + aDelay * 23.0)) * 0.05 * (1.0 - k);
  vec3 p = mix(aStart + drift, position, k);
  p.y += sin(k * 3.14159) * 0.3 * (aDelay - 0.35);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uScale * (0.5 + aDelay) / -mv.z;
  vA = 0.55 + 0.45 * sin(uTime * 1.6 + aDelay * 60.0);
}`,We=`
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 14.0);
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor, a * vA * uOpacity);
  #include <colorspace_fragment>
}`,Ge=`
varying vec2 vP;
void main() {
  vP = vec2(position.x, -position.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,Ke=`
uniform vec3 uInkC;
uniform vec3 uMossC;
uniform vec3 uVermC;
uniform vec3 uWaterC;
uniform vec3 uTableC;
uniform vec3 uShadowC;
uniform float uTime;
uniform float uShadow;
uniform float uCardSh;
uniform float uZen;
uniform float uGrid;
uniform float uPond;
uniform float uTable;
uniform float uDark;
uniform vec2 uKoi;
uniform vec2 uDir;
uniform vec2 uFade;
varying vec2 vP;
${j}
vec4 acc = vec4(0.0);
void over(vec3 c, float a) { acc = vec4(c * a, a) + acc * (1.0 - a); }
float ln(float c, float w) { float d = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), 1e-4); return 1.0 - min(d / w, 1.0); }
float ring(float r, float R) { return 1.0 - smoothstep(0.0, 1.3 * fwidth(r), abs(r - R)); }
void main() {
  vec2 p = vP;
  float r = length(p);
  float wob = n3(vec3(p * 2.2, 1.0)) - 0.5;
  // desk (AR): a soft-edged table top with a faint grain
  if (uTable > 0.001) {
    vec2 q = abs(p) - vec2(2.0, 1.35);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.35;
    float a = (1.0 - smoothstep(-0.25, 0.15, d + wob * 0.12)) * uTable;
    float grain = sin(p.y * 46.0 + sin(p.x * 2.3) * 1.6 + n3(vec3(p * vec2(0.6, 9.0), 4.0)) * 3.0);
    over(mix(uTableC, uShadowC, smoothstep(0.6, 1.0, grain) * 0.08), a * 0.85);
  }
  // pond: water with an ink-wash shore
  if (uPond > 0.001) {
    float edge = 1.62 + wob * 0.14;
    float a = (1.0 - smoothstep(edge - 0.05, edge + 0.05, r)) * uPond;
    float shore = smoothstep(edge - 0.45, edge, r) * a;
    over(mix(uWaterC, uMossC, shore * 0.55), a * (0.5 + 0.25 * shore));
    float dk = length(p - uKoi);
    float rip = smoothstep(0.82, 1.0, sin(dk * 22.0 - uTime * 2.2)) * exp(-dk * 1.4) * (1.0 - smoothstep(edge - 0.2, edge, r));
    over(uDark > 0.5 ? uMossC : uInkC, rip * 0.22 * uPond);
  }
  // Blender: a fading grid with red X and green Y axes
  if (uGrid > 0.001) {
    float fade = (1.0 - smoothstep(1.0, 2.7, r)) * uGrid;
    float g = max(ln(p.x * 4.0, 1.0), ln(p.y * 4.0, 1.0)) * 0.22 + max(ln(p.x, 1.4), ln(p.y, 1.4)) * 0.3;
    over(uInkC, g * fade * 0.7);
    float ax = 1.0 - smoothstep(0.0, 1.6 * fwidth(p.y), abs(p.y));
    float az = 1.0 - smoothstep(0.0, 1.6 * fwidth(p.x), abs(p.x));
    over(uVermC, ax * fade * 0.85);
    over(uMossC, az * fade * 0.85);
  }
  // the work rests on an ink-wash pool (pigment gathered at its ragged edge) ringed by three brushed ensō;
  // all of it thins away before the stepping stones
  float zf = uZen * (1.0 - uPond) * smoothstep(uFade.x, uFade.y, gl_FragCoord.y);
  if (zf > 0.001) {
    float th = atan(p.y, p.x);
    vec3 ca = vec3(cos(th), sin(th), 0.0);
    float pr = 1.1 + (n3(ca * 1.7 + vec3(0.0, 0.0, 3.0)) - 0.5) * 0.34 + wob * 0.08;
    float inPool = 1.0 - smoothstep(pr - 0.02, pr + 0.03, r);
    float bloom = smoothstep(pr - 0.26, pr - 0.01, r) * inPool;
    over(uDark > 0.5 ? uMossC : uInkC, (inPool * 0.022 + bloom * bloom * 0.04) * zf);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float R = 1.42 + fi * 0.18;
      float tt = mod(th - fi * 2.3 + 12.566, 6.2832) / 6.2832; // 0 where this stroke starts
      float press = smoothstep(0.0, 0.035, tt) * (1.0 - smoothstep(0.8, 0.95, tt));
      float w = (0.026 - fi * 0.006) * (0.45 + 0.55 * press) * (0.75 + 0.5 * n3(ca * 3.0 + vec3(0.0, 0.0, fi * 5.0)));
      float rr = r + wob * 0.03 + (n3(ca * 2.0 + vec3(0.0, 0.0, fi + 9.0)) - 0.5) * 0.05;
      float d = abs(rr - R);
      float core = 1.0 - smoothstep(w * 0.45, w, d);
      float bristle = n3(vec3(th * 22.0, (rr - R) / max(w, 1e-3) * 5.0, fi * 7.0));
      float dry = mix(1.0, smoothstep(0.3, 0.62, bristle), 0.3 + 0.6 * tt);
      over(uInkC, core * dry * press * zf * (0.2 - fi * 0.045));
    }
  }
  // the photo's shadow, then the koi's
  if (uCardSh > 0.001) {
    float d = length(p * vec2(1.0 / 0.9, 1.0 / 0.26));
    over(uShadowC, pow(max(0.0, 1.0 - d), 1.6) * uCardSh * 0.22);
  }
  if (uShadow > 0.001) {
    vec2 q = p - uKoi;
    vec2 l = vec2(dot(q, uDir), dot(q, vec2(-uDir.y, uDir.x)));
    float d = length(l * vec2(1.0 / 1.05, 1.0 / 0.3));
    over(uShadowC, pow(max(0.0, 1.0 - d), 1.4) * uShadow * (uDark > 0.5 ? 0.55 : 0.2));
  }
  if (acc.a < 0.004) discard;
  gl_FragColor = vec4(acc.rgb / acc.a, acc.a);
  #include <colorspace_fragment>
}`,qe=(e,t)=>t+Math.round((e-t)/(Math.PI*2))*Math.PI*2;function Je(e){let p=e.quality===`low`,b=c(`div`,{class:`t9 t9p`}),E=c(`div`,{class:`t9-stage`,tabindex:`0`,role:`slider`,"aria-label":q.aria,"aria-valuemin":`0`,"aria-valuemax":`360`,"aria-valuenow":`0`,"aria-valuetext":o(q.valueText,{deg:0})}),ae=c(`p`,{class:`t9p-num`}),A=c(`h2`,{class:`t9p-title`}),j=c(`p`,{class:`t9p-text`}),M=c(`p`,{class:`t9p-note`}),ue=q.maps.items.map((e,t)=>c(`button`,{class:`t9-chip`,type:`button`,"aria-pressed":String(t===0),onClick:()=>Xt(t)},e)),N=q.uses.items.map((e,t)=>c(`button`,{class:`t9-chip`,type:`button`,"aria-pressed":String(t===1),onClick:()=>Zt(t)},e.name)),de=c(`div`,{class:`t9p-chips`,role:`group`,"aria-label":q.maps.label},...ue),fe=c(`div`,{class:`t9p-chips`,role:`group`,"aria-label":q.uses.label},...N),P=c(`div`,{class:`t9p-cap-in`},ae,A,j,de,fe,M),F=c(`div`,{class:`t9p-cap`,"aria-live":`polite`},P),I=q.steps.map((e,t)=>c(`li`,null,c(`button`,{class:`t9p-step`,type:`button`,"aria-label":o(q.stepAria,{n:t+1,name:e.name}),onClick:()=>Yt(t)},c(`span`,{class:`t9p-stone`,"aria-hidden":`true`},String(t+1)),c(`span`,{class:`t9p-step-l`,"aria-hidden":`true`},e.short)))),pe=s(`path`,{class:`pb`}),he=s(`path`,{class:`pi`}),ge=s(`svg`,{class:`t9p-path`,"aria-hidden":`true`},s(`g`,{filter:p?null:`url(#ink-rough)`},pe,he)),_e=c(`nav`,{class:`t9p-steps`,"aria-label":q.stepsLabel},ge,c(`ol`,null,...I)),ve=s(`svg`,{class:`t9p-sky`,"aria-hidden":`true`}),ye=c(`p`,{class:`t9p-or`,"aria-hidden":`true`},q.orText),L=c(`p`,{class:`t9p-back`,"aria-hidden":`true`},q.back),R=c(`div`,{class:`t9p-phone`,"aria-hidden":`true`},c(`i`),c(`b`)),z=s(`svg`,{class:`t9p-gizmo`,viewBox:`0 0 60 60`,"aria-hidden":`true`},s(`path`,{class:`gz-x`,d:`M30 30 L52 36`}),s(`path`,{class:`gz-y`,d:`M30 30 L14 40`}),s(`path`,{class:`gz-z`,d:`M30 30 L30 8`}),s(`circle`,{class:`gz-x`,cx:52,cy:36,r:5}),s(`circle`,{class:`gz-y`,cx:14,cy:40,r:5}),s(`circle`,{class:`gz-z`,cx:30,cy:8,r:5}));b.append(ve,E,R,z,ye,L,F,_e),e.art.append(b),e.prompt(q.prompt);let B=re(E,{fov:32});if(!B)return E.removeAttribute(`role`),E.removeAttribute(`tabindex`),le(E,q.noWebgl),F.remove(),_e.remove(),e.insight(q.insight,q.detail),()=>b.remove();let{scene:Se,camera:V,renderer:H,canvas:Ce}=B;Ce.setAttribute(`aria-hidden`,`true`);let U={...Pe},we=new C,Te=new C,W=new C;we.add(Te),Te.add(W),Se.add(we);let G=new Ne(p);W.add(G.group);let K=G.U,Ee=p?256:384,De=Be.map(()=>new m(Ee,Ee*3/4,{samples:p?0:4})),Oe=new h(1.6,1.2),ke={uPaperC:{value:new S},uPaper2:{value:new S},uInkC:{value:new S},uRedC:{value:new S},uEdgeC:{value:new S},uShadeK:{value:1},uTexel:{value:1/Ee}},Ae=De.map((e,t)=>{let n=new k({vertexShader:Ve,fragmentShader:He,transparent:!0,depthWrite:!1,side:2,uniforms:{...ke,uTex:{value:e.texture},uSketch:{value:+!!t},uAlpha:{value:0},uSeed:{value:t*7.3}}}),r=new _(Oe,n);return r.renderOrder=6,Te.add(r),r}),je=new ee,Me=new T(26,4/3,.1,40),Je=()=>{let e={swim:K.uSwim.value,noise:K.uNoise.value,facet:K.uFacet.value,paint:K.uPaint.value,form:K.uForm.value,sketch:K.uSketch.value},t=K.uMapW.value.clone();K.uSwim.value=0,K.uNoise.value=0,K.uFacet.value=0,K.uPaint.value=1,K.uForm.value=1,K.uMapW.value.set(1,0,0,0),G.wireRaw.visible=G.wireQuad.visible=!1;let n=G.body.visible;G.body.visible=G.fins.visible=!0,je.add(G.group);let r=H.getClearColor(new S),i=H.getClearAlpha();H.setClearColor(0,0),De.forEach((e,t)=>{let[n,r,i]=Be[t],a=t===0?4.15:3.55,o=Math.hypot(n,r,i);Me.position.set(n/o*a,r/o*a,i/o*a),Me.up.set(0,1,0),Me.lookAt(-.05,-.05,0),K.uSketch.value=+!!t,H.setRenderTarget(e),H.clear(),H.render(je,Me)}),H.setRenderTarget(null),H.setClearColor(r,i),W.add(G.group),G.body.visible=G.fins.visible=n,K.uSwim.value=e.swim,K.uNoise.value=e.noise,K.uFacet.value=e.facet,K.uPaint.value=e.paint,K.uForm.value=e.form,K.uSketch.value=e.sketch,K.uMapW.value.copy(t)},J=me(99),Y=G.body.geometry.attributes.position,X=G.fins.geometry.attributes.position,Ye=p?280:640,Xe=new Float32Array(Ye*3),Ze=new Float32Array(Ye*3),Qe=new Float32Array(Ye);for(let e=0;e<Ye;e++){let t=J()<.25?X:Y,n=Math.floor(J()*t.count);Xe.set([t.getX(n),t.getY(n),t.getZ(n)],e*3);let r=ze[Math.floor(J()*ze.length)],i=J()*Math.PI*2,a=.15+J()*.55;Ze.set([r[0]*.8+Math.cos(i)*a,r[1]*.85+(J()-.5)*.6,r[2]*.8+Math.sin(i)*a],e*3),Qe[e]=J()}let $e=new x;$e.setAttribute(`position`,new w(Xe,3)),$e.setAttribute(`aStart`,new w(Ze,3)),$e.setAttribute(`aDelay`,new w(Qe,1));let et=new k({vertexShader:Ue,fragmentShader:We,transparent:!0,depthWrite:!1,uniforms:{uProg:{value:0},uTime:{value:0},uSize:{value:4},uScale:{value:1},uColor:{value:new S},uOpacity:{value:0}}}),Z=new g($e,et);Z.renderOrder=5,W.add(Z);let tt=[.02,.2,.38,.56,.74,.9,1,1.17,1.34],nt=new x;nt.setAttribute(`position`,new D([0,0,0,.2,1,0,.2,0,1,.2,-1,0,.2,0,-1,1,0,0],3)),nt.setIndex([0,2,1,0,3,2,0,4,3,0,1,4,5,1,2,5,2,3,5,3,4,5,4,1]);let rt=new te(nt),it=new d({transparent:!0,depthTest:!1,depthWrite:!1,opacity:.32,side:2}),at=new O({transparent:!0,depthTest:!1,depthWrite:!1,opacity:.95}),Q=new d({transparent:!0,depthTest:!1,depthWrite:!1}),ot=new l(1,14,10),st=new C,ct=tt.slice(0,-1).map(()=>{let e=new _(nt,it);return e.add(new ie(rt,at)),e.renderOrder=8,e.children[0].renderOrder=9,st.add(e),e}),lt=tt.map(()=>{let e=new _(ot,Q);return e.renderOrder=10,st.add(e),e});W.add(st);let ut=tt.map(()=>new y),dt=new y(1,0,0),ft=new k({vertexShader:Ge,fragmentShader:Ke,transparent:!0,depthWrite:!1,uniforms:{uInkC:{value:new S},uMossC:{value:new S},uVermC:{value:new S},uWaterC:{value:new S},uTableC:{value:new S},uShadowC:{value:new S},uTime:{value:0},uShadow:{value:0},uCardSh:{value:0},uZen:{value:0},uFade:{value:new v(0,1)},uGrid:{value:0},uPond:{value:0},uTable:{value:0},uDark:{value:0},uKoi:{value:new v},uDir:{value:new v(1,0)}}}),pt=new _(new h(8,8),ft);pt.rotation.x=-Math.PI/2,pt.position.y=-.64,pt.renderOrder=1,Te.add(pt);let mt=new d({transparent:!0,depthWrite:!1,opacity:0}),ht=new d({transparent:!0,depthWrite:!1,opacity:0}),gt=[[-1.15,-.55,.26,.4,0],[1.05,.85,.2,2.2,1],[.35,-1.25,.15,4.1,0],[-.75,1.05,.12,5.3,1]].map(([e,t,n,r,i])=>{let a=new _(new ne(n,32,.35,Math.PI*2-.35),i?ht:mt);return a.rotation.set(-Math.PI/2,0,r),a.position.set(e,-.63,t),a.renderOrder=2,Te.add(a),a});Se.traverse(e=>void(e.frustumCulled=!1));let _t=()=>{let e=r.theme===`dark`,t=e=>new S(a(e));G.theme(),ke.uPaperC.value=e?t(`--card`).lerp(t(`--stone-3`),.35):t(`--card`),ke.uPaper2.value=t(`--paper-2`),ke.uInkC.value=t(`--ink`),ke.uRedC.value=t(`--vermilion`),ke.uEdgeC.value=t(e?`--stone-3`:`--stone`),ke.uShadeK.value=e?.15:1,et.uniforms.uColor.value=t(e?`--moss`:`--ink-3`),et.blending=e?2:1,et.needsUpdate=!0,it.color=t(`--vermilion`),at.color=t(`--vermilion`),Q.color=t(`--vermilion`);let n=ft.uniforms;n.uInkC.value=t(`--ink`),n.uMossC.value=t(`--moss`),n.uVermC.value=t(`--vermilion`),n.uWaterC.value=t(`--moss-soft`),n.uTableC.value=t(e?`--stone-3`:`--paper-2`),n.uShadowC.value=e?new S(0,0,0):t(`--ink`),n.uDark.value=+!!e,mt.color=t(`--moss`),ht.color=t(`--moss-2`),Je(),B.render()};_t();let vt=n(_t),yt=t(`t9sky`),bt=(e,t)=>{ve.setAttribute(`viewBox`,`0 0 ${e} ${t}`);let n=Ct.cy+Ct.h*.06,r=Math.min(Ct.h*.42,e*.22),i=(t,i)=>{let a=[];for(let o=0;o<=48;o++){let s=o/48,c=0;for(let[e,n,r]of t)c=Math.max(c,n*Math.exp(-(((s-e)/r)**2)));c+=.035*Math.sin(s*37+i)+.02*Math.sin(s*91+i*2),a.push([-20+(e+40)*s,n-r*Math.max(0,c)])}return`M${a.map(([e,t])=>`${e.toFixed(1)} ${t.toFixed(1)}`).join(`L`)}L${e+20} ${n+r*.3}L-20 ${n+r*.3}Z`},a=(e,t,i)=>s(`linearGradient`,{id:e,gradientUnits:`userSpaceOnUse`,x1:0,x2:0,y1:i.toFixed(1),y2:(n+r*.1).toFixed(1)},s(`stop`,{offset:0,style:`stop-color:var(--ink);stop-opacity:${t}`}),s(`stop`,{offset:1,style:`stop-color:var(--ink);stop-opacity:0`})),o=a(`${yt}f`,.075,n-r*1.05),c=a(`${yt}n`,.1,n-r*.6),l=s(`linearGradient`,{id:`${yt}m`,x1:0,y1:0,x2:0,y2:1},s(`stop`,{offset:0,style:`stop-color:var(--paper);stop-opacity:0`}),s(`stop`,{offset:.55,style:`stop-color:var(--paper);stop-opacity:0.92`}),s(`stop`,{offset:1,style:`stop-color:var(--paper);stop-opacity:0`})),u=p?{}:{filter:`url(#ink-wash)`},d=s(`mask`,{id:`${yt}x`,maskUnits:`userSpaceOnUse`,x:0,y:0,width:e,height:t},s(`rect`,{x:0,y:0,width:e,height:t,fill:`url(#${yt}h)`})),f=s(`linearGradient`,{id:`${yt}h`,x1:0,x2:1,y1:0,y2:0},s(`stop`,{offset:0,"stop-color":`#fff`,"stop-opacity":0}),s(`stop`,{offset:.16,"stop-color":`#fff`,"stop-opacity":1}),s(`stop`,{offset:.84,"stop-color":`#fff`,"stop-opacity":1}),s(`stop`,{offset:1,"stop-color":`#fff`,"stop-opacity":0}));ve.replaceChildren(s(`defs`,null,o,c,l,f,d),s(`g`,{mask:`url(#${yt}x)`},s(`path`,{d:i([[.12,1,.09],[.24,.62,.08],[.8,.5,.07],[.92,.82,.07]],1),fill:`url(#${yt}f)`,...u}),s(`path`,{d:i([[.03,.55,.07],[.33,.3,.06],[.7,.36,.06],[.99,.5,.06]],4),fill:`url(#${yt}n)`,...u}),s(`rect`,{x:0,y:(n-r*.55).toFixed(1),width:e,height:(r*.85).toFixed(1),fill:`url(#${yt}m)`})))},xt=0,St=()=>{let e=_e.getBoundingClientRect();if(!e.width)return;ge.setAttribute(`viewBox`,`0 0 ${e.width.toFixed(1)} ${e.height.toFixed(1)}`);let t=oe(I.map(t=>{let n=t.querySelector(`.t9p-stone`).getBoundingClientRect();return[n.left+n.width/2-e.left,n.top+n.height/2-e.top]}),10),n=b.dataset.layout===`short`?5:6;pe.setAttribute(`d`,se(t,n,2)),he.setAttribute(`d`,xt?se(t.slice(0,xt*10+1),n*1.05,5):``)},Ct={cx:0,cy:0,w:1,h:1},wt=0,Tt=()=>{let e=B.width,t=B.height;if(e<2||t<2)return;let n=ce(b);b.dataset.layout=n;let r=b.getBoundingClientRect(),i=P.getBoundingClientRect(),a=_e.getBoundingClientRect(),o=0,s=0,c=0,l=0;n===`short`?(s=Math.max(0,i.right-r.left+6),c=Math.max(0,r.right-a.left+6)):(l=Math.max(0,r.bottom-a.top+6),n===`tall`?o=Math.max(0,i.bottom-r.top+8):s=Math.max(0,i.right-r.left)*.55);let u=Math.max(80,e-s-c);Ct={cx:s+u/2,cy:o+(t-o-l)/2,w:u,h:Math.max(60,t-o-l)},V.setViewOffset(e,t,e/2-Ct.cx,t/2-Ct.cy,e,t);let d=H.getPixelRatio();et.uniforms.uScale.value=t/600*d*5;let f=n===`short`?0:t-(a.top-r.top);ft.uniforms.uFade.value.set(f*d,(f+Math.min(70,t*.12))*d),R.style.setProperty(`--ph`,`${Math.min(Ct.h*.94,Ct.w*.9*19/9)}px`),Object.assign(R.style,{left:`${Ct.cx}px`,top:`${Ct.cy}px`}),bt(e,t),St()};B.onResize(()=>Tt()),Tt();let Et=new ResizeObserver(()=>Tt());Et.observe(P);let Dt=()=>{let e=Math.tan(V.fov*Math.PI/360);return B.height/e*Math.max(U.fit/Ct.h,U.fitW/Ct.w)};wt=Dt();let $=0,Ot=0,kt=Le[0],At=0,jt=Le[0],Mt=0,Nt=-Math.PI/2,Pt=1.2,Ft=null,It=0,Lt=1,Rt=K.uMapW.value,zt={grid:0,pond:1,table:0},Bt=()=>b.dataset.layout===`tall`,Vt=e=>e===0?0:e===1?.2:e===5?.3:Bt()?-.95:-.62,Ht=new Set([0]),Ut=0,Wt=new Set,Gt=0,Kt=()=>M.replaceChildren(e.fact(q.uses.items[Lt].note,`span`)),qt=()=>{clearTimeout(Gt),!(Wt.has($)&&j.classList.contains(`on`))&&(Wt.add($),j.classList.add(`on`),M.classList.add(`on`),e.reduced||e.anim(()=>i.fromTo([j,M],{opacity:0,y:6,filter:`blur(4px)`},{opacity:1,y:0,filter:`blur(0px)`,duration:1.1,ease:`power3.out`,clearProps:`filter`})))},Jt=(t,n)=>{let r=q.steps[t];ae.textContent=o(q.of,{n:t+1}),A.textContent=r.name,j.textContent=r.caption,j.classList.toggle(`on`,Wt.has(t)),M.classList.toggle(`on`,Wt.has(t)),clearTimeout(Gt),!Wt.has(t)&&t>0&&(Gt=window.setTimeout(qt,1900)),de.hidden=t!==3,fe.hidden=t!==5,M.hidden=t!==5,b.dataset.stage=String(t),n&&!e.reduced&&e.anim(()=>i.fromTo([ae,A,de,fe],{opacity:0,y:8,filter:`blur(4px)`},{opacity:1,y:0,filter:`blur(0px)`,duration:.9,stagger:.07,ease:`power3.out`,clearProps:`filter`})),I.forEach((e,n)=>{let r=e.firstElementChild;n===t?r.setAttribute(`aria-current`,`step`):r.removeAttribute(`aria-current`),r.classList.toggle(`seen`,Ht.has(n)),r.classList.toggle(`next`,n===t+1)}),xt=Math.max(xt,t),Tt()};function Yt(t){if(t===$)return;let n=t===$+1;$=t,Ht.add(t),Jt(t,!0),Ot=qe(Ot,Vt(t)),kt=Le[t],Mt=0,t!==3&&It&&Xt(0);let r=Fe[t];Ft?.kill(),e.reduced?(Object.assign(U,r),B.render()):e.anim(()=>{Ft=i.timeline();for(let e of Object.keys(r)){let[i,a]=n?Ie[t][e]??[1.4,0]:[1.2,0];Ft.to(U,{[e]:r[e],duration:i,ease:`power2.inOut`},a)}}),e.chime(`soft`),t===5&&!Ut&&(Ut=window.setTimeout(()=>e.insight(q.insight,q.detail),e.reduced?0:2600))}function Xt(t){It=t,ue.forEach((e,n)=>e.setAttribute(`aria-pressed`,String(n===t)));let n={x:+(t===0),y:+(t===1),z:+(t===2),w:+(t===3)};e.reduced?(Rt.set(n.x,n.y,n.z,n.w),B.render()):e.anim(()=>i.to(Rt,{...n,duration:.8,ease:`power2.inOut`}))}function Zt(t){Lt=t,N.forEach((e,n)=>e.setAttribute(`aria-pressed`,String(n===t))),Kt(),qt(),b.dataset.use=String(t);let n={grid:+(t===0),pond:+(t===1),table:+(t===2)};e.reduced?(Object.assign(zt,n),B.render()):e.anim(()=>i.to(zt,{...n,duration:1,ease:`power2.inOut`})),e.chime(`tap`)}b.dataset.use=`1`,Kt(),Jt(0,!1);let Qt=null,$t=e=>Math.max(-.25,Math.min(1.25,e)),en=e=>{if(e.button===0){Qt={id:e.pointerId,x:e.clientX,y:e.clientY};try{E.setPointerCapture(e.pointerId)}catch{}E.classList.add(`grabbing`)}},tn=e=>{Qt&&e.pointerId===Qt.id&&(Ot+=(e.clientX-Qt.x)*.009,kt=$t(kt+(e.clientY-Qt.y)*.005),Qt.x=e.clientX,Qt.y=e.clientY,Mt=0,$>0&&qt(),B.render())},nn=()=>{Qt=null,E.classList.remove(`grabbing`)},rn=e=>{let t={ArrowLeft:[-.35,0],ArrowRight:[.35,0],ArrowUp:[0,-.15],ArrowDown:[0,.15]}[e.key];if(e.key===`Home`)e.preventDefault(),Ot=qe(Ot,Vt($)),kt=Le[$];else if(t)e.preventDefault(),Ot+=t[0],kt=$t(kt+t[1]);else return;Mt=0,$>0&&qt(),B.render()};E.addEventListener(`pointerdown`,en),E.addEventListener(`pointermove`,tn),E.addEventListener(`pointerup`,nn),E.addEventListener(`pointercancel`,nn),E.addEventListener(`keydown`,rn);let an=new f,on=new y,sn=new y,cn=new f,ln=new f,un=-1;return B.onFrame((e,t)=>{if(t>0){Mt+=t,!Qt&&Mt>3&&$>=1&&$<=4&&(Ot+=t*.13);let e=1-Math.exp(-t*3.2);At+=(Ot-At)*e,jt+=(kt-jt)*e,wt+=(Dt()-wt)*(1-Math.exp(-t*4)),Pt+=t*(1.6+1.2*U.use),Nt+=t*.32*U.use}else At=Ot,jt=kt,wt=Dt();Te.rotation.y=At,we.rotation.x=jt,V.position.set(0,0,wt),V.lookAt(0,0,0),we.updateMatrixWorld();let n=Math.round(((At-Vt($))*180/Math.PI%360+360)%360);n!==un&&(un=n,E.setAttribute(`aria-valuenow`,String(n)),E.setAttribute(`aria-valuetext`,o(q.valueText,{deg:n}))),K.uForm.value=U.form,K.uNoise.value=U.noise,K.uFacet.value=U.facet,K.uPaint.value=U.paint,K.uSwim.value=U.swim,K.uSolid.value=U.solid,K.uPhase.value=Pt,G.body.visible=G.fins.visible=U.form>.001,G.rawOpacity=U.raw*(r.theme===`dark`?.5:.45),G.quadOpacity=.75*Math.min(1,U.quad*3),G.quadReveal=U.quad;let i=.78*U.use*(1-.6*zt.table);W.position.set(Math.cos(Nt)*i,-.34*U.use,Math.sin(Nt)*i),W.rotation.y=-(Nt+Math.PI/2)*Math.min(1,U.use*4),W.scale.setScalar(1-.42*zt.table*U.use),V.updateMatrixWorld(),Te.getWorldQuaternion(an),cn.copy(an).invert().multiply(V.quaternion);for(let e=0;e<Ae.length;e++){let t=Ae[e],n=t.material,[r,i,a]=ze[e],o=i-.3*((-r*Math.sin(At)+a*Math.cos(At))/Re),s=1-U.collapse;if(e===0)t.position.set(r*U.slot*s,o*U.slot*s+.14*(1-U.slot),a*U.slot*s),t.scale.setScalar(u.lerp(1,.7,U.slot)*(.1+.9*s)),t.quaternion.slerpQuaternions(ln,cn,U.slot),n.uniforms.uAlpha.value=U.card*Math.min(1,s*1.6);else{let i=Math.max(0,Math.min(1,U.ring*1.7-e*.14));t.position.set(r*s,o*s,a*s),t.scale.setScalar(.7*(.7+.3*i)*(.1+.9*s)),t.quaternion.copy(cn),n.uniforms.uAlpha.value=i*Math.min(1,s*1.6)}t.visible=n.uniforms.uAlpha.value>.003}let a=Ae[0],s=!1;$===0&&a.visible&&(a.getWorldPosition(on),sn.set(0,0,1).applyQuaternion(a.getWorldQuaternion(an)),s=sn.dot(on.sub(V.position).negate())<0),b.classList.toggle(`show-back`,s),s&&!Wt.has(0)&&qt(),s&&(on.set(0,0,0).applyMatrix4(a.matrixWorld).project(V),L.style.transform=`translate(${(on.x+1)/2*B.width}px, ${(1-on.y)/2*B.height}px)`),$===0&&(on.set(0,-.68,0).applyMatrix4(a.matrixWorld).project(V),ye.style.transform=`translate(-50%, 0) translate(${(on.x+1)/2*B.width}px, ${(1-on.y)/2*B.height+10}px)`),Z.visible=U.dust>.003,et.uniforms.uOpacity.value=U.dust*(r.theme===`dark`?.42:.3),et.uniforms.uProg.value=U.dustP,et.uniforms.uTime.value=e,et.uniforms.uSize.value=r.theme===`dark`?12:13,st.visible=U.bones>.003,st.visible&&(tt.forEach((e,t)=>{let[n,r,i]=xe(e);ut[t].set(n,r+.01,i+be(n,U.swim,Pt))}),ct.forEach((e,t)=>{let n=Math.max(0,Math.min(1,U.bones*ct.length-t));on.subVectors(ut[t+1],ut[t]);let r=on.length();e.position.copy(ut[t]),e.quaternion.setFromUnitVectors(dt,on.normalize());let i=Math.min(.045,r*.16);e.scale.set(r*n+1e-4,i*n+1e-4,i*n+1e-4),e.visible=n>.01}),lt.forEach((e,t)=>{let n=Math.max(0,Math.min(1,U.bones*ct.length-t+.5));e.position.copy(ut[t]),e.scale.setScalar(.022*n+1e-4),e.visible=n>.01}));let c=ft.uniforms;c.uTime.value=e,c.uZen.value=U.zen,c.uShadow.value=U.shadow*Math.min(1,U.form*1.5),c.uCardSh.value=U.card*(1-U.slot)*(1-U.collapse),c.uGrid.value=zt.grid*U.use,c.uPond.value=zt.pond*U.use,c.uTable.value=zt.table*U.use,c.uKoi.value.set(W.position.x,W.position.z),c.uDir.value.set(Math.cos(W.rotation.y),-Math.sin(W.rotation.y));let l=zt.pond*U.use;mt.opacity=l*.85,ht.opacity=l*.7,gt.forEach((t,n)=>{t.visible=l>.003,t.position.y=-.63+Math.sin(e*.7+n)*.004}),b.style.setProperty(`--use`,U.use.toFixed(3)),b.style.setProperty(`--grid`,(zt.grid*U.use).toFixed(3)),b.style.setProperty(`--ar`,(zt.table*U.use).toFixed(3))}),B.render(),()=>{clearTimeout(Ut),clearTimeout(Gt),Et.disconnect(),Ft?.kill(),vt(),E.removeEventListener(`pointerdown`,en),E.removeEventListener(`pointermove`,tn),E.removeEventListener(`pointerup`,nn),E.removeEventListener(`pointercancel`,nn),E.removeEventListener(`keydown`,rn),De.forEach(e=>e.dispose()),je.clear(),B.dispose(),b.remove()}}var J=A.scenes.splats,Y=8,X=Math.PI*2,Ye=(e,t)=>{let n=(t%(Math.PI/3)+Math.PI/3)%(Math.PI/3);return e*Math.cos(Math.PI/6)/Math.cos(n-Math.PI/6)},Xe=e=>{let t=Math.floor(e/(Math.PI/3))*(Math.PI/3)+Math.PI/6;return[Math.cos(t),0,Math.sin(t)]};function Ze(e){let t=me(1203),n=[],r=(e,t,r,i=1)=>n.push({p:e,n:t,c:r,size:i}),i=(e,n,i,a,o,s,c)=>{for(let l=0;l<e;l++){let e=t()*X,l=t(),u=a+(o-a)*l;if(c?.(e,u))continue;let d=Ye(n+(i-n)*l,e);r([Math.cos(e)*d,u,Math.sin(e)*d],Xe(e),s(u,e))}},a=(e,n,i,a,o)=>{for(let s=0;s<e;s++){let e=t()*X,s=Math.sqrt(t())*Ye(n,e);r([Math.cos(e)*s,i,Math.sin(e)*s],[0,a,0],o)}},o=t=>Math.round(e*t),s=(e,t)=>ge(Math.cos(t)*3,e*6,Math.sin(t)*3)>.66?1:ge(t*2,e*9,4)>.68?5:0;i(o(.08),.5,.44,0,.16,s),a(o(.03),.44,.16,1,0);for(let e=0;e<o(.12);e++){let e=t()*X,n=.16+t()*.64,i=.14+.012*Math.sin((n-.16)/.64*Math.PI)+(Math.abs(n-.5)<.025?.02:0);r([Math.cos(e)*i,n,Math.sin(e)*i],[Math.cos(e),0,Math.sin(e)],s(n,e))}i(o(.07),.4,.4,.8,.92,s),a(o(.03),.4,.92,1,0);let c=(e,t)=>Math.abs(Math.sin(e))>.86&&t>1&&t<1.24;i(o(.11),.28,.28,.92,1.3,(e,t)=>c(t,e+.03)||c(t,e-.03)?1:s(e,t),c);for(let e=0;e<o(.025);e++){let e=t()*X,n=Math.sqrt(t())*.15;r([Math.cos(e)*n,1.02+t()*.2,Math.sin(e)*n],[0,0,0],3,1.6)}for(let e=0;e<o(.27);e++){let e=t()*X,n=t()**.8,i=Math.abs(Math.cos(3*e))**6,a=Ye(.66,e)*(1-n)+.05,o=1.32+.3*n**.75+.07*i*(1-n)**4,c=ge(Math.cos(e)*4,n*5,Math.sin(e)*4)>.64&&n>.2;r([Math.cos(e)*a,o,Math.sin(e)*a],[Math.cos(e)*.5,1,Math.sin(e)*.5],c?2:s(o,e)===1?1:5)}a(o(.04),.62,1.31,-1,1);for(let e=0;e<o(.04);e++){let e=t()*2-1,n=t()*X,i=Math.sqrt(1-e*e),a=[i*Math.cos(n),e,i*Math.sin(n)],o=e>.6?.55:1;r([a[0]*.1*o,1.74+a[1]*.11+(e>.6?.04*(e-.6)*5:0),a[2]*.1*o],a,e>.3&&t()<.4?2:5)}for(let e=0;e<o(.16);e++){let e=t()*X,n=.5+Math.sqrt(t())*.95,i=Math.abs(Math.sin(n*26))>.75,a=ge(Math.cos(e)*n*2.5,0,Math.sin(e)*n*2.5)>.72;r([Math.cos(e)*n,.005,Math.sin(e)*n],[0,1,0],a?2:i?5:4,1.15)}return n}var Qe=`
uniform float uShot[${Y}];
uniform float uTime;
uniform float uScale;
uniform float uFog;
uniform vec3 uFogC;
attribute vec3 aCol;
attribute float aSize;
attribute float aMask;
attribute float aRnd;
attribute float aRot;
varying vec3 vCol;
varying float vA;
varying float vRot;
varying float vAsp;
void main() {
  int m = int(aMask + 0.5);
  float seen = 0.0;
  for (int k = 0; k < ${Y}; k++) {
    if ((m & (1 << k)) != 0 && uShot[k] >= 0.0) seen = max(seen, smoothstep(uShot[k] + aRnd * 0.5, uShot[k] + 1.1 + aRnd * 0.9, uTime));
  }
  vec3 drift = vec3(sin(aRnd * 40.0 + uTime * 0.3), cos(aRnd * 31.0 + uTime * 0.25), sin(aRnd * 17.0 + uTime * 0.2)) * 0.07 * (1.0 - seen);
  vec4 mv = modelViewMatrix * vec4(position + drift, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * mix(1.9, 1.0, seen) * uScale / -mv.z;
  vA = mix(uFog * (0.4 + 0.6 * aRnd), 1.0, seen);
  vCol = mix(uFogC, aCol, seen);
  vRot = aRot;
  vAsp = mix(1.0, 0.45 + aRnd * 0.4, seen);
}`,$e=`
uniform float uOpacity;
varying vec3 vCol;
varying float vA;
varying float vRot;
varying float vAsp;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float cs = cos(vRot), sn = sin(vRot);
  c = vec2(cs * c.x - sn * c.y, sn * c.x + cs * c.y);
  c.y /= vAsp;
  float g = exp(-dot(c, c) * 16.0);
  float a = g * vA * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol, a);
  #include <colorspace_fragment>
}`;function et(e){let t=e.quality===`low`,l=c(`div`,{class:`t9 t9s`}),u=c(`div`,{class:`t9-stage`,tabindex:`0`,role:`slider`,"aria-label":J.aria,"aria-valuemin":`0`,"aria-valuemax":`360`,"aria-valuenow":`0`,"aria-valuetext":o(J.valueText,{deg:0})}),d=c(`div`,{class:`t9s-flash`,"aria-hidden":`true`}),f=c(`div`,{class:`t9s-finder`,"aria-hidden":`true`},c(`i`),c(`i`),c(`i`),c(`i`)),p=c(`p`,{class:`t9s-title`},J.title),m=c(`p`,{class:`t9s-count`,"aria-live":`polite`},o(J.count,{n:0})),h=c(`button`,{class:`t9s-shutter`,type:`button`,"aria-label":J.shutter},c(`span`,{"aria-hidden":`true`})),ee=s(`svg`,{class:`t9s-dial`,viewBox:`-50 -50 100 100`,"aria-hidden":`true`}),_=Array.from({length:Y},(e,t)=>{let n=t/Y*X-Math.PI/2,r=s(`circle`,{cx:(Math.cos(n)*38).toFixed(1),cy:(Math.sin(n)*38).toFixed(1),r:4.2});return ee.append(r),r}),v=s(`path`,{class:`t9s-needle`,d:`M0 -30 L0 -46`});ee.prepend(s(`circle`,{class:`t9s-dial-ring`,r:38})),ee.append(v);let b=c(`div`,{class:`t9s-controls`},ee,h,m);l.append(u,f,d,p,b),e.art.append(l),e.prompt(J.prompt);let T=re(u,{fov:30});if(!T)return u.removeAttribute(`role`),u.removeAttribute(`tabindex`),u.append(c(`p`,{class:`t9-nogl`},J.noWebgl)),b.remove(),e.insight(J.insight,J.detail),()=>l.remove();let{scene:E,camera:D,renderer:te,canvas:ne}=T;ne.setAttribute(`aria-hidden`,`true`);let ie=Ze(t?6500:15e3),O=ie.length,ae=new Float32Array(O*3),A=new Float32Array(O*3),j=new Float32Array(O),M=new Float32Array(O),oe=new Float32Array(O),se=new Float32Array(O),le=me(77),ue=Array.from({length:Y},(e,t)=>[Math.sin(t/Y*X),Math.cos(t/Y*X)]);ie.forEach((e,t)=>{ae.set(e.p,t*3),j[t]=(.07+le()*.07)*e.size,oe[t]=le(),se[t]=le()*Math.PI;let n=e.n[0],r=e.n[2],i=Math.hypot(n,r),a=0;i<.35&&e.c!==3&&(n=e.p[0],r=e.p[2]);let o=Math.hypot(n,r)||1;ue.forEach(([t,i],s)=>{(e.c===3?Math.abs(i)>.6:(n*t+r*i)/o>.6)&&(a|=1<<s)}),a||=1<<Math.floor(le()*Y),M[t]=a});let N=new x;N.setAttribute(`position`,new w(ae,3)),N.setAttribute(`aCol`,new w(A,3)),N.setAttribute(`aSize`,new w(j,1)),N.setAttribute(`aMask`,new w(M,1)),N.setAttribute(`aRnd`,new w(oe,1)),N.setAttribute(`aRot`,new w(se,1));let de=new Uint32Array(O).map((e,t)=>t);N.setIndex(new w(de,1));let fe=Array(Y).fill(-1),P=new k({vertexShader:Qe,fragmentShader:$e,transparent:!0,depthWrite:!1,uniforms:{uShot:{value:fe},uTime:{value:0},uScale:{value:1},uFog:{value:.12},uFogC:{value:new S},uOpacity:{value:1}}}),F=new g(N,P);F.frustumCulled=!1;let I=new C,pe=new C;I.add(pe),pe.add(F),F.position.y=-.82,E.add(I);let he=()=>{let e=r.theme===`dark`,t=e=>new S(a(e)),n=t(`--stone`),i=t(e?`--paper`:`--ink`),o=n.clone().lerp(i,.3),s=t(e?`--ink-3`:`--stone-2`),c=[n,o,t(`--moss-2`).lerp(n,.25),t(`--vermilion`).lerp(t(e?`--ink`:`--card`),e?.15:.35),t(e?`--stone-2`:`--stone-3`),s],l=me(5),u=new S,d=[-.55,.7,.45];ie.forEach((e,t)=>{if(u.copy(c[e.c]),e.c!==3){let t=e.n[0]*d[0]+e.n[1]*d[1]+e.n[2]*d[2];u.lerp(i,Math.max(0,-t)*.22+(e.p[1]<1.31&&e.p[1]>1.2?.18:0)),u.multiplyScalar(.9+Math.max(0,t)*.22+(l()-.5)*.12)}A.set([u.r,u.g,u.b],t*3)}),N.attributes.aCol.needsUpdate=!0,P.uniforms.uFogC.value=t(e?`--ink-3`:`--stone-2`),P.uniforms.uFog.value=e?.06:.08,T.render()};he();let ge=n(he),_e=new Uint32Array(O),ve=[99,99],ye=(e,t)=>{let n=Math.sin(e),r=Math.cos(e),i=Math.sin(t),a=Math.cos(t);for(let e=0;e<O;e++){let t=i*ae[e*3+1]+a*(-ae[e*3]*n+ae[e*3+2]*r),o=Math.max(0,Math.min(65535,Math.round((t+2.5)/5*65535)));_e[e]=(o<<16|e)>>>0}_e.sort();for(let e=0;e<O;e++)de[e]=_e[e]&65535;N.index.needsUpdate=!0,ve=[e,t]},L=6,R=()=>{let e=T.width,t=T.height,n=ce(l);l.dataset.layout=n;let r=b.getBoundingClientRect(),i=l.getBoundingClientRect(),a=p.getBoundingClientRect(),o=n===`short`?Math.max(0,i.right-r.left+10):0,s=n===`short`?0:Math.max(0,i.bottom-r.top+6),c=n===`tall`?Math.max(0,a.bottom-i.top+6):0,u=e-o,d=t-c-s;D.setViewOffset(e,t,e/2-u/2,t/2-(c+d/2),e,t);let f=Math.tan(D.fov*Math.PI/360);L=t/f*Math.max(1.66/d,1.66/(u*.92)),P.uniforms.uScale.value=t*te.getPixelRatio()/(2*f)};T.onResize(R),R();let z=.35,B=.35,be=.28,xe=.28,Se=performance.now(),V=()=>(performance.now()-Se)/1e3,H=0,Ce=!1,U=e=>(Math.round(-e/(X/Y))%Y+Y)%Y,we=(e,t)=>t+Math.round((e-t)/X)*X,Te=()=>{_.forEach((e,t)=>e.classList.toggle(`shot`,fe[t]>=0))};function W(){let t=U(z);e.anim(()=>{e.reduced||i.fromTo(d,{opacity:.85},{opacity:0,duration:.9,ease:`power2.out`})}),fe[t]>=0?e.prompt(J.more):(fe[t]=e.reduced?0:V(),H++,m.textContent=o(J.count,{n:H}),Te(),e.chime(H===Y?`ok`:`tap`));for(let e=1;e<=Y;e++){let n=(t+e)%Y;if(fe[n]<0){z=we(z,-n*X/Y);break}}H===Y&&!Ce&&(Ce=!0,e.insight(J.insight,J.detail)),T.render()}h.addEventListener(`click`,W);let G=null,K=e=>{if(e.button===0){G={id:e.pointerId,x:e.clientX,y:e.clientY};try{u.setPointerCapture(e.pointerId)}catch{}u.classList.add(`grabbing`)}},Ee=e=>{G&&e.pointerId===G.id&&(z+=(e.clientX-G.x)*.008,be=Math.max(.05,Math.min(.9,be+(e.clientY-G.y)*.004)),G.x=e.clientX,G.y=e.clientY,T.render())},De=()=>{G=null,u.classList.remove(`grabbing`)},Oe=e=>{let t={ArrowLeft:[-X/Y,0],ArrowRight:[X/Y,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]}[e.key];t&&(e.preventDefault(),z+=t[0],be=Math.max(.05,Math.min(.9,be+t[1])),T.render())};u.addEventListener(`pointerdown`,K),u.addEventListener(`pointermove`,Ee),u.addEventListener(`pointerup`,De),u.addEventListener(`pointercancel`,De),u.addEventListener(`keydown`,Oe);let ke=[...Array.from({length:12},(e,t)=>[Math.cos(t/12*X)*1.42,.02,Math.sin(t/12*X)*1.42]),...Array.from({length:6},(e,t)=>[Math.cos(t/6*X)*.66,1.6,Math.sin(t/6*X)*.66]),[0,1.88,0]],Ae=new y,je=``,Me=()=>{F.updateMatrixWorld(!0),D.updateMatrixWorld();let e=1,t=-1,n=1,r=-1;for(let[i,a,o]of ke)Ae.set(i,a,o).applyMatrix4(F.matrixWorld).project(D),e=Math.min(e,Ae.x),t=Math.max(t,Ae.x),n=Math.min(n,Ae.y),r=Math.max(r,Ae.y);let i=T.width,a=T.height,o=Math.max(14,(t-e)*i*.04),s=(e+1)/2*i-o,c=(t+1)/2*i+o,l=(1-r)/2*a-o,u=(1-n)/2*a+o,d=`${s.toFixed(0)},${l.toFixed(0)},${c.toFixed(0)},${u.toFixed(0)}`;d!==je&&(je=d,Object.assign(f.style,{left:`${s}px`,top:`${l}px`,width:`${c-s}px`,height:`${u-l}px`}))},Ne=-1;return T.onFrame((t,n)=>{if(n>0){let e=1-Math.exp(-n*3);B+=(z-B)*e,xe+=(be-xe)*e}else B=z,xe=be;pe.rotation.y=B,I.rotation.x=xe,D.position.set(0,0,L),D.lookAt(0,0,0),Me(),(Math.abs(B-ve[0])>.04||Math.abs(xe-ve[1])>.04)&&ye(B,xe),P.uniforms.uTime.value=e.reduced?1e4:V();let r=Math.round((-B*180/Math.PI%360+360)%360);r!==Ne&&(Ne=r,u.setAttribute(`aria-valuenow`,String(r)),u.setAttribute(`aria-valuetext`,o(J.valueText,{deg:r})),v.setAttribute(`transform`,`rotate(${r})`))}),T.render(),()=>{ge(),h.removeEventListener(`click`,W),u.removeEventListener(`pointerdown`,K),u.removeEventListener(`pointermove`,Ee),u.removeEventListener(`pointerup`,De),u.removeEventListener(`pointercancel`,De),u.removeEventListener(`keydown`,Oe),T.dispose(),l.remove()}}var Z=A.scenes.input;function tt(){let e=me(31),t=s(`g`,null);for(let n=0;n<7;n++){let n=60+e()*280,r=40+e()*230,i=30+e()*70;t.append(s(`ellipse`,{class:`rip`,cx:n,cy:r,rx:i,ry:i*.32}))}let n=(e,t,n)=>{let r=300-n;return s(`path`,{class:`reed`,d:`M${e} 305 Q ${e+t*.4} ${300-n*.5} ${e+t} ${r} Q ${e+t*.5+2} ${300-n*.5} ${e+5} 305Z`})};return[[18,14,230],[34,-8,190],[48,22,260],[360,-20,240],[376,6,200],[388,-10,150],[70,30,120]].forEach(([e,r,i])=>t.append(n(e,r,i))),[[300,262,26,12],[328,250,14,8],[90,270,20,9],[230,282,30,10]].forEach(([e,n,r,i])=>t.append(s(`ellipse`,{class:`peb`,cx:e,cy:n,rx:r,ry:i}))),t.append(s(`path`,{class:`pad`,d:`M330 60 a44 22 0 1 0 2 0 L320 78Z`})),t.append(s(`path`,{class:`pad`,d:`M60 40 a30 14 0 1 0 2 0 L52 52Z`})),t}function nt(e){let t=e.quality===`low`,r=c(`div`,{class:`t9 t9i`}),l=c(`div`,{class:`t9i-gl`,"aria-hidden":`true`}),f=s(`svg`,{class:`t9i-bg`,viewBox:`0 0 400 300`,preserveAspectRatio:`xMidYMid slice`,"aria-hidden":`true`},tt()),p=c(`div`,{class:`t9i-photo`,role:`img`,"aria-label":Z.photo},f),m=s(`g`,{class:`leaf`},s(`path`,{d:`M0 -46 C 30 -44 52 -20 50 6 C 48 34 20 50 -6 48 C -36 46 -52 18 -48 -8 C -46 -30 -26 -44 -4 -46 L 0 -2Z`}),...[0,1,2,3,4,5,6].map(e=>{let t=-1.2+e*.62;return s(`path`,{class:`vein`,d:`M0 -2 L${(Math.cos(t)*44).toFixed(1)} ${(Math.sin(t)*42).toFixed(1)}`})})),h=s(`svg`,{class:`t9i-over`,viewBox:`0 0 400 300`,preserveAspectRatio:`xMidYMid slice`,"aria-hidden":`true`},s(`defs`,null,s(`radialGradient`,{id:`t9i-glare`},s(`stop`,{offset:0,class:`g0`}),s(`stop`,{offset:.55,class:`g1`}),s(`stop`,{offset:1,class:`g2`}))),s(`g`,{transform:`translate(205 168) rotate(-18) scale(1.15)`},m),s(`ellipse`,{class:`glare`,cx:275,cy:120,rx:62,ry:44,fill:`url(#t9i-glare)`})),g=c(`div`,{class:`t9i-result`},s(`svg`,{class:`t9i-ring`,viewBox:`-100 -30 200 60`,"aria-hidden":`true`},s(`ellipse`,{rx:92,ry:22}),s(`ellipse`,{rx:76,ry:17}),s(`ellipse`,{rx:60,ry:13}))),v=c(`p`,{class:`t9i-lab`},Z.photo),x=c(`p`,{class:`t9i-lab`},Z.result),w=s(`svg`,{class:`t9i-arrow`,viewBox:`0 0 80 24`,"aria-hidden":`true`},s(`path`,{d:`M4 13 C 22 9, 44 15, 66 11 L 60 5 M66 11 L 59 18`})),D=Z.fixes.map(()=>!1),te=Z.fixes.map((e,t)=>c(`button`,{class:`t9i-fix`,type:`button`,"aria-pressed":`false`,"aria-label":o(Z.fixAria,e),onClick:()=>we(t)},c(`span`,{class:`dot`,"aria-hidden":`true`}),c(`span`,{class:`txt`},e.flaw))),ne=c(`p`,{class:`t9i-status`,"aria-live":`polite`},o(Z.status,{n:0})),ie=c(`div`,{class:`t9i-fixes`,role:`group`,"aria-label":Z.group},...te);r.append(p,g,l,h,v,x,w,ie,ne),e.art.append(r),e.prompt(Z.prompt);let O={x:0,y:0,w:1,h:1},k={...O},ae=(e,t)=>Object.assign(e.style,{left:`${t.x}px`,top:`${t.y}px`,width:`${t.w}px`,height:`${t.h}px`}),A=()=>{let e=r.clientWidth,t=r.clientHeight;if(!e||!t)return;let n=ce(r);r.dataset.layout=n;let i=ie.offsetHeight+ne.offsetHeight+18;if(n===`tall`){let n=t-i-60-22,r=Math.min(n*.45,e*.9*3/4),a=r*4/3;O={x:(e-a)/2,y:30,w:a,h:r};let o=Math.max(60,n-r),s=Math.min(e,o*1.7);k={x:(e-s)/2,y:O.y+r+30+18,w:s,h:o},w.style.display=`none`}else if(n===`short`){let n=e-(ie.offsetWidth+20),r=t-30-8,i=Math.min(n*.5,r*4/3),a=i*3/4,o=Math.min(70,n*.1),s=Math.min(n-i-o,i*1.05),c=Math.max(0,(n-(i+o+s))/2),l=30+Math.max(0,(r-a)/2);O={x:c,y:l,w:i,h:a},k={x:c+i+o,y:l,w:s,h:a},Object.assign(w.style,{display:``,left:`${c+i+o/2-22}px`,top:`${l+a/2-7}px`,width:`44px`,rotate:`0deg`})}else{let n=t-i-30-6,r=Math.min(e*.44,n*4/3),a=r*3/4,o=Math.min(110,e*.08),s=Math.min(e-r-o-10,r*1.05),c=(e-(r+o+s))/2,l=30+Math.max(0,(n-a)/2);O={x:c,y:l,w:r,h:a},k={x:c+r+o,y:l,w:s,h:a},Object.assign(w.style,{display:``,left:`${c+r+o/2-30}px`,top:`${l+a/2-9}px`,width:`60px`,rotate:`0deg`})}ae(p,O),ae(h,O),ae(g,k);let a=(e,t)=>{let n=Math.max(t.w,150);Object.assign(e.style,{left:`${t.x+t.w/2-n/2}px`,top:`${t.y-30}px`,width:`${n}px`})};a(v,O),a(x,k)},j=re(l,{fov:26});if(!j)return l.append(c(`p`,{class:`t9-nogl`},Z.noWebgl)),e.insight(Z.insight,Z.detail),()=>r.remove();let{renderer:M,canvas:oe}=j;oe.setAttribute(`aria-hidden`,`true`),M.autoClear=!1;let se=new ee,le=new ee,ue=new T(26,4/3,.1,50),N=new T(26,1.4,.1,50),fe=new Ne(t),P=new Ne(t);for(let e of[fe,P])e.wireRaw.visible=e.wireQuad.visible=!1,e.rawOpacity=0,e.quadOpacity=0;se.add(fe.group);let F=new C,I=new C;I.add(P.group),F.add(I),le.add(F);let pe=new d({transparent:!0}),me=new d({transparent:!0}),he=new E(.035,1.5,7,1,!1);he.translate(0,.75,0);let _e=new _(he,pe);_e.position.set(-.32,-.62,.04),_e.rotation.z=-.32;let ve=new b(.11,2),ye=ve.attributes.position;for(let e=0;e<ye.count;e++){let t=.8+.4*ge(ye.getX(e)*9,ye.getY(e)*9,ye.getZ(e)*9);ye.setXYZ(e,ye.getX(e)*t*1.4,ye.getY(e)*t*.8,ye.getZ(e)*t)}ve.computeVertexNormals();let L=new _(ve,me);L.position.set(.62,-.27,.02),I.add(_e,L);let R={bg:1,angle:1,crop:1,clean:1},z=-.5,B=0,be=0,xe=null,Se=new y,V=new y,H=()=>{let e=e=>new S(a(e));fe.theme(),P.theme(),pe.color=e(`--moss`),me.color=e(`--stone`),j.render()};H();let Ce=n(H);j.onFrame((t,n)=>{let i=R.angle,a=R.crop;Se.set(u.lerp(.12,.62,i),u.lerp(.25,1.25,i),u.lerp(1,.55,i)).normalize();let o=u.lerp(4.15,2.75,a);V.set(u.lerp(-.06,.48,a),-.04,0),ue.position.copy(V).addScaledVector(Se,o),ue.up.set(0,1,0),ue.lookAt(V),ue.aspect=O.w/O.h,ue.updateProjectionMatrix();let s=(R.bg+R.angle+R.crop+R.clean)/4;P.U.uNoise.value=.1+.5*s,P.U.uFacet.value=.12+.4*s,P.U.uCut.value=u.lerp(-9,de+.3,R.crop),P.U.uGlare.value=R.clean,P.U.uDent.value=R.clean;let c=1e-4+R.bg;_e.scale.set(c,.2+.8*R.bg,c),_e.visible=L.visible=R.bg>.003,L.scale.setScalar(c),I.scale.set(1+.05*R.angle,1-.16*R.angle,1+.28*R.angle),I.position.x=.1-.42*R.crop,I.rotation.z=.09*R.angle,n>0&&(be+=n*.45),z+=B,B*=.85,F.rotation.y=z+(e.reduced?0:Math.sin(be)*.3),F.rotation.x=.2;let l=k.w/k.h,d=Math.tan(N.fov*Math.PI/360),f=Math.max(u.lerp(1.3,.95,R.crop)/(d*l),.8/d);N.position.set(0,f/4.5*.18,f),N.lookAt(0,-.06,0),N.aspect=l,N.updateProjectionMatrix();let p=j.height;M.setScissorTest(!0),M.setScissor(0,0,j.width,p),M.setViewport(0,0,j.width,p),M.clear(),M.setViewport(O.x,p-O.y-O.h,O.w,O.h),M.setScissor(O.x,p-O.y-O.h,O.w,O.h),M.render(se,ue),M.setViewport(k.x,p-k.y-k.h,k.w,k.h),M.setScissor(k.x,p-k.y-k.h,k.w,k.h),M.render(le,N),M.setScissorTest(!1),r.style.setProperty(`--bg`,R.bg.toFixed(3)),r.style.setProperty(`--clean`,R.clean.toFixed(3))}),j.onResize(()=>A()),A(),j.render();let U=!1;function we(t){D[t]=!D[t];let n=Z.fixes[t],r=te[t];r.setAttribute(`aria-pressed`,String(D[t])),r.setAttribute(`aria-label`,D[t]?o(Z.fixedAria,n):o(Z.fixAria,n)),r.querySelector(`.txt`).textContent=D[t]?n.fix:n.flaw;let a=[`bg`,`angle`,`crop`,`clean`][t],s=+!D[t];e.reduced?(R[a]=s,j.render()):e.anim(()=>i.to(R,{[a]:s,duration:1.4,ease:`power3.inOut`}));let c=D.filter(Boolean).length;ne.textContent=o(Z.status,{n:c}),ne.classList.toggle(`done`,c===D.length),e.chime(D[t]?`tap`:`low`),c===D.length&&!U&&(U=!0,e.chime(`ok`),e.insight(Z.insight,Z.detail))}let Te=e=>{xe={id:e.pointerId,x:e.clientX};try{g.setPointerCapture(e.pointerId)}catch{}},W=e=>{xe&&xe.id===e.pointerId&&(B=(e.clientX-xe.x)*.01,xe.x=e.clientX,j.render())},G=()=>void(xe=null);g.addEventListener(`pointerdown`,Te),g.addEventListener(`pointermove`,W),g.addEventListener(`pointerup`,G),g.addEventListener(`pointercancel`,G);let K=new ResizeObserver(()=>A());return K.observe(ie),()=>{Ce(),K.disconnect(),g.removeEventListener(`pointerdown`,Te),g.removeEventListener(`pointermove`,W),g.removeEventListener(`pointerup`,G),g.removeEventListener(`pointercancel`,G);for(let e of[se,le])e.traverse(e=>{let t=e;t.geometry?.dispose(),(Array.isArray(t.material)?t.material:t.material?[t.material]:[]).forEach(e=>e.dispose())});j.dispose(),r.remove()}}var rt=A.scenes.models,it={wide:{at:[[.35,.52],[.8,.5]],g:[[[-1.12,.12],[-.12,-.42],[.02,.58],[1.02,.02]],[[-.5,-.28],[.48,.36]]]},tall:{at:[[.5,.3],[.5,.83]],g:[[[-.52,-.46],[.5,-.56],[-.48,.52],[.54,.42]],[[-.52,-.06],[.52,.1]]]},short:{at:[[.36,.5],[.84,.5]],g:[[[-.5,-.5],[.52,-.42],[-.44,.52],[.56,.6]],[[-.04,-.5],[.08,.52]]]}},at=[.5,.42,.46,.54,.44,.5],Q=e=>Math.round(e*10)/10,ot=e=>{let t=e.length,n=`M${Q(e[0][0])} ${Q(e[0][1])}`;for(let r=0;r<t;r++){let i=e[(r-1+t)%t],a=e[r],o=e[(r+1)%t],s=e[(r+2)%t];n+=`C${Q(a[0]+(o[0]-i[0])/6)} ${Q(a[1]+(o[1]-i[1])/6)} ${Q(o[0]-(s[0]-a[0])/6)} ${Q(o[1]-(s[1]-a[1])/6)} ${Q(o[0])} ${Q(o[1])}`}return n+`Z`},st=(e,t,n,r)=>`M${Q(e-n)} ${Q(t)}a${Q(n)} ${Q(r)} 0 1 0 ${Q(2*n)} 0a${Q(n)} ${Q(r)} 0 1 0 ${Q(-2*n)} 0Z`;function ct(e,t,n){let r=me(e),i=[r()*6,r()*6],a=[];for(let e=0;e<14;e++){let r=e/14*Math.PI*2,o=1+.06*Math.sin(2*r+i[0])+.035*Math.sin(3*r+i[1]),s=t/2*Math.cos(r)*o,c=-n/2+n/2*Math.sin(r)*o;c>-n*.06&&(c=-n*.06+(c+n*.06)*.25),s*=c<-n*.75?.94:1,a.push([s,c])}return{d:ot(a),pts:a}}function lt(n){let r=rt.items.map(e=>{let t=ae(e.company),n=t?.models.find(t=>t.name===e.model);return{...e,maker:t?.name??e.company,m:n,open:!!n?.openWeights}}),a=[r.flatMap((e,t)=>e.open?[]:[t]),r.flatMap((e,t)=>e.open?[t]:[])],l=c(`div`,{class:`t9 t9m`}),u=s(`svg`,{class:`t9m-sand`,"aria-hidden":`true`}),d=c(`div`,{class:`t9m-card`,"aria-live":`polite`}),f=r.map((e,t)=>c(`button`,{class:`t9m-stone`,type:`button`,"aria-pressed":`false`,onClick:()=>x(t)},c(`span`,{class:`t9m-name`},e.model))),p=rt.groups.map(e=>c(`p`,{class:`t9m-glabel`,id:t(`t9m-g`)},e)),m=a.map((e,t)=>c(`div`,{class:`t9m-set`,role:`group`,"aria-labelledby":p[t].id},...e.map(e=>f[e]))),h=c(`div`,{class:`t9m-stones`,role:`group`,"aria-label":rt.group},...m,...p);l.append(u,d,h),n.art.append(l),n.prompt(rt.prompt);let g=new Set,ee=-1,_=[],v=t(`t9m`);function y(){let e=l.clientWidth,t=l.clientHeight;if(!e||!t)return;let n=ce(l);l.dataset.layout=n;let o=n===`short`,c=o?Math.min(e*.42,300):0,m=o?4:Math.min(Math.max(n===`tall`?t*.36:t*.34,150),210),h=o?c-16:Math.min(n===`tall`?e:560,e-8);Object.assign(d.style,{left:o?`0px`:`${(e-h)/2}px`,width:`${h}px`,maxHeight:`${o?t:m-8}px`});let g=e=>a.map(t=>{let n=t.map(t=>e[t].x),r=t.map(t=>e[t].y-e[t].h*.42),i=(Math.min(...t.map(t=>e[t].x-e[t].w/2))+Math.max(...t.map(t=>e[t].x+e[t].w/2)))/2,a=(Math.min(...r)+Math.max(...r))/2,o=(Math.max(...n)-Math.min(...n))/2+Math.max(...t.map(t=>e[t].w))*.64;return{cx:i,cy:a,rx:o,ry:Math.max((Math.max(...r)-Math.min(...r))/2+Math.max(...t.map(t=>e[t].h))*(y?.72:.95),o*.32),n:y?2:3}}),y=n===`tall`;l.style.setProperty(`--k`,`1`);let b={x:c+10,y:m+(o?4:10),w:e-c-20,h:t-m-(o?4:10)-10},x=1,S=[],C=8;for(let t=0;t<5;t++){l.style.setProperty(`--k`,x.toFixed(3)),C=Math.max(5,8*x);let i=f.map(e=>e.firstElementChild.offsetWidth).map(e=>e+46*x),s=i.map((e,t)=>Math.max(44*x,Math.min(e*at[t],92*x))),c=Math.max(...i)+14*x,u=Math.max(...s)+(y?18:30)*x,d=it[n];S=r.map(()=>({x:0,y:0,w:0,h:0})),a.forEach((e,t)=>e.forEach((e,n)=>{let[r,a]=d.g[t][n];S[e]={x:d.at[t][0]*b.w+r*c,y:d.at[t][1]*b.h+a*u,w:i[e],h:s[e]}}));let p=e=>e.ry+e.n*C*.55;if(n===`tall`){let e=g(S),t=e[0].cy+p(e[0])+22+6+p(e[1])-e[1].cy;a[1].forEach(e=>S[e].y+=t)}let m=g(S),h=Math.min(...S.map(e=>e.x-e.w/2)),ee=Math.max(...S.map(e=>e.x+e.w/2)),_=o?Math.min(...S.map(e=>e.y-e.h))-22:Math.min(...m.map(e=>e.cy-p(e)))-22,v=Math.max(...o?S.map(e=>e.y+8):m.map(e=>e.cy+p(e))),w=Math.min(b.w/(ee-h),b.h/(v-_)),T=Math.max(.62,Math.min(1.32,x*w*(t?.99:.94)));if(t<4&&(w<.985&&T<x||t===0&&T>x*1.04)){x=T;continue}let E=b.x+(b.w-(ee-h))/2-h,D=b.y+Math.max(0,(b.h-(v-_))/2)-_;S.forEach(t=>{t.x=Math.min(e-10-t.w/2,Math.max(10+t.w/2,t.x+E)),t.y+=D});break}u.setAttribute(`viewBox`,`0 0 ${e} ${t}`),u.replaceChildren();let w=m-(o?0:10),T=s(`defs`,null,s(`linearGradient`,{id:`${v}-st`,x1:0,y1:0,x2:.25,y2:1},s(`stop`,{offset:0,class:`s0`}),s(`stop`,{offset:1,class:`s1`})),s(`linearGradient`,{id:`${v}-fade`,x1:0,y1:0,x2:0,y2:1},s(`stop`,{offset:Math.max(0,w/t),"stop-color":`#fff`,"stop-opacity":0}),s(`stop`,{offset:Math.min(.99,(w+Math.min(90,t*.16))/t),"stop-color":`#fff`,"stop-opacity":1})));u.append(T);let E=g(S),D=(e,t)=>{let n=t.cx-e.cx,r=t.cy-e.cy,i=Math.hypot(n,r)||1;return 1/Math.hypot(n/i/(e.rx+e.n*C),r/i/(e.ry+e.n*C*.55))+1/Math.hypot(n/i/(t.rx+t.n*C),r/i/(t.ry+t.n*C*.55))>i-6};for(let e=0;e<6&&D(E[0],E[1]);e++)E[0].n>1&&E[0].n--,E[1].n>1&&E[1].n--,E[0].n===1&&E[1].n===1&&E.forEach(e=>(e.rx*=.94,e.ry*=.94));let te=s(`mask`,{id:`${v}-mask`,maskUnits:`userSpaceOnUse`,x:0,y:0,width:e,height:t},s(`rect`,{x:0,y:0,width:e,height:t,fill:`url(#${v}-fade)`}),...E.map(e=>s(`path`,{d:st(e.cx,e.cy,e.rx+e.n*C+C*.6,e.ry+(e.n*C+C*.6)*.55),fill:`#000`}))),ne=s(`mask`,{id:`${v}-fo`,maskUnits:`userSpaceOnUse`,x:0,y:0,width:e,height:t},s(`rect`,{x:0,y:0,width:e,height:t,fill:`url(#${v}-fade)`}));T.append(te,ne);let re=s(`g`,{mask:`url(#${v}-mask)`});for(let n=w,r=0;n<t+10;r++){let i=[];for(let t=-10;t<=e+24;t+=24)i.push(`${t} ${(n+1.2*Math.sin(t/47+r*.6)).toFixed(1)}`);let a=`M${i.join(`L`)}`;re.append(s(`path`,{d:a,class:`rk`}),s(`path`,{d:a,class:`rk-hi`,transform:`translate(0 1.5)`})),n+=7+9*((n-w)/Math.max(1,t-w))}u.append(re);let ie=s(`g`,{mask:`url(#${v}-fo)`});for(let e of E)for(let t=0;t<=e.n;t++){let n=st(e.cx,e.cy,e.rx+t*C,e.ry+t*C*.55);ie.append(s(`path`,{d:n,class:`rk`}),s(`path`,{d:n,class:`rk-hi`,transform:`translate(0 1.5)`}))}u.append(ie),E.forEach((t,n)=>{let r=p[n],i=Math.max(2,t.cy-(t.ry+t.n*C*.55)-22+2);Object.assign(r.style,{left:`${Math.max(4,Math.min(e-r.offsetWidth-4,t.cx-r.offsetWidth/2))}px`,top:`${i}px`})});let O=S.map((e,t)=>{let{d:n,pts:r}=ct(40+t*7,e.w,e.h),o=s(`path`,{class:`sh`,d:st(e.x+e.w*.06,e.y+1,e.w*.56,Math.max(4,e.w*.1)),filter:`url(#ink-wash)`}),c=s(`g`,{class:`rip`}),l=r.filter(([t,n])=>n<-e.h*.35&&t<e.w*.3),u=r.filter(([t,n])=>n>-e.h*.6||t>e.w*.28),d=e=>e.length>1?`M${e.map(([e,t])=>`${Q(e)} ${Q(t)}`).join(`L`)}`:``,p=me(90+t),m=s(`g`,{class:`t9m-body`},s(`path`,{d:n,fill:`url(#${v}-st)`,filter:`url(#ink-rough)`}),s(`path`,{class:`shade`,d:ot([...u.map(([e,t])=>[e,t]),[e.w*.05,-e.h*.35]]),filter:`url(#ink-wash)`}),s(`path`,{class:`edge`,d:n,filter:`url(#ink-rough)`}),s(`path`,{class:`rim`,d:d(l)}),s(`g`,{class:`dry`,filter:`url(#ink-dry)`},...[0,1].map(t=>{let n=-e.w*(.3-t*.42)+p()*6,r=-e.h*(.78+p()*.1);return s(`path`,{d:`M${Q(n)} ${Q(r)} Q ${Q(n+e.w*.1)} ${Q(r-3)} ${Q(n+e.w*.18)} ${Q(r+e.h*.08)}`,"stroke-width":Q(2.5+t*1.5)})})),t===a[0][0]||t===a[1][1]?s(`path`,{class:`moss`,d:st(-e.w*.18,-e.h*.93,e.w*.11,e.h*.07),filter:`url(#ink-rough)`}):null),h=s(`g`,{transform:`translate(${Q(e.x)} ${Q(e.y)})`},m);return t===ee&&i.set(m,{y:-8}),Object.assign(f[t].style,{left:`${e.x-e.w/2}px`,top:`${e.y-e.h-4}px`,width:`${e.w}px`,height:`${e.h+10}px`}),{y:e.y,layers:[c,o,h],part:{g:m,rip:c,x:e.x,y:e.y,w:e.w}}});[...O].sort((e,t)=>e.y-t.y).forEach(e=>u.append(...e.layers)),_=O.map(e=>e.part)}let b=(e,t)=>({text:t,asOf:e.asOf,source:e.source,verify:e.verify});function x(t){if(t===ee)return;let a=ee;ee=t;let u=r[t];f.forEach((e,n)=>e.setAttribute(`aria-pressed`,String(n===t))),a<0&&l.classList.add(`named`),n.anim(()=>{if(a>=0){let e=_[a];n.reduced?i.set(e.g,{y:0}):i.to(e.g,{y:0,duration:.7,ease:`power2.in`})}let r=_[t];if(n.reduced)i.set(r.g,{y:-8});else{i.to(r.g,{y:-8,duration:.9,ease:`power3.out`}),r.rip.replaceChildren();let e=[0,1,2].map(()=>s(`path`,{d:st(r.x,r.y,r.w*.56,r.w*.13)}));r.rip.append(...e),e.forEach((e,t)=>i.fromTo(e,{scale:1,opacity:.7,svgOrigin:`${r.x} ${r.y}`},{scale:2.2,opacity:0,duration:2.2,delay:t*.35,ease:`power2.out`}))}let l=u.m,f=[c(`h3`,{class:`t9m-title`},u.model),c(`p`,{class:`t9m-maker`},u.maker)];l?.date&&f.push(n.fact(b(l,o(rt.released,{date:e(l.date)})),`p`,`t9m-date`)),l?.strengths&&f.push(n.fact(l.strengths,`p`,`t9m-str`)),l?.note&&f.push(n.fact(b(l,l.note),`p`,`t9m-note`)),d.replaceChildren(...f),n.reduced||i.fromTo(d.children,{opacity:0,y:10,filter:`blur(5px)`},{opacity:1,y:0,filter:`blur(0px)`,duration:1,stagger:.1,ease:`power3.out`,clearProps:`filter`})}),g.has(t)||(g.add(t),f[t].classList.add(`seen`)),n.chime(`soft`),g.size===3&&n.insight(rt.insight,rt.detail)}let S=0,C=new ResizeObserver(()=>{cancelAnimationFrame(S),S=requestAnimationFrame(y)});return C.observe(l),y(),document.fonts?.ready.then(()=>l.isConnected&&y()),()=>{C.disconnect(),cancelAnimationFrame(S),l.remove()}}var ut=A.scenes,dt={content:A,scenes:[{label:ut.pipeline.label,mount:Je},{label:ut.splats.label,mount:et},{label:ut.input.label,mount:nt},{label:ut.models.label,mount:lt}]};export{dt as default};