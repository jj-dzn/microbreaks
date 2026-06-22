if (!window.__microbreaksLoaded) {
window.__microbreaksLoaded = true;

const PI = Math.PI;
function lerp(a, b, t) { return a + (b - a) * t; }
function ease(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }
function sin01(t) { return Math.sin(t * PI * 2) * 0.5 + 0.5; }
function h(tag, a) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(a || {}).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

const F = {
  sk:'#F5DEB8',sk_d:'#E0B882',sk_dd:'#C89050',
  hair:'#F0D060',hair_d:'#D4A820',hair_s:'#FFF0A0',
  top:'#2ABFBF',top_d:'#1A8F8F',top_s:'#5ADEDF',
  leg:'#1A6B8A',leg_d:'#0F3D52',leg_s:'#2E9AB5',
  shoe:'#D4E8F0',shoe_d:'#9AC4D8',
  lip:'#E8829A',eye:'#4BA8D4',
};
const M = {
  sk:'#DBAB7A',sk_d:'#C08550',sk_dd:'#A06030',
  hair:'#1A0F0A',hair_d:'#0D0806',hair_s:'#3A2010',
  top:'#3B5BA8',top_d:'#243878',top_s:'#6080D0',
  leg:'#1E2D4A',leg_d:'#0F1825',leg_s:'#304070',
  shoe:'#2A1A10',shoe_d:'#180E08',
  lip:'#C07060',eye:'#4A7040',
};

function limb(svg, x1, y1, x2, y2, w1, w2, fill) {
  const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy)||1;
  const nx=-dy/len, ny=dx/len;
  const mx=(x1+x2)/2, my=(y1+y2)/2;
  svg.appendChild(h('path', {d:`M${x1+nx*w1},${y1+ny*w1} Q${mx+nx*w1*0.9},${my+ny*w1*0.9} ${x2+nx*w2},${y2+ny*w2} L${x2-nx*w2},${y2-ny*w2} Q${mx-nx*w1*0.9},${my-ny*w1*0.9} ${x1-nx*w1},${y1-ny*w1} Z`, fill, stroke:'none'}));
  svg.appendChild(h('path', {d:`M${x1+nx*w1*0.3},${y1+ny*w1*0.3} Q${mx+nx*w1*0.25},${my+ny*w1*0.25} ${x2+nx*w2*0.3},${y2+ny*w2*0.3}`, fill:'none', stroke:'rgba(255,255,255,0.22)', 'stroke-width':w1*0.55, 'stroke-linecap':'round'}));
}
function jnt(svg, cx, cy, r, fill) {
  svg.appendChild(h('circle', {cx, cy, r, fill}));
  svg.appendChild(h('ellipse', {cx:cx-r*0.2, cy:cy-r*0.25, rx:r*0.35, ry:r*0.25, fill:'rgba(255,255,255,0.2)'}));
}

function drawFace(svg, hx, hy, tilt, nod, male) {
  const C = male ? M : F;
  const fx = hx + tilt*8, fy = hy + nod*5;
  svg.appendChild(h('ellipse', {cx:fx, cy:fy, rx:male?13:12, ry:male?14:13.5, fill:C.sk}));
  svg.appendChild(h('path', {d:`M${fx-(male?11:10)},${fy+5} Q${fx-(male?8:7)},${fy+17} ${fx},${fy+(male?18:17)} Q${fx+(male?8:7)},${fy+17} ${fx+(male?11:10)},${fy+5}`, fill:C.sk}));
  svg.appendChild(h('ellipse', {cx:fx-(male?13:12), cy:fy+2, rx:3, ry:4.5, fill:C.sk_d}));
  svg.appendChild(h('ellipse', {cx:fx+(male?13:12), cy:fy+2, rx:3, ry:4.5, fill:C.sk_d}));
  if (male) {
    svg.appendChild(h('path', {d:`M${fx-13},${fy-3} C${fx-14},${fy-13} ${fx-8},${fy-20} ${fx},${fy-18} C${fx+8},${fy-20} ${fx+14},${fy-13} ${fx+13},${fy-3} C${fx+10},${fy-8} ${fx},${fy-10} ${fx-10},${fy-8} Z`, fill:C.hair}));
    svg.appendChild(h('path', {d:`M${fx-13},${fy-3} Q${fx-13},${fy+4} ${fx-11},${fy+6}`, fill:'none', stroke:C.hair, 'stroke-width':3, 'stroke-linecap':'round', opacity:0.6}));
    svg.appendChild(h('path', {d:`M${fx+13},${fy-3} Q${fx+13},${fy+4} ${fx+11},${fy+6}`, fill:'none', stroke:C.hair, 'stroke-width':3, 'stroke-linecap':'round', opacity:0.6}));
  } else {
    svg.appendChild(h('path', {d:`M${fx-12},${fy-2} C${fx-14},${fy-14} ${fx-8},${fy-22} ${fx},${fy-20} C${fx+8},${fy-22} ${fx+14},${fy-14} ${fx+12},${fy-2} C${fx+10},${fy-9} ${fx},${fy-11} ${fx-10},${fy-9} Z`, fill:C.hair_d}));
    svg.appendChild(h('path', {d:`M${fx-12},${fy-3} C${fx-13},${fy-13} ${fx-6},${fy-21} ${fx+2},${fy-20} C${fx+9},${fy-19} ${fx+13},${fy-12} ${fx+11},${fy-3} C${fx+6},${fy-8} ${fx-4},${fy-9} ${fx-10},${fy-6} Z`, fill:C.hair}));
    svg.appendChild(h('path', {d:`M${fx-4},${fy-20} Q${fx+2},${fy-22} ${fx+7},${fy-18}`, fill:'none', stroke:C.hair_s, 'stroke-width':1.8, 'stroke-linecap':'round', opacity:0.7}));
    svg.appendChild(h('path', {d:`M${fx+10},${fy-4} C${fx+14},${fy+4} ${fx+16},${fy+14} ${fx+14},${fy+26}`, fill:'none', stroke:C.hair_d, 'stroke-width':4, 'stroke-linecap':'round'}));
    for (let i = 0; i < 6; i++) {
      svg.appendChild(h('ellipse', {cx:fx+12+i*0.5, cy:fy+i*4, rx:2.5, ry:1.5, fill:i%2===0?C.hair:C.hair_d, opacity:0.9}));
    }
  }
  const brow = male ? 1.6 : 1.2;
  svg.appendChild(h('path', {d:`M${fx-9},${fy-5} Q${fx-5.5},${fy-8} ${fx-1},${fy-6}`, fill:'none', stroke:C.hair, 'stroke-width':brow, 'stroke-linecap':'round'}));
  svg.appendChild(h('path', {d:`M${fx+1},${fy-6} Q${fx+5.5},${fy-8} ${fx+9},${fy-5}`, fill:'none', stroke:C.hair, 'stroke-width':brow, 'stroke-linecap':'round'}));
  svg.appendChild(h('ellipse', {cx:fx-5.5, cy:fy, rx:4, ry:3, fill:'#FAFAFA'}));
  svg.appendChild(h('ellipse', {cx:fx+5.5, cy:fy, rx:4, ry:3, fill:'#FAFAFA'}));
  svg.appendChild(h('circle', {cx:fx-5.5, cy:fy, r:2.5, fill:C.eye}));
  svg.appendChild(h('circle', {cx:fx+5.5, cy:fy, r:2.5, fill:C.eye}));
  svg.appendChild(h('circle', {cx:fx-5.5, cy:fy, r:1.3, fill:'#08060A'}));
  svg.appendChild(h('circle', {cx:fx+5.5, cy:fy, r:1.3, fill:'#08060A'}));
  svg.appendChild(h('circle', {cx:fx-4.8, cy:fy-0.8, r:0.7, fill:'rgba(255,255,255,0.95)'}));
  svg.appendChild(h('circle', {cx:fx+6.2, cy:fy-0.8, r:0.7, fill:'rgba(255,255,255,0.95)'}));
  svg.appendChild(h('path', {d:`M${fx-9.5},${fy-0.5} Q${fx-5.5},${fy-4} ${fx-1.5},${fy-0.5}`, fill:'none', stroke:'rgba(20,10,5,0.7)', 'stroke-width':1.1, 'stroke-linecap':'round'}));
  svg.appendChild(h('path', {d:`M${fx+1.5},${fy-0.5} Q${fx+5.5},${fy-4} ${fx+9.5},${fy-0.5}`, fill:'none', stroke:'rgba(20,10,5,0.7)', 'stroke-width':1.1, 'stroke-linecap':'round'}));
  svg.appendChild(h('path', {d:`M${fx-1.5},${fy+4} Q${fx-3},${fy+8} ${fx-2},${fy+9} Q${fx},${fy+10} ${fx+2},${fy+9} Q${fx+3},${fy+8} ${fx+1.5},${fy+4}`, fill:'none', stroke:C.sk_dd, 'stroke-width':0.9, 'stroke-linecap':'round', opacity:0.55}));
  svg.appendChild(h('path', {d:`M${fx-4},${fy+12} Q${fx-2},${fy+10.5} ${fx},${fy+11.5} Q${fx+2},${fy+10.5} ${fx+4},${fy+12}`, fill:C.lip, opacity:0.85}));
  svg.appendChild(h('path', {d:`M${fx-4},${fy+12} Q${fx},${fy+16} ${fx+4},${fy+12}`, fill:C.lip, opacity:0.65}));
  svg.appendChild(h('path', {d:`M${fx-3.5},${fy+12} Q${fx},${fy+12.8} ${fx+3.5},${fy+12}`, fill:'none', stroke:'rgba(160,70,80,0.55)', 'stroke-width':0.7}));
  if (male) svg.appendChild(h('ellipse', {cx:fx, cy:fy+14, rx:7, ry:4, fill:'rgba(100,70,50,0.08)'}));
  svg.appendChild(h('ellipse', {cx:fx-3, cy:fy-5, rx:3.5, ry:4, fill:'rgba(255,255,255,0.13)'}));
}

function drawFigure(svg, cx, y0, pose, male) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const C = male ? M : F;
  const P = {
    headTilt:0, headNod:0, torsoLean:0,
    shlLang:-PI/10, shlRang:PI+PI/10,
    elbLang:-PI/12, elbRang:PI+PI/12,
    hipLang:PI*0.08, hipRang:PI*0.08,
    kneeLang:-PI*0.04, kneeRang:-PI*0.04,
    ...pose
  };
  const sw=male?13:10, tw=male?13:11, ww=male?10:8, hw=male?9:7;
  const HEAD_R=male?13:12, UA=21, FA=19, THIGH=28, SHIN=26, TORSO=38;
  const headY = y0 + HEAD_R;
  const neckBase = {x:cx+P.torsoLean*0.2, y:headY+HEAD_R+4};
  const chestTop = {x:cx+P.torsoLean*0.4, y:neckBase.y+5};
  const waistY = chestTop.y + TORSO*0.48;
  const hipsY = chestTop.y + TORSO;
  const shlL = {x:chestTop.x-sw, y:chestTop.y+5};
  const shlR = {x:chestTop.x+sw, y:chestTop.y+5};
  function arm(shl, a1, a2) {
    const elb = {x:shl.x+Math.sin(a1)*UA, y:shl.y+Math.cos(a1)*UA};
    const wri = {x:elb.x+Math.sin(a2)*FA, y:elb.y+Math.cos(a2)*FA};
    return {shl, elb, wri};
  }
  const aL = arm(shlL, P.shlLang, P.elbLang);
  const aR = arm(shlR, P.shlRang, P.elbRang);
  const hipL = {x:cx-hw, y:hipsY};
  const hipR = {x:cx+hw, y:hipsY};
  function leg(hip, a1, a2) {
    const knee = {x:hip.x+Math.sin(a1)*THIGH, y:hip.y+Math.cos(a1)*THIGH};
    const ank = {x:knee.x+Math.sin(a2)*SHIN, y:knee.y+Math.cos(a2)*SHIN};
    return {hip, knee, ank};
  }
  const lL = leg(hipL, P.hipLang, P.kneeLang);
  const lR = leg(hipR, P.hipRang, P.kneeRang);

  limb(svg, lR.hip.x,lR.hip.y, lR.knee.x,lR.knee.y, male?7:6, male?6.5:5.5, C.leg_d);
  limb(svg, lR.knee.x,lR.knee.y, lR.ank.x,lR.ank.y, male?6.5:5.5, male?5:4, C.leg_d);
  jnt(svg, lR.knee.x,lR.knee.y, male?6:5, C.leg_d);
  svg.appendChild(h('ellipse', {cx:lR.ank.x+3, cy:lR.ank.y+4, rx:9, ry:4, fill:C.shoe_d}));

  limb(svg, aR.shl.x,aR.shl.y, aR.elb.x,aR.elb.y, male?5.5:4.5, male?5:4, C.top_d);
  jnt(svg, aR.elb.x,aR.elb.y, male?4.5:3.5, C.top_d);
  limb(svg, aR.elb.x,aR.elb.y, aR.wri.x,aR.wri.y, male?5:4, male?3.5:3, C.sk_d);
  jnt(svg, aR.wri.x,aR.wri.y, male?3.5:3, C.sk_d);

  svg.appendChild(h('path', {
    d:`M${chestTop.x-tw},${chestTop.y} C${chestTop.x-tw-2},${waistY-4} ${cx-ww-1},${waistY+4} ${cx-hw+1},${hipsY} L${cx+hw-1},${hipsY} C${cx+ww+1},${waistY+4} ${chestTop.x+tw+2},${waistY-4} ${chestTop.x+tw},${chestTop.y} Z`,
    fill:C.top
  }));
  svg.appendChild(h('path', {d:`M${chestTop.x-3},${chestTop.y+4} C${chestTop.x-4},${waistY-5} ${chestTop.x-2},${waistY} ${chestTop.x-1},${waistY+3}`, fill:'none', stroke:C.top_s, 'stroke-width':2.5, 'stroke-linecap':'round', opacity:0.45}));
  if (!male) {
    svg.appendChild(h('path', {d:`M${chestTop.x-tw+3},${chestTop.y+8} Q${chestTop.x},${chestTop.y+6} ${chestTop.x+tw-3},${chestTop.y+8}`, fill:'none', stroke:C.top_d, 'stroke-width':1, opacity:0.45}));
  } else {
    svg.appendChild(h('path', {d:`M${chestTop.x-5},${chestTop.y} L${chestTop.x},${chestTop.y+8} L${chestTop.x+5},${chestTop.y}`, fill:'none', stroke:C.top_d, 'stroke-width':1.5, 'stroke-linecap':'round', 'stroke-linejoin':'round'}));
  }
  svg.appendChild(h('rect', {x:cx-hw-1, y:hipsY-4, width:(hw+1)*2, height:5, rx:2, fill:C.leg_d}));

  limb(svg, lL.hip.x,lL.hip.y, lL.knee.x,lL.knee.y, male?7.5:6.5, male?7:6, C.leg);
  limb(svg, lL.knee.x,lL.knee.y, lL.ank.x,lL.ank.y, male?7:6, male?5.5:4.5, C.leg);
  jnt(svg, lL.knee.x,lL.knee.y, male?6.5:5.5, C.leg);
  limb(svg, lL.hip.x+1,lL.hip.y, lL.knee.x+1,lL.knee.y, 1.5, 1, C.leg_s, false);
  svg.appendChild(h('ellipse', {cx:lL.ank.x+3, cy:lL.ank.y+4, rx:9, ry:4, fill:C.shoe}));
  svg.appendChild(h('ellipse', {cx:lL.ank.x+2, cy:lL.ank.y+2, rx:5, ry:2, fill:'rgba(255,255,255,0.2)'}));

  svg.appendChild(h('rect', {x:neckBase.x-4, y:neckBase.y-5, width:8, height:10, rx:3, fill:C.sk}));

  limb(svg, aL.shl.x,aL.shl.y, aL.elb.x,aL.elb.y, male?5.5:4.5, male?5:4, C.top);
  jnt(svg, aL.elb.x,aL.elb.y, male?4.5:4, C.top);
  limb(svg, aL.elb.x,aL.elb.y, aL.wri.x,aL.wri.y, male?5:4, male?3.5:3, C.sk);
  jnt(svg, aL.wri.x,aL.wri.y, male?3.5:3.5, C.sk);
  svg.appendChild(h('ellipse', {cx:aL.wri.x, cy:aL.wri.y+3, rx:4, ry:3, fill:C.sk}));

  drawFace(svg, cx+P.headTilt*8, headY+P.headNod*5, P.headTilt, P.headNod, male);
}

let mbMessages = null;

async function loadMbMessages(lang) {
  try {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const res = await fetch(url);
    mbMessages = await res.json();
  } catch (e) {
    if (lang !== 'en') {
      const url = chrome.runtime.getURL(`_locales/en/messages.json`);
      const res = await fetch(url);
      mbMessages = await res.json();
    }
  }
}

function mbT(key) {
  if (!mbMessages || !mbMessages[key]) return key;
  return mbMessages[key].message;
}

const STRETCH_DATA = [
  { key: 'stretchNeckRolls', dur: '30 sec',
    pose(t){const r=Math.sin(t*PI*0.8)*0.38;return{headTilt:r,headNod:Math.abs(r)*0.25};}},
  { key: 'stretchOverheadReach', dur: '30 sec',
    pose(t){const up=ease(sin01(t*0.5));return{shlLang:lerp(-PI/10,-PI*0.88,up),elbLang:lerp(-PI/12,-PI*0.92,up),shlRang:lerp(PI+PI/10,PI+PI*0.88,up),elbRang:lerp(PI+PI/12,PI+PI*0.92,up),headNod:lerp(0,-0.1,up)};}},
  { key: 'stretch2020', dur: '20 sec',
    pose(t){const l=ease(sin01(t*0.33));return{headTilt:lerp(0,0.06,l),headNod:lerp(0,-0.08,l)};}},
  { key: 'stretchWristCircles', dur: '20 sec',
    pose(t){const a=t*PI*2;return{shlLang:-PI/8,elbLang:-PI/8+Math.sin(a)*0.3,shlRang:PI+PI/8,elbRang:PI+PI/8+Math.sin(-a)*0.3};}},
  { key: 'stretchShoulderRolls', dur: '30 sec',
    pose(t){const a=t*PI*2;return{shlLang:-PI/10+Math.sin(a)*0.35,shlRang:PI+PI/10+Math.sin(-a)*0.35,elbLang:-PI/12+Math.cos(a)*0.2,elbRang:PI+PI/12+Math.cos(-a)*0.2};}},
  { key: 'stretchSpinalTwist', dur: '30 sec',
    pose(t){const tw=Math.sin(t*PI*0.7)*0.38;return{headTilt:tw*0.5,torsoLean:tw*8,shlLang:-PI/10+tw*0.5,shlRang:PI+PI/10+tw*0.5,elbLang:-PI/12+tw*0.25,elbRang:PI+PI/12+tw*0.25};}},
  { key: 'stretchForwardFold', dur: '30 sec',
    pose(t){const fold=ease(sin01(t*0.5));return{torsoLean:lerp(0,10,fold),headNod:lerp(0,0.45,fold),headTilt:lerp(0,0.1,fold),shlLang:lerp(-PI/10,PI*0.08,fold),elbLang:lerp(-PI/12,PI*0.12,fold),shlRang:lerp(PI+PI/10,PI-PI*0.08,fold),elbRang:lerp(PI+PI/12,PI-PI*0.12,fold)};}},
  { key: 'stretchChestOpener', dur: '30 sec',
    pose(t){const o=ease(sin01(t*0.5));return{shlLang:lerp(-PI/10,-PI/2.2,o),elbLang:lerp(-PI/12,-PI/2,o),shlRang:lerp(PI+PI/10,PI+PI/2.2,o),elbRang:lerp(PI+PI/12,PI+PI/2,o),headNod:lerp(0,-0.15,o)};}},
  { key: 'stretchSideStretch', dur: '30 sec',
    pose(t){const lean=Math.sin(t*PI*0.7)*0.16;const r=lean>0;return{torsoLean:lean*30,headTilt:lean*0.45,shlLang:r?lerp(-PI/10,-PI*0.72,lean/0.16):-PI/10,elbLang:r?lerp(-PI/12,-PI*0.78,lean/0.16):-PI/12,shlRang:r?PI+PI/10:lerp(PI+PI/10,PI+PI*0.72,-lean/0.16),elbRang:r?PI+PI/12:lerp(PI+PI/12,PI+PI*0.78,-lean/0.16)};}},
  { key: 'stretchChinTucks', dur: '20 sec',
    pose(t){const tk=ease(sin01(t*0.5));return{headNod:lerp(0,0.22,tk),headTilt:lerp(0,-0.04,tk)};}},
  { key: 'stretchUpperBackSqueeze', dur: '30 sec',
    pose(t){const sq=ease(sin01(t*0.5));return{shlLang:lerp(-PI/10,-PI/14,sq),elbLang:lerp(-PI/12,PI/10,sq),shlRang:lerp(PI+PI/10,PI+PI/14,sq),elbRang:lerp(PI+PI/12,PI-PI/10,sq)};}},
  { key: 'stretchTempleMassage', dur: '20 sec',
    pose(t){const pulse=Math.sin(t*PI*3)*0.035;return{shlLang:-PI*0.58+pulse,elbLang:-PI*0.65+pulse,shlRang:PI+PI*0.58-pulse,elbRang:PI+PI*0.65-pulse,headTilt:pulse*1.5};}},
  { key: 'stretchAnkleCircles', dur: '20 sec',
    pose(t){const a=t*PI*2;return{hipLang:PI*0.52+Math.sin(a)*0.05,kneeLang:PI*0.06+Math.sin(a)*0.04,hipRang:PI*0.48+Math.sin(-a)*0.05,kneeRang:PI*0.06+Math.sin(-a)*0.04};}},
  { key: 'stretchFingerSpreads', dur: '20 sec',
    pose(t){const sp=ease(sin01(t*0.5));return{shlLang:-PI/8,elbLang:-PI/10+lerp(0,0.08,sp),shlRang:PI+PI/8,elbRang:PI+PI/10-lerp(0,0.08,sp)};}},
  { key: 'stretchHipStretch', dur: '30 sec',
    pose(t){const lift=ease(sin01(t*0.5));return{hipLang:lerp(PI*0.08,-PI*0.25,lift),kneeLang:lerp(-PI*0.04,-PI*0.2,lift)};}},
];

function getStretches() {
  return STRETCH_DATA.map(s => ({
    name: mbT(s.key),
    dur: s.dur,
    steps: [1,2,3,4,5].map(n => mbT(s.key + 'Step' + n)),
    pose: s.pose,
  }));
}

function removeOverlay() {
  const el = document.getElementById('microbreaks-overlay');
  if (el) el.remove();
  document.removeEventListener('keydown', onEscape);
}

function onEscape(e) {
  if (e.key === 'Escape') { chrome.runtime.sendMessage({type:'START'}); removeOverlay(); }
}

async function showOverlay(stretchIndex, male, lang) {
  await loadMbMessages(lang || 'en');
  removeOverlay();
  const STRETCHES = getStretches();
  const idx = stretchIndex % STRETCHES.length;
  const s = STRETCHES[idx];

  const overlay = document.createElement('div');
  overlay.id = 'microbreaks-overlay';
  Object.assign(overlay.style, {
    position:'fixed', inset:'0', zIndex:'2147483647',
    background:'rgba(15,35,40,0.96)',
    display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center',
    fontFamily:"'Inter',-apple-system,sans-serif",
    cursor:'pointer', overflowY:'auto',
  });

  const card = document.createElement('div');
  Object.assign(card.style, {
    textAlign:'center', maxWidth:'420px', width:'100%',
    padding:'0 24px 32px', cursor:'default',
    display:'flex', flexDirection:'column', alignItems:'center',
  });

  // Figure SVG
  const figSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  figSvg.setAttribute('viewBox', '0 0 100 160');
  figSvg.setAttribute('width', '160');
  figSvg.setAttribute('height', '256');
  card.appendChild(figSvg);

  // Stretch name
  const nameEl = document.createElement('div');
  nameEl.textContent = s.name;
  Object.assign(nameEl.style, {fontSize:'22px', fontWeight:'500', color:'#F7F9F8', margin:'16px 0 6px', letterSpacing:'-0.3px'});
  card.appendChild(nameEl);

  // Duration badge
  const durEl = document.createElement('div');
  durEl.textContent = s.dur;
  Object.assign(durEl.style, {fontSize:'11px', fontWeight:'500', color:'#5DB8A0', background:'rgba(93,184,160,0.12)', border:'0.5px solid rgba(93,184,160,0.3)', borderRadius:'20px', padding:'3px 12px', marginBottom:'16px', display:'inline-block'});
  card.appendChild(durEl);

  // Steps
  const stepsEl = document.createElement('ol');
  Object.assign(stepsEl.style, {listStyle:'none', textAlign:'left', width:'100%', display:'flex', flexDirection:'column', gap:'6px', marginBottom:'24px'});
  s.steps.forEach((step, i) => {
    const li = document.createElement('li');
    Object.assign(li.style, {display:'flex', gap:'10px', fontSize:'13px', color:'rgba(170,217,207,0.85)', lineHeight:'1.55'});
    const num = document.createElement('span');
    num.textContent = i + 1;
    Object.assign(num.style, {color:'#5DB8A0', fontWeight:'500', flexShrink:'0', width:'16px'});
    const text = document.createElement('span');
    text.textContent = step;
    li.append(num, text);
    stepsEl.appendChild(li);
  });
  card.appendChild(stepsEl);

  // Done button
  const doneBtn = document.createElement('button');
  doneBtn.textContent = mbT('doneIMoved');
  Object.assign(doneBtn.style, {background:'#5DB8A0', color:'#1D3D38', border:'none', borderRadius:'10px', padding:'12px 36px', fontSize:'14px', fontWeight:'500', cursor:'pointer', fontFamily:'inherit', marginBottom:'12px'});
  doneBtn.onmouseover = () => doneBtn.style.background = '#6ECAB5';
  doneBtn.onmouseout = () => doneBtn.style.background = '#5DB8A0';
  card.appendChild(doneBtn);

  const hint = document.createElement('div');
  hint.textContent = mbT('dismissHint');
  Object.assign(hint.style, {fontSize:'11px', color:'rgba(170,217,207,0.3)'});
  card.appendChild(hint);

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Animate
  let animId = null, startTs = null;
  (function frame(ts) {
    if (!startTs) startTs = ts;
    const t = ((ts - startTs) / 1000) % 100;
    drawFigure(figSvg, 50, 10, s.pose(t), male);
    animId = requestAnimationFrame(frame);
  })(performance.now());

  doneBtn.addEventListener('click', () => {
    cancelAnimationFrame(animId);
    chrome.runtime.sendMessage({type:'START'});
    removeOverlay();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      cancelAnimationFrame(animId);
      chrome.runtime.sendMessage({type:'START'});
      removeOverlay();
    }
  });
  document.addEventListener('keydown', onEscape);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_BREAK_OVERLAY') showOverlay(msg.stretchIndex, msg.male, msg.lang);
  if (msg.type === 'HIDE_BREAK_OVERLAY') removeOverlay();
});

}
