if (!window.__microbreaksLoaded) {
window.__microbreaksLoaded = true;

const PI = Math.PI;
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOutBack(t) { const c1=1.70158, c3=c1+1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); }
function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }
function sin01(t) { return Math.sin(t * PI * 2) * 0.5 + 0.5; }
function h(tag, a) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(a || {}).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

// ===== THEMES =====
const THEMES = {
  sage:  { bg:'#1D3D38', teal:'#5DB8A0', tealD:'#2a8a74', amber:'#E8A84C', cream:'#F7F9F8', top:'#2ABFBF', topD:'#15807f', leg:'#1A6B8A', legD:'#0c3245', outline:'#0a2420' },
  dusk:  { bg:'#2E1F3D', teal:'#B594D6', tealD:'#7a589c', amber:'#E89AC9', cream:'#F7F4FA', top:'#9B6FC4', topD:'#684485', leg:'#5C3D7A', legD:'#321f47', outline:'#1a1024' },
  ocean: { bg:'#0F2D3D', teal:'#4FB3D9', tealD:'#2d7c98', amber:'#7FE0C4', cream:'#F0F8FA', top:'#3A9BC4', topD:'#216685', leg:'#1D5470', legD:'#0d2e3d', outline:'#06181f' },
};
const SKIN_F='#F5DEB8', SKIN_D_F='#E0B882', HAIR_F='#F0D060', HAIR_D_F='#D4A820', LIP='#E8829A', EYE_F='#4BA8D4';
const SKIN_M='#DBAB7A', SKIN_D_M='#C08550', HAIR_M='#1A0F0A', HAIR_D_M='#0D0806', EYE_M='#4A7040';

function getTheme(name) { return THEMES[name] || THEMES.sage; }

// ===== TIME OF DAY RING TINT =====
// Subtle warmth shift on the accent color depending on local hour — cooler in
// morning, warmer in the evening. Purely decorative, no functional change.
function timeOfDayAccent(amber) {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return amber; // morning — unchanged
  if (hour >= 17 || hour < 5) {
    // evening/night — shift warmer
    return shiftWarm(amber, 0.15);
  }
  return amber; // midday — unchanged
}
function shiftWarm(hex, amt) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const nr = Math.min(255, r + 30*amt), ng = Math.max(0, g - 10*amt), nb = Math.max(0, b - 20*amt);
  return `rgb(${Math.round(nr)},${Math.round(ng)},${Math.round(nb)})`;
}

// ===== FIGURE RENDERING (front-facing) =====

function limb(svg, x1, y1, x2, y2, w1, w2, fill, outline) {
  const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy)||1;
  const nx=-dy/len, ny=dx/len;
  const path = `M${x1+nx*w1},${y1+ny*w1} L${x2+nx*w2},${y2+ny*w2} L${x2-nx*w2},${y2-ny*w2} L${x1-nx*w1},${y1-ny*w1} Z`;
  svg.appendChild(h('path', {d:path, fill, stroke:outline, 'stroke-width':1.4, 'stroke-linejoin':'round'}));
  svg.appendChild(h('line', {x1:x1+nx*w1*0.3, y1:y1+ny*w1*0.3, x2:x2+nx*w2*0.3, y2:y2+ny*w2*0.3, stroke:'rgba(255,255,255,0.38)', 'stroke-width':w1*0.4, 'stroke-linecap':'round'}));
}
function jnt(svg, cx, cy, r, fill, outline) {
  svg.appendChild(h('circle', {cx, cy, r, fill, stroke:outline, 'stroke-width':1.2}));
  svg.appendChild(h('ellipse', {cx:cx-r*0.2, cy:cy-r*0.25, rx:r*0.35, ry:r*0.25, fill:'rgba(255,255,255,0.3)'}));
}

function drawFace(svg, fx, fy, tilt, nod, O, male) {
  fx = fx + tilt*8; fy = fy + nod*5;
  const SKIN = male ? SKIN_M : SKIN_F, SKIN_D = male ? SKIN_D_M : SKIN_D_F;
  const HAIR = male ? HAIR_M : HAIR_F, HAIR_D = male ? HAIR_D_M : HAIR_D_F;
  const EYE = male ? EYE_M : EYE_F;

  svg.appendChild(h('ellipse', {cx:fx, cy:fy, rx:13, ry:14.5, fill:SKIN, stroke:O, 'stroke-width':1.3}));
  svg.appendChild(h('path', {d:`M${fx-10.5},${fy+5.5} Q${fx-7},${fy+18} ${fx},${fy+18} Q${fx+7},${fy+18} ${fx+10.5},${fy+5.5}`, fill:SKIN, stroke:O, 'stroke-width':1.3}));
  svg.appendChild(h('ellipse', {cx:fx-13, cy:fy+2, rx:3, ry:4.7, fill:SKIN_D, stroke:O, 'stroke-width':1}));
  svg.appendChild(h('ellipse', {cx:fx+13, cy:fy+2, rx:3, ry:4.7, fill:SKIN_D, stroke:O, 'stroke-width':1}));

  if (male) {
    svg.appendChild(h('path', {d:`M${fx-13},${fy-3} C${fx-14},${fy-14} ${fx-8},${fy-21} ${fx},${fy-19} C${fx+8},${fy-21} ${fx+14},${fy-14} ${fx+13},${fy-3} C${fx+10},${fy-9} ${fx},${fy-11} ${fx-10},${fy-9} Z`, fill:HAIR, stroke:O, 'stroke-width':1.3}));
    svg.appendChild(h('path', {d:`M${fx-13},${fy-3} Q${fx-13},${fy+4} ${fx-11},${fy+6}`, fill:'none', stroke:HAIR, 'stroke-width':3, 'stroke-linecap':'round', opacity:0.6}));
    svg.appendChild(h('path', {d:`M${fx+13},${fy-3} Q${fx+13},${fy+4} ${fx+11},${fy+6}`, fill:'none', stroke:HAIR, 'stroke-width':3, 'stroke-linecap':'round', opacity:0.6}));
  } else {
    svg.appendChild(h('path', {d:`M${fx-13},${fy-2} C${fx-15.5},${fy-15.5} ${fx-8},${fy-24} ${fx},${fy-22} C${fx+8},${fy-24} ${fx+15.5},${fy-15.5} ${fx+13},${fy-2} C${fx+10},${fy-10} ${fx},${fy-12.5} ${fx-10},${fy-10} Z`, fill:HAIR_D, stroke:O, 'stroke-width':1.3}));
    svg.appendChild(h('path', {d:`M${fx-12.5},${fy-3} C${fx-13.5},${fy-14.5} ${fx-6},${fy-23} ${fx},${fy-22} C${fx+6},${fy-23} ${fx+13.5},${fy-14.5} ${fx+12.5},${fy-3} C${fx+7},${fy-9} ${fx},${fy-10} ${fx-7},${fy-9} Z`, fill:HAIR}));
    svg.appendChild(h('path', {d:`M${fx-12},${fy-3} C${fx-16},${fy+5} ${fx-17},${fy+16} ${fx-15},${fy+27}`, fill:'none', stroke:HAIR_D, 'stroke-width':4, 'stroke-linecap':'round'}));
    svg.appendChild(h('path', {d:`M${fx+12},${fy-3} C${fx+16},${fy+5} ${fx+17},${fy+16} ${fx+15},${fy+27}`, fill:'none', stroke:HAIR_D, 'stroke-width':4, 'stroke-linecap':'round'}));
    for (let i = 0; i < 6; i++) {
      svg.appendChild(h('ellipse', {cx:fx-13.5-i*0.3, cy:fy+i*4.2, rx:2.3, ry:1.5, fill:i%2===0?HAIR:HAIR_D, opacity:0.95}));
      svg.appendChild(h('ellipse', {cx:fx+13.5+i*0.3, cy:fy+i*4.2, rx:2.3, ry:1.5, fill:i%2===0?HAIR:HAIR_D, opacity:0.95}));
    }
  }

  svg.appendChild(h('path', {d:`M${fx-10},${fy-6} Q${fx-6},${fy-9.5} ${fx-1.5},${fy-7}`, fill:'none', stroke:HAIR_D, 'stroke-width':1.4, 'stroke-linecap':'round'}));
  svg.appendChild(h('path', {d:`M${fx+1.5},${fy-7} Q${fx+6},${fy-9.5} ${fx+10},${fy-6}`, fill:'none', stroke:HAIR_D, 'stroke-width':1.4, 'stroke-linecap':'round'}));
  svg.appendChild(h('ellipse', {cx:fx-6, cy:fy, rx:4.4, ry:3.4, fill:'#FAFAFA', stroke:O, 'stroke-width':0.8}));
  svg.appendChild(h('ellipse', {cx:fx+6, cy:fy, rx:4.4, ry:3.4, fill:'#FAFAFA', stroke:O, 'stroke-width':0.8}));
  svg.appendChild(h('circle', {cx:fx-6, cy:fy, r:2.8, fill:EYE}));
  svg.appendChild(h('circle', {cx:fx+6, cy:fy, r:2.8, fill:EYE}));
  svg.appendChild(h('circle', {cx:fx-6, cy:fy, r:1.5, fill:'#08060A'}));
  svg.appendChild(h('circle', {cx:fx+6, cy:fy, r:1.5, fill:'#08060A'}));
  svg.appendChild(h('circle', {cx:fx-5.1, cy:fy-1, r:0.85, fill:'rgba(255,255,255,0.95)'}));
  svg.appendChild(h('circle', {cx:fx+6.9, cy:fy-1, r:0.85, fill:'rgba(255,255,255,0.95)'}));
  svg.appendChild(h('path', {d:`M${fx-10.5},${fy-0.5} Q${fx-6},${fy-4.8} ${fx-1},${fy-0.5}`, fill:'none', stroke:O, 'stroke-width':1.3, 'stroke-linecap':'round'}));
  svg.appendChild(h('path', {d:`M${fx+1},${fy-0.5} Q${fx+6},${fy-4.8} ${fx+10.5},${fy-0.5}`, fill:'none', stroke:O, 'stroke-width':1.3, 'stroke-linecap':'round'}));
  svg.appendChild(h('path', {d:`M${fx-1.5},${fy+5} Q${fx-2.5},${fy+8} ${fx},${fy+9} Q${fx+2.5},${fy+8} ${fx+1.5},${fy+5}`, fill:'none', stroke:SKIN_D, 'stroke-width':0.9, 'stroke-linecap':'round', opacity:0.6}));
  svg.appendChild(h('path', {d:`M${fx-4.5},${fy+13} Q${fx-2},${fy+11.2} ${fx},${fy+12.3} Q${fx+2},${fy+11.2} ${fx+4.5},${fy+13}`, fill:LIP, stroke:O, 'stroke-width':0.8}));
  svg.appendChild(h('path', {d:`M${fx-4.5},${fy+13} Q${fx},${fy+17} ${fx+4.5},${fy+13}`, fill:LIP, opacity:0.7}));
  svg.appendChild(h('ellipse', {cx:fx-3.5, cy:fy-6, rx:4, ry:4.5, fill:'rgba(255,255,255,0.16)'}));
}

function drawFigure(svg, T, pose, O, male) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const cx = 50;
  const P = {
    headTilt:0, headNod:0, torsoLean:0,
    armLOut:12, armROut:12, elbLOut:8, elbLFwd:18, elbROut:8, elbRFwd:18,
    legSpread:9, breathe:0, ...pose,
  };
  const tw = male?13:12, ww = male?10:9, hw = male?9:8;
  const HEAD_R = male?13.5:13, UA = 22, FA = 19, THIGH = 29, SHIN = 27, TORSO = 40;
  const y0 = 14;
  const headY = y0 + HEAD_R;
  const neckBase = {x:cx, y:headY+HEAD_R+4};
  const chestTop = {x:cx, y:neckBase.y+5-P.breathe*1.5};
  const waistY = chestTop.y + TORSO*0.48;
  const hipsY = chestTop.y + TORSO;
  const shlL = {x:cx-tw+2, y:chestTop.y+5};
  const shlR = {x:cx+tw-2, y:chestTop.y+5};

  function armPoint(shl, outDeg, sign) {
    const rad = outDeg*PI/180;
    return {x:shl.x+Math.sin(rad)*UA*sign, y:shl.y+Math.cos(rad)*UA};
  }
  const elbL = armPoint(shlL, P.armLOut, -1);
  const elbR = armPoint(shlR, P.armROut, 1);
  function forearmPoint(elb, outDeg, sign, fwd) {
    const rad = outDeg*PI/180;
    return {x:elb.x+Math.sin(rad)*FA*sign*0.6+fwd*0.5, y:elb.y+Math.cos(rad)*FA-fwd*0.3};
  }
  const wriL = forearmPoint(elbL, P.elbLOut, -1, P.elbLFwd);
  const wriR = forearmPoint(elbR, P.elbROut, 1, P.elbRFwd);

  const hipL = {x:cx-hw, y:hipsY}, hipR = {x:cx+hw, y:hipsY};
  const kneeL = {x:cx-P.legSpread, y:hipsY+THIGH};
  const kneeR = {x:cx+P.legSpread, y:hipsY+THIGH};
  const ankL = {x:cx-P.legSpread, y:hipsY+THIGH+SHIN};
  const ankR = {x:cx+P.legSpread, y:hipsY+THIGH+SHIN};

  const SHOE_R = male ? '#7a6a5a' : '#9AC4D8';
  const SHOE_L = male ? '#9a8a7a' : '#D4E8F0';

  limb(svg, hipR.x,hipR.y, kneeR.x,kneeR.y, 7,6.5, T.legD, O);
  limb(svg, kneeR.x,kneeR.y, ankR.x,ankR.y, 6.5,5, T.legD, O);
  jnt(svg, kneeR.x,kneeR.y, 6, T.legD, O);
  svg.appendChild(h('ellipse', {cx:ankR.x, cy:ankR.y+4, rx:9, ry:4, fill:SHOE_R, stroke:O, 'stroke-width':1.2}));

  limb(svg, shlR.x,shlR.y, elbR.x,elbR.y, 5.5,5, T.topD, O);
  jnt(svg, elbR.x,elbR.y, 4.5, T.topD, O);
  limb(svg, elbR.x,elbR.y, wriR.x,wriR.y, 5,3.5, male?SKIN_D_M:SKIN_D_F, O);
  jnt(svg, wriR.x,wriR.y, 3.8, male?SKIN_D_M:SKIN_D_F, O);

  limb(svg, hipL.x,hipL.y, kneeL.x,kneeL.y, 7.5,7, T.leg, O);
  limb(svg, kneeL.x,kneeL.y, ankL.x,ankL.y, 7,5.5, T.leg, O);
  jnt(svg, kneeL.x,kneeL.y, 6.5, T.leg, O);
  svg.appendChild(h('ellipse', {cx:ankL.x, cy:ankL.y+4, rx:9, ry:4, fill:SHOE_L, stroke:O, 'stroke-width':1.2}));

  svg.appendChild(h('path', {d:`M${cx-tw},${chestTop.y} C${cx-tw-2},${waistY-4} ${cx-ww-1},${waistY+4} ${cx-hw+1},${hipsY} L${cx+hw-1},${hipsY} C${cx+ww+1},${waistY+4} ${cx+tw+2},${waistY-4} ${cx+tw},${chestTop.y} Z`, fill:T.top, stroke:O, 'stroke-width':1.5, 'stroke-linejoin':'round'}));
  svg.appendChild(h('line', {x1:cx, y1:chestTop.y+5, x2:cx, y2:waistY+2, stroke:'rgba(255,255,255,0.3)', 'stroke-width':2.2, 'stroke-linecap':'round'}));
  svg.appendChild(h('rect', {x:cx-hw-1, y:hipsY-4, width:(hw+1)*2, height:5, rx:2, fill:T.legD, stroke:O, 'stroke-width':1.2}));

  svg.appendChild(h('rect', {x:cx-4, y:neckBase.y-5, width:8, height:10, rx:3, fill:male?SKIN_M:SKIN_F, stroke:O, 'stroke-width':1.1}));

  limb(svg, shlL.x,shlL.y, elbL.x,elbL.y, 5.5,5, T.top, O);
  jnt(svg, elbL.x,elbL.y, 4.5, T.top, O);
  limb(svg, elbL.x,elbL.y, wriL.x,wriL.y, 5,3.5, male?SKIN_M:SKIN_F, O);
  jnt(svg, wriL.x,wriL.y, 3.8, male?SKIN_M:SKIN_F, O);
  svg.appendChild(h('ellipse', {cx:wriL.x, cy:wriL.y+3, rx:4, ry:3, fill:male?SKIN_M:SKIN_F, stroke:O, 'stroke-width':1.1}));

  drawFace(svg, cx+P.headTilt*8, headY+P.headNod*5, P.headTilt, P.headNod, O, male);
  return {wristL:wriL, wristR:wriR, head:{x:cx+P.headTilt*8, y:headY+P.headNod*5}};
}

function motionArrow(svg, x, y, angleDeg, color, size) {
  const g = h('g', {transform:`translate(${x} ${y}) rotate(${angleDeg})`, opacity:0.9});
  g.appendChild(h('path', {d:`M0,0 Q${size*0.5},${-size*0.3} ${size},0`, fill:'none', stroke:color, 'stroke-width':2.4, 'stroke-linecap':'round', 'stroke-dasharray':'3 2.5'}));
  g.appendChild(h('path', {d:`M${size-3},${-3} L${size},0 L${size-3},3`, fill:'none', stroke:color, 'stroke-width':2.4, 'stroke-linecap':'round', 'stroke-linejoin':'round'}));
  svg.appendChild(g);
}

// ===== STRETCH POSE DEFINITIONS (front-facing rig params + motion cues) =====

const STRETCH_DATA = [
  { key:'stretchNeckRolls', dur:'30 sec', period:2500,
    pose(t){ const r=Math.sin(t*PI*0.8)*0.38; return {headTilt:r, headNod:Math.abs(r)*0.25}; },
    arrows(t,j,svg,color){ const g=h('g',{opacity:0.7}); g.appendChild(h('path',{d:`M${j.head.x-17},${j.head.y} A17,17 0 0,1 ${j.head.x+17},${j.head.y}`,fill:'none',stroke:color,'stroke-width':1.8,'stroke-dasharray':'2.5 2.5'})); svg.appendChild(g); } },
  { key:'stretchOverheadReach', dur:'30 sec', period:3600,
    pose(t){
      let up,breathe=0;
      if(t<0.25){up=easeOutBack(Math.min(1,t/0.25));}
      else if(t<0.67){up=1;breathe=Math.sin((t-0.25)/0.42*PI*2)*1.2;}
      else{up=1-easeInOut(Math.min(1,(t-0.67)/0.33));}
      return {armLOut:lerp(12,4,up), armROut:lerp(12,4,up), elbLOut:lerp(8,2,up), elbROut:lerp(8,2,up), elbLFwd:lerp(18,-26,up), elbRFwd:lerp(18,-26,up), headNod:lerp(0,-0.1,up), breathe, _up:up};
    },
    arrows(t,j,svg,color,pose){ if(pose._up>0.4){ motionArrow(svg,j.wristL.x-4,30,-95,color,9); motionArrow(svg,j.wristR.x+4,30,85,color,9); } } },
  { key:'stretch2020', dur:'20 sec', period:3000,
    pose(t){ const l=easeInOut(sin01(t/3*3*0.33)); return {headTilt:lerp(0,0.06,l), headNod:lerp(0,-0.08,l)}; } },
  { key:'stretchWristCircles', dur:'20 sec', period:1400,
    pose(t){ const a=t*PI*2; return {elbLFwd:18+Math.sin(a)*10, elbRFwd:18+Math.sin(-a)*10, elbLOut:8+Math.cos(a)*4, elbROut:8+Math.cos(-a)*4}; } },
  { key:'stretchShoulderRolls', dur:'30 sec', period:2000,
    pose(t){ const a=t*PI*2; return {armLOut:12+Math.sin(a)*5, armROut:12+Math.sin(-a)*5, elbLFwd:18+Math.cos(a)*6, elbRFwd:18+Math.cos(-a)*6}; } },
  { key:'stretchSpinalTwist', dur:'30 sec', period:3500,
    pose(t){ const tw=Math.sin(t*PI*2)*0.45; return {headTilt:tw*0.5, torsoLean:tw*10, armLOut:12+tw*8, armROut:12-tw*8}; } },
  { key:'stretchForwardFold', dur:'30 sec', period:3600,
    pose(t){
      let fold;
      if(t<0.3){fold=easeInOut(t/0.3);}
      else if(t<0.7){fold=1;}
      else{fold=1-easeInOut((t-0.7)/0.3);}
      return {torsoLean:lerp(0,8,fold), headNod:lerp(0,0.4,fold), headTilt:lerp(0,0.08,fold), elbLFwd:lerp(18,30,fold), elbRFwd:lerp(18,30,fold)};
    } },
  { key:'stretchChestOpener', dur:'30 sec', period:3600,
    pose(t){
      let o;
      if(t<0.3){o=easeInOut(t/0.3);} else if(t<0.7){o=1;} else{o=1-easeInOut((t-0.7)/0.3);}
      return {armLOut:lerp(12,22,o), armROut:lerp(12,22,o), elbLFwd:lerp(18,30,o), elbRFwd:lerp(18,30,o), headNod:lerp(0,-0.12,o)};
    } },
  { key:'stretchSideStretch', dur:'30 sec', period:3600,
    pose(t){ const lean=Math.sin(t*PI*2)*16; return {torsoLean:lean, headTilt:lean/30}; },
    arrows(t,j,svg,color,pose,rawT){ const lean=Math.sin(rawT*PI*2)*16; if(Math.abs(lean)>5)motionArrow(svg,50+(lean>0?-14:14),50,lean>0?180:0,color,9); } },
  { key:'stretchChinTucks', dur:'20 sec', period:2500,
    pose(t){ const tk=easeInOut(sin01(t/2.5*2.5*0.5)); return {headNod:lerp(0,0.22,tk), headTilt:lerp(0,-0.04,tk)}; } },
  { key:'stretchUpperBackSqueeze', dur:'30 sec', period:2800,
    pose(t){ const sq=Math.sin(t*PI*2)*0.5+0.5; return {armLOut:12-sq*4, armROut:12-sq*4, elbLFwd:18-sq*22, elbRFwd:18-sq*22}; } },
  { key:'stretchTempleMassage', dur:'20 sec', period:800,
    pose(t){ const pulse=Math.sin(t*PI*2)*4; return {armLOut:20, armROut:20, elbLFwd:-10+pulse, elbRFwd:-10-pulse, elbLOut:2, elbROut:2}; } },
  { key:'stretchAnkleCircles', dur:'20 sec', period:1400,
    pose(t){ const a=t*PI*2; return {legSpread:9+Math.sin(a)*2}; } },
  { key:'stretchFingerSpreads', dur:'20 sec', period:1800,
    pose(t){ const sp=Math.sin(t*PI*2)*0.5+0.5; return {elbLFwd:18+sp*4, elbRFwd:18+sp*4}; } },
  { key:'stretchHipStretch', dur:'30 sec', period:3600,
    pose(t){ let lift; if(t<0.3){lift=easeInOut(t/0.3);}else if(t<0.7){lift=1;}else{lift=1-easeInOut((t-0.7)/0.3);} return {legSpread:lerp(9,4,lift)}; } },
];

// ===== I18N =====

let mbMessages = null;

async function loadMbMessages(lang) {
  try {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    mbMessages = await res.json();
  } catch (e) {
    console.log('[MicroBreaks] Failed to load messages for', lang, '—', e.message);
    if (lang !== 'en') {
      try {
        const url = chrome.runtime.getURL(`_locales/en/messages.json`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        mbMessages = await res.json();
      } catch (e2) {
        console.log('[MicroBreaks] Failed to load fallback English messages —', e2.message);
        mbMessages = {};
      }
    } else {
      mbMessages = {};
    }
  }
}

function mbT(key) {
  if (!mbMessages || !mbMessages[key]) return key;
  return mbMessages[key].message;
}

function getStretches() {
  return STRETCH_DATA.map(s => ({
    name: mbT(s.key),
    dur: s.dur,
    steps: [1,2,3,4,5].map(n => mbT(s.key + 'Step' + n)),
    pose: s.pose,
    arrows: s.arrows,
    period: s.period,
  }));
}

// ===== OVERLAY =====

function removeOverlay() {
  const el = document.getElementById('microbreaks-overlay');
  if (el) el.remove();
  document.removeEventListener('keydown', onEscape);
}

function onEscape(e) {
  if (e.key === 'Escape') { chrome.runtime.sendMessage({type:'START'}); removeOverlay(); }
}

let overlayAnimId = null;

function playCompletionThenClose(svg, T, male, onDone) {
  if (overlayAnimId) cancelAnimationFrame(overlayAnimId);
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  drawFigure(svg, T, {headNod:-0.15}, T.outline, male);

  const checkG = h('g', {transform:'translate(50 88) scale(0)'});
  svg.appendChild(checkG);
  checkG.appendChild(h('circle', {cx:0, cy:0, r:24, fill:T.teal, stroke:T.outline, 'stroke-width':1.5}));
  const checkPath = h('path', {d:'M-10,1 L-3,9 L11,-8', fill:'none', stroke:'#fff', 'stroke-width':3.5, 'stroke-linecap':'round', 'stroke-linejoin':'round', 'stroke-dasharray':'32', 'stroke-dashoffset':'32'});
  checkG.appendChild(checkPath);

  const particles = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i/10) * Math.PI * 2;
    const p = h('circle', {cx:50, cy:88, r:2.2, fill:i%2===0?T.teal:T.amber});
    svg.appendChild(p);
    particles.push({el:p, angle});
  }

  let start = null;
  (function frame(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    if (elapsed < 450) {
      checkG.setAttribute('transform', `translate(50 88) scale(${Math.max(0, easeOutBack(elapsed/450))})`);
    } else if (elapsed < 850) {
      checkG.setAttribute('transform', 'translate(50 88) scale(1)');
      checkPath.setAttribute('stroke-dashoffset', String(32 - 32 * Math.min(1, (elapsed-450)/400)));
    }
    if (elapsed > 150 && elapsed < 850) {
      const t = easeInOut(Math.min(1, (elapsed-150)/700));
      particles.forEach(p => {
        p.el.setAttribute('cx', 50 + Math.cos(p.angle) * t * 30);
        p.el.setAttribute('cy', 88 + Math.sin(p.angle) * t * 30);
        p.el.setAttribute('opacity', String(1 - t));
      });
    }
    if (elapsed < 1100) {
      overlayAnimId = requestAnimationFrame(frame);
    } else {
      onDone();
    }
  })(performance.now());
}

function showOverlayContent(svgEl, idx, male, themeName, S) {
  const T = getTheme(themeName);
  const s = S[idx % S.length];
  let start = null;
  (function frame(ts) {
    if (!start) start = ts;
    const t = ((ts - start) / s.period) % 1;
    const pose = s.pose(t);
    const joints = drawFigure(svgEl, T, pose, T.outline, male);
    if (s.arrows) {
      const accentColor = timeOfDayAccent(T.amber);
      s.arrows(t, joints, svgEl, accentColor, pose, t);
    }
    overlayAnimId = requestAnimationFrame(frame);
  })(performance.now());
}

function emojiForIndex(idx) {
  const EMOJIS = ["🔄","☝️","👁","🤲","🙆","🌀","🙇","🦋","↔️","😌","💪","👆","🦶","🖐","🧘"];
  return EMOJIS[idx % EMOJIS.length];
}

async function showOverlay(stretchIndex, male, lang, themeName) {
  await loadMbMessages(lang || 'en');
  removeOverlay();
  const T = getTheme(themeName);
  const S = getStretches();
  let idx = stretchIndex % S.length;
  let browsing = false;

  const overlay = document.createElement('div');
  overlay.id = 'microbreaks-overlay';
  Object.assign(overlay.style, {
    position:'fixed', inset:'0', zIndex:'2147483647',
    background: T.bg.startsWith('#') ? hexToRgba(T.bg, 0.96) : T.bg,
    display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center',
    fontFamily:"'Inter',-apple-system,sans-serif",
    cursor:'pointer', overflowY:'auto',
  });

  const card = document.createElement('div');
  Object.assign(card.style, {
    textAlign:'center', maxWidth:'420px', width:'100%',
    padding:'0 24px 32px', cursor:'default',
    display:'flex', flexDirection:'column', alignItems:'center', position:'relative',
  });

  const browseBtn = document.createElement('button');
  browseBtn.innerHTML = '&#9638;&#9638;';
  browseBtn.setAttribute('aria-label', 'Browse all stretches');
  browseBtn.title = mbT('allStretches') || 'Browse all';
  Object.assign(browseBtn.style, {
    position:'absolute', top:'0', right:'0',
    background:'none', border:`0.5px solid ${hexToRgba(T.cream,0.25)}`, borderRadius:'8px',
    width:'30px', height:'30px', cursor:'pointer', color:hexToRgba(T.cream,0.6),
    fontSize:'11px', display:'flex', alignItems:'center', justifyContent:'center',
  });
  card.appendChild(browseBtn);

  const figSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  figSvg.setAttribute('viewBox', '0 0 100 170');
  figSvg.setAttribute('width', '150');
  figSvg.setAttribute('height', '255');
  card.appendChild(figSvg);

  const nameEl = document.createElement('div');
  Object.assign(nameEl.style, {fontSize:'20px', fontWeight:'500', color:T.cream, margin:'12px 0 6px', letterSpacing:'-0.3px'});
  card.appendChild(nameEl);

  const durEl = document.createElement('div');
  Object.assign(durEl.style, {fontSize:'11px', fontWeight:'500', color:T.teal, background:hexToRgba(T.teal,0.12), border:`0.5px solid ${hexToRgba(T.teal,0.3)}`, borderRadius:'20px', padding:'3px 12px', marginBottom:'14px', display:'inline-block'});
  card.appendChild(durEl);

  const bodyWrap = document.createElement('div');
  Object.assign(bodyWrap.style, {width:'100%', marginBottom:'20px'});
  card.appendChild(bodyWrap);

  const doneBtn = document.createElement('button');
  doneBtn.textContent = mbT('doneIMoved');
  Object.assign(doneBtn.style, {background:T.teal, color:T.bg, border:'none', borderRadius:'10px', padding:'12px 36px', fontSize:'14px', fontWeight:'500', cursor:'pointer', fontFamily:'inherit', marginBottom:'12px'});
  doneBtn.onmouseover = () => doneBtn.style.background = T.tealD;
  doneBtn.onmouseout = () => doneBtn.style.background = T.teal;
  card.appendChild(doneBtn);

  const hint = document.createElement('div');
  hint.textContent = mbT('dismissHint');
  Object.assign(hint.style, {fontSize:'11px', color:hexToRgba(T.cream,0.3)});
  card.appendChild(hint);

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function renderStepsView() {
    const s = S[idx];
    nameEl.textContent = s.name;
    durEl.textContent = s.dur;
    bodyWrap.innerHTML = '';
    const stepsEl = document.createElement('ol');
    Object.assign(stepsEl.style, {listStyle:'none', textAlign:'left', display:'flex', flexDirection:'column', gap:'6px'});
    s.steps.forEach((step, i) => {
      const li = document.createElement('li');
      Object.assign(li.style, {display:'flex', gap:'10px', fontSize:'13px', color:hexToRgba(T.cream,0.85), lineHeight:'1.55'});
      const num = document.createElement('span');
      num.textContent = i + 1;
      Object.assign(num.style, {color:T.teal, fontWeight:'500', flexShrink:'0', width:'16px'});
      const text = document.createElement('span');
      text.textContent = step;
      li.append(num, text);
      stepsEl.appendChild(li);
    });
    bodyWrap.appendChild(stepsEl);
    showOverlayContent(figSvg, idx, male, themeName, S);
  }

  function renderBrowseView() {
    bodyWrap.innerHTML = '';
    if (overlayAnimId) cancelAnimationFrame(overlayAnimId);
    nameEl.textContent = mbT('allStretches') || 'All stretches';
    durEl.textContent = '';
    const grid = document.createElement('div');
    Object.assign(grid.style, {display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'8px', maxHeight:'180px', overflowY:'auto'});
    S.forEach((s, i) => {
      const cell = document.createElement('div');
      const isCurrent = i === idx;
      Object.assign(cell.style, {
        background: isCurrent ? hexToRgba(T.amber, 0.18) : hexToRgba(T.teal, 0.08),
        border: `1px solid ${isCurrent ? hexToRgba(T.amber,0.5) : hexToRgba(T.teal,0.2)}`,
        borderRadius:'8px', padding:'8px 2px', textAlign:'center', cursor:'pointer', fontSize:'16px',
      });
      cell.innerHTML = `<div>${emojiForIndex(i)}</div>`;
      cell.title = s.name;
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        idx = i;
        browsing = false;
        renderStepsView();
      });
      grid.appendChild(cell);
    });
    bodyWrap.appendChild(grid);
  }

  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    browsing = !browsing;
    if (browsing) renderBrowseView();
    else renderStepsView();
  });

  renderStepsView();

  function finish() {
    chrome.runtime.sendMessage({type:'START'});
    removeOverlay();
  }

  doneBtn.addEventListener('click', () => {
    playCompletionThenClose(figSvg, T, male, finish);
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) finish();
  });
  document.addEventListener('keydown', onEscape);
}

function hexToRgba(hex, alpha) {
  if (!hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_BREAK_OVERLAY') showOverlay(msg.stretchIndex, msg.male, msg.lang, msg.theme);
  if (msg.type === 'HIDE_BREAK_OVERLAY') removeOverlay();
});

}
