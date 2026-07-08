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
// ===== FIGURE SKIN / HAIR PALETTE =====
const SKIN_F='#F5DEB8', SKIN_D_F='#E0B882';
const HAIR_F='#2B3A5C'; // dark navy bob for female
const LIP_F='#D07068'; const BLUSH_F='rgba(220,100,80,0.22)'; const EYE_F='#2B3A5C';
const SKIN_M='#DBAB7A', SKIN_D_M='#C08550';
const HAIR_M='#1A0F0A';
const LIP_M='#B07060'; const BLUSH_M='rgba(180,80,60,0.18)'; const EYE_M='#1A0F0A';

// Formal suit palette — shared by both male and female
const SUIT    = '#2C3E50'; // dark charcoal jacket
const SUIT_D  = '#1A252F'; // jacket shadow
const SUIT_L  = '#34495E'; // jacket highlight
const SHIRT   = '#FAFAFA'; // white shirt
const TIE_F   = '#C04830'; // female — burgundy tie
const TIE_M   = '#1A6B8A'; // male — navy tie
const TROUSER = '#1A252F'; // dark trousers
const TROUSER_D='#111820'; // trouser shadow
const SHOE_C  = '#0A0A0A'; // black dress shoes

function getTheme(name) { return THEMES[name] || THEMES.sage; }

function timeOfDayAccent(amber) {
  const hour = new Date().getHours();
  if (hour >= 17 || hour < 5) return shiftWarm(amber, 0.15);
  return amber;
}
function shiftWarm(hex, amt) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(Math.min(255,r+30*amt))},${Math.round(Math.max(0,g-10*amt))},${Math.round(Math.max(0,b-20*amt))})`;
}

function drawFace(svg, fx, fy, tilt, nod, O, male) {
  fx = fx + tilt * 8; fy = fy + nod * 5;
  const SKIN = male ? SKIN_M : SKIN_F;
  const SKIN_D = male ? SKIN_D_M : SKIN_D_F;
  const HAIR = male ? HAIR_M : HAIR_F;
  const LIP = male ? LIP_M : LIP_F;
  const BLUSH = male ? BLUSH_M : BLUSH_F;
  const EYE = male ? EYE_M : EYE_F;

  // === LAYER 1: (back hair now drawn by drawFigure before body) ===

  // === LAYER 2: Head ===
  svg.appendChild(h('ellipse', {cx:fx, cy:fy, rx:20, ry:22, fill:SKIN}));
  // Jaw rounded extension
  svg.appendChild(h('path', {
    d:`M${fx-14},${fy+14} Q${fx-10},${fy+26} ${fx},${fy+28} Q${fx+10},${fy+26} ${fx+14},${fy+14}`,
    fill:SKIN
  }));

  // === LAYER 3: Hair front/crown (on top of head) ===
  if (male) {
    // Short structured dark hair cap
    svg.appendChild(h('path', {
      d:`M${fx-20},${fy-6} C${fx-22},${fy-20} ${fx-12},${fy-32} ${fx},${fy-30} C${fx+12},${fy-32} ${fx+22},${fy-20} ${fx+20},${fy-6} C${fx+16},${fy-16} ${fx},${fy-20} ${fx-16},${fy-16} Z`,
      fill:HAIR
    }));
    // Subtle sideburns — small strips at temples only
    svg.appendChild(h('path', {d:`M${fx-20},${fy-6} Q${fx-22},${fy+2} ${fx-20},${fy+6}`, fill:'none', stroke:HAIR, 'stroke-width':5, 'stroke-linecap':'round'}));
    svg.appendChild(h('path', {d:`M${fx+20},${fy-6} Q${fx+22},${fy+2} ${fx+20},${fy+6}`, fill:'none', stroke:HAIR, 'stroke-width':5, 'stroke-linecap':'round'}));
  } else {
    // Female crown — sits on top, connects side bobs
    svg.appendChild(h('path', {
      d:`M${fx-20},${fy-10} C${fx-22},${fy-24} ${fx-12},${fy-34} ${fx},${fy-32} C${fx+12},${fy-34} ${fx+22},${fy-24} ${fx+20},${fy-10} C${fx+16},${fy-20} ${fx},${fy-24} ${fx-16},${fy-20} Z`,
      fill:HAIR
    }));
    // Hair shine
    svg.appendChild(h('path', {d:`M${fx-6},${fy-32} Q${fx+4},${fy-36} ${fx+12},${fy-30}`, fill:'none', stroke:'rgba(120,150,220,0.35)', 'stroke-width':2.5, 'stroke-linecap':'round'}));
  }

  // Ears (after hair so they peek out correctly)
  svg.appendChild(h('ellipse', {cx:fx-20, cy:fy+2, rx:3.5, ry:5, fill:SKIN}));
  svg.appendChild(h('ellipse', {cx:fx+20, cy:fy+2, rx:3.5, ry:5, fill:SKIN_D}));

  // Eyebrows
  svg.appendChild(h('path', {d:`M${fx-14},${fy-10} Q${fx-9},${fy-14} ${fx-4},${fy-11}`, fill:'none', stroke:HAIR, 'stroke-width':1.8, 'stroke-linecap':'round'}));
  svg.appendChild(h('path', {d:`M${fx+4},${fy-11} Q${fx+9},${fy-14} ${fx+14},${fy-10}`, fill:'none', stroke:HAIR, 'stroke-width':1.8, 'stroke-linecap':'round'}));

  // Eyes — open, friendly
  svg.appendChild(h('ellipse', {cx:fx-8, cy:fy-1, rx:4.5, ry:4, fill:'white'}));
  svg.appendChild(h('ellipse', {cx:fx+8, cy:fy-1, rx:4.5, ry:4, fill:'white'}));
  svg.appendChild(h('circle', {cx:fx-8, cy:fy-1, r:2.8, fill:EYE}));
  svg.appendChild(h('circle', {cx:fx+8, cy:fy-1, r:2.8, fill:EYE}));
  svg.appendChild(h('circle', {cx:fx-8, cy:fy-1, r:1.4, fill:'#08060A'}));
  svg.appendChild(h('circle', {cx:fx+8, cy:fy-1, r:1.4, fill:'#08060A'}));
  svg.appendChild(h('circle', {cx:fx-7, cy:fy-2, r:0.9, fill:'rgba(255,255,255,0.9)'}));
  svg.appendChild(h('circle', {cx:fx+9, cy:fy-2, r:0.9, fill:'rgba(255,255,255,0.9)'}));
  // Upper lash line
  svg.appendChild(h('path', {d:`M${fx-12},${fy-4} Q${fx-8},${fy-7} ${fx-4},${fy-4}`, fill:'none', stroke:HAIR, 'stroke-width':1.6, 'stroke-linecap':'round'}));
  svg.appendChild(h('path', {d:`M${fx+4},${fy-4} Q${fx+8},${fy-7} ${fx+12},${fy-4}`, fill:'none', stroke:HAIR, 'stroke-width':1.6, 'stroke-linecap':'round'}));

  // Nose
  svg.appendChild(h('circle', {cx:fx-3, cy:fy+9, r:1.8, fill:SKIN_D}));
  svg.appendChild(h('circle', {cx:fx+3, cy:fy+9, r:1.8, fill:SKIN_D}));

  // Smile
  svg.appendChild(h('path', {d:`M${fx-8},${fy+16} Q${fx},${fy+22} ${fx+8},${fy+16}`, fill:'none', stroke:LIP, 'stroke-width':2.2, 'stroke-linecap':'round'}));
}

function drawFigure(svg, T, pose, O, male) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const cx = 50;
  const P = {
    headTilt:0, headNod:0, torsoLean:0,
    armLOut:12, armROut:12, elbLOut:8, elbLFwd:18, elbROut:8, elbRFwd:18,
    legSpread:9, breathe:0, ...pose,
  };

  // Proportions
  const HEAD_R = male ? 14 : 13;  // back to original smaller size
  const UA = 22, FA = 19, THIGH = 30, SHIN = 28, TORSO = 42;
  const tw = male ? 14 : 12;
  const hw = male ? 10 : 9;

  const y0 = 12;
  const headY = y0 + HEAD_R;
  const neckBase = {x:cx, y:headY + HEAD_R + 3};
  const chestTop = {x:cx, y:neckBase.y + 5 - P.breathe * 1.5};
  const waistY = chestTop.y + TORSO * 0.46;
  const hipsY = chestTop.y + TORSO;
  const shlL = {x:cx - tw, y:chestTop.y + 6};
  const shlR = {x:cx + tw, y:chestTop.y + 6};

  // Arm joint positions (same rig as before)
  function armPoint(shl, outDeg, sign) {
    const rad = outDeg * PI / 180;
    return {x: shl.x + Math.sin(rad) * UA * sign, y: shl.y + Math.cos(rad) * UA};
  }
  const elbL = armPoint(shlL, P.armLOut, -1);
  const elbR = armPoint(shlR, P.armROut, 1);
  function forearmPoint(elb, outDeg, sign, fwd) {
    const rad = outDeg * PI / 180;
    return {x: elb.x + Math.sin(rad) * FA * sign * 0.6 + fwd * 0.5, y: elb.y + Math.cos(rad) * FA - fwd * 0.3};
  }
  const wriL = forearmPoint(elbL, P.elbLOut, -1, P.elbLFwd);
  const wriR = forearmPoint(elbR, P.elbROut, 1, P.elbRFwd);

  const hipL = {x:cx - hw, y:hipsY};
  const hipR = {x:cx + hw, y:hipsY};
  const kneeL = {x:cx - P.legSpread, y:hipsY + THIGH};
  const kneeR = {x:cx + P.legSpread, y:hipsY + THIGH};
  const ankL = {x:cx - P.legSpread, y:hipsY + THIGH + SHIN};
  const ankR = {x:cx + P.legSpread, y:hipsY + THIGH + SHIN};

  // Suit clothing — same for male and female
  const topFill  = SUIT;
  const topFillD = SUIT_D;
  const legFill  = TROUSER;
  const legFillD = TROUSER_D;
  const skinFill  = male ? SKIN_M : SKIN_F;
  const skinFillD = male ? SKIN_D_M : SKIN_D_F;

  // Arm stroke widths — thicker, rounded, no joints
  const armW = male ? 16 : 13;
  const foreW = male ? 13 : 10;
  const legW  = male ? 20 : 17;
  const shinW = male ? 18 : 15;

  // ── LAYER 0: Back hair (behind everything) ──
  const faceX = cx + P.headTilt*8;
  const faceY = headY + P.headNod*5;
  if (!male) {
    // Female bob sides — drawn here so they appear behind the body
    svg.appendChild(h('path', {
      d:`M${faceX-18},${faceY-18} C${faceX-26},${faceY-12} ${faceX-28},${faceY+4} ${faceX-26},${faceY+20} C${faceX-24},${faceY+32} ${faceX-18},${faceY+36} ${faceX-14},${faceY+30} C${faceX-16},${faceY+16} ${faceX-16},${faceY+0} ${faceX-14},${faceY-12} Z`,
      fill:HAIR_F
    }));
    svg.appendChild(h('path', {
      d:`M${faceX+18},${faceY-18} C${faceX+26},${faceY-12} ${faceX+28},${faceY+4} ${faceX+26},${faceY+20} C${faceX+24},${faceY+32} ${faceX+18},${faceY+36} ${faceX+14},${faceY+30} C${faceX+16},${faceY+16} ${faceX+16},${faceY+0} ${faceX+14},${faceY-12} Z`,
      fill:HAIR_F
    }));
  }

  // ── BACK ELEMENTS ──

  // Right leg (back)
  svg.appendChild(h('path', {
    d:`M${hipR.x},${hipR.y} Q${kneeR.x+2},${kneeR.y-10} ${kneeR.x},${kneeR.y}`,
    fill:'none', stroke:legFillD, 'stroke-width':legW-2, 'stroke-linecap':'round'
  }));
  svg.appendChild(h('path', {
    d:`M${kneeR.x},${kneeR.y} Q${ankR.x+1},${ankR.y-10} ${ankR.x},${ankR.y}`,
    fill:'none', stroke:legFillD, 'stroke-width':shinW-2, 'stroke-linecap':'round'
  }));
  // Right foot — black dress shoe
  svg.appendChild(h('path', {
    d:`M${ankR.x-8},${ankR.y} Q${ankR.x-8},${ankR.y+10} ${ankR.x+4},${ankR.y+11} Q${ankR.x+14},${ankR.y+10} ${ankR.x+13},${ankR.y+4}`,
    fill:SHOE_C, stroke:'none'
  }));
  // shoe highlight
  svg.appendChild(h('path', {d:`M${ankR.x-6},${ankR.y+2} Q${ankR.x},${ankR.y+4} ${ankR.x+8},${ankR.y+3}`, fill:'none', stroke:'rgba(255,255,255,0.15)', 'stroke-width':2, 'stroke-linecap':'round'}));

  // Right arm (back) — sleeve
  svg.appendChild(h('path', {
    d:`M${shlR.x},${shlR.y} Q${(shlR.x+elbR.x)/2+4},${(shlR.y+elbR.y)/2} ${elbR.x},${elbR.y}`,
    fill:'none', stroke:topFillD, 'stroke-width':armW, 'stroke-linecap':'round'
  }));
  // Right forearm (skin)
  svg.appendChild(h('path', {
    d:`M${elbR.x},${elbR.y} Q${(elbR.x+wriR.x)/2+2},${(elbR.y+wriR.y)/2} ${wriR.x},${wriR.y}`,
    fill:'none', stroke:skinFillD, 'stroke-width':foreW, 'stroke-linecap':'round'
  }));
  // Right hand
  svg.appendChild(h('circle', {cx:wriR.x, cy:wriR.y, r:foreW/2+1, fill:skinFillD}));
  // Right cuff
  svg.appendChild(h('circle', {cx:wriR.x, cy:wriR.y, r:foreW/2+2.5, fill:'none', stroke:SHIRT, 'stroke-width':2.5}));

  // ── TORSO ──
  // Trouser waistband
  svg.appendChild(h('rect', {
    x:cx-hw-3, y:hipsY-6, width:(hw+3)*2, height:9, rx:3,
    fill:TROUSER_D
  }));
  // Trouser belt line
  svg.appendChild(h('rect', {
    x:cx-hw-3, y:hipsY-7, width:(hw+3)*2, height:2, rx:1,
    fill:SUIT_D, opacity:'0.6'
  }));
  // Main jacket body
  svg.appendChild(h('path', {
    d:`M${cx-tw},${chestTop.y} C${cx-tw-3},${waistY-2} ${cx-hw-3},${waistY+6} ${cx-hw-3},${hipsY} L${cx+hw+3},${hipsY} C${cx+hw+3},${waistY+6} ${cx+tw+3},${waistY-2} ${cx+tw},${chestTop.y} Z`,
    fill:topFill
  }));
  // Jacket left shadow
  svg.appendChild(h('path', {
    d:`M${cx-tw},${chestTop.y} C${cx-tw-3},${waistY-2} ${cx-hw-3},${waistY+6} ${cx-hw-3},${hipsY} L${cx-hw+4},${hipsY} C${cx-hw+2},${waistY+4} ${cx-tw+6},${waistY-4} ${cx-tw+6},${chestTop.y} Z`,
    fill:SUIT_D, opacity:'0.4'
  }));
  // Pocket square (right breast pocket)
  svg.appendChild(h('path', {
    d:`M${cx+6},${chestTop.y+10} L${cx+12},${chestTop.y+10} L${cx+12},${chestTop.y+16} L${cx+6},${chestTop.y+16} Z`,
    fill:SHIRT, opacity:'0.9'
  }));
  svg.appendChild(h('path', {
    d:`M${cx+6},${chestTop.y+10} Q${cx+9},${chestTop.y+7} ${cx+12},${chestTop.y+10}`,
    fill:SHIRT
  }));
  // Jacket lapels — white shirt triangle underneath
  svg.appendChild(h('path', {
    d:`M${cx-7},${chestTop.y+4} L${cx},${chestTop.y+18} L${cx+7},${chestTop.y+4}`,
    fill:SHIRT
  }));
  // Left lapel
  svg.appendChild(h('path', {
    d:`M${cx-tw},${chestTop.y} L${cx-7},${chestTop.y+4} L${cx},${chestTop.y+18} L${cx},${chestTop.y+28} L${cx-tw+2},${chestTop.y+24} Z`,
    fill:SUIT_L
  }));
  // Right lapel
  svg.appendChild(h('path', {
    d:`M${cx+tw},${chestTop.y} L${cx+7},${chestTop.y+4} L${cx},${chestTop.y+18} L${cx},${chestTop.y+28} L${cx+tw-2},${chestTop.y+24} Z`,
    fill:SUIT
  }));
  // Jacket button line
  svg.appendChild(h('line', {x1:cx, y1:chestTop.y+28, x2:cx, y2:hipsY-4, stroke:SUIT_D, 'stroke-width':1.5, 'stroke-linecap':'round'}));
  // Jacket buttons
  svg.appendChild(h('circle', {cx, cy:chestTop.y+34, r:1.8, fill:SUIT_D}));
  svg.appendChild(h('circle', {cx, cy:chestTop.y+44, r:1.8, fill:SUIT_D}));
  // Tie
  const tieColor = male ? TIE_M : TIE_F;
  svg.appendChild(h('path', {
    d:`M${cx-2.5},${chestTop.y+18} L${cx-4},${chestTop.y+32} L${cx},${chestTop.y+38} L${cx+4},${chestTop.y+32} L${cx+2.5},${chestTop.y+18} Z`,
    fill:tieColor
  }));
  // Tie knot
  svg.appendChild(h('path', {
    d:`M${cx-2.5},${chestTop.y+18} Q${cx},${chestTop.y+14} ${cx+2.5},${chestTop.y+18} Q${cx},${chestTop.y+22} ${cx-2.5},${chestTop.y+18} Z`,
    fill:tieColor
  }));

  // Left leg (front)
  svg.appendChild(h('path', {
    d:`M${hipL.x},${hipL.y} Q${kneeL.x-2},${kneeL.y-10} ${kneeL.x},${kneeL.y}`,
    fill:'none', stroke:legFill, 'stroke-width':legW, 'stroke-linecap':'round'
  }));
  svg.appendChild(h('path', {
    d:`M${kneeL.x},${kneeL.y} Q${ankL.x-1},${ankL.y-10} ${ankL.x},${ankL.y}`,
    fill:'none', stroke:legFill, 'stroke-width':shinW, 'stroke-linecap':'round'
  }));
  // Left foot — black dress shoe
  svg.appendChild(h('path', {
    d:`M${ankL.x+8},${ankL.y} Q${ankL.x+8},${ankL.y+10} ${ankL.x-4},${ankL.y+11} Q${ankL.x-14},${ankL.y+10} ${ankL.x-13},${ankL.y+4}`,
    fill:SHOE_C, stroke:'none'
  }));
  svg.appendChild(h('path', {d:`M${ankL.x+6},${ankL.y+2} Q${ankL.x},${ankL.y+4} ${ankL.x-8},${ankL.y+3}`, fill:'none', stroke:'rgba(255,255,255,0.15)', 'stroke-width':2, 'stroke-linecap':'round'}));

  // Neck
  svg.appendChild(h('path', {
    d:`M${cx-7},${neckBase.y} Q${cx-5},${neckBase.y-10} ${cx-5},${chestTop.y+2}`,
    fill:'none', stroke:skinFill, 'stroke-width':13, 'stroke-linecap':'round'
  }));
  svg.appendChild(h('path', {
    d:`M${cx+7},${neckBase.y} Q${cx+5},${neckBase.y-10} ${cx+5},${chestTop.y+2}`,
    fill:'none', stroke:skinFillD, 'stroke-width':6, 'stroke-linecap':'round', opacity:'0.4'
  }));
  // Shirt collar wings
  svg.appendChild(h('path', {d:`M${cx-5},${chestTop.y+4} L${cx-9},${chestTop.y-1} L${cx-4},${chestTop.y+2} Z`, fill:SHIRT}));
  svg.appendChild(h('path', {d:`M${cx+5},${chestTop.y+4} L${cx+9},${chestTop.y-1} L${cx+4},${chestTop.y+2} Z`, fill:SHIRT}));

  // Left arm (front) — sleeve
  svg.appendChild(h('path', {
    d:`M${shlL.x},${shlL.y} Q${(shlL.x+elbL.x)/2-4},${(shlL.y+elbL.y)/2} ${elbL.x},${elbL.y}`,
    fill:'none', stroke:topFill, 'stroke-width':armW, 'stroke-linecap':'round'
  }));
  // Left forearm (skin)
  svg.appendChild(h('path', {
    d:`M${elbL.x},${elbL.y} Q${(elbL.x+wriL.x)/2-2},${(elbL.y+wriL.y)/2} ${wriL.x},${wriL.y}`,
    fill:'none', stroke:skinFill, 'stroke-width':foreW, 'stroke-linecap':'round'
  }));
  // Left hand
  svg.appendChild(h('circle', {cx:wriL.x, cy:wriL.y, r:foreW/2+1, fill:skinFill}));
  // Left cuff
  svg.appendChild(h('circle', {cx:wriL.x, cy:wriL.y, r:foreW/2+2.5, fill:'none', stroke:SHIRT, 'stroke-width':2.5}));

  // Face on top of everything
  drawFace(svg, faceX, faceY, P.headTilt, P.headNod, O, male);

  return {wristL:wriL, wristR:wriR, head:{x:faceX, y:faceY}};
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
  if (overlayAnimId) { cancelAnimationFrame(overlayAnimId); overlayAnimId = null; }
  const el = document.getElementById('microbreaks-overlay');
  if (el) el.remove();
  document.documentElement.style.overflow = _savedHtmlOverflow;
  document.body.style.overflow = _savedBodyOverflow;
  document.removeEventListener('keydown', onEscape);
}

function onEscape(e) {
  if (e.key === 'Escape') { chrome.runtime.sendMessage({type:'START'}); removeOverlay(); }
}

let overlayAnimId = null;
let _savedHtmlOverflow = '';
let _savedBodyOverflow = '';

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
    // Escape any CSS transform stacking contexts (common on Notion, Figma, Gmail)
    // by using a dedicated overlay host appended directly to document.documentElement
    transform:'none', willChange:'auto',
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
  // Save original overflow values before locking scroll
  _savedHtmlOverflow = document.documentElement.style.overflow;
  _savedBodyOverflow = document.body.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.documentElement.appendChild(overlay);

  function renderStepsView() {
    // Cancel any running animation before starting a new one
    if (overlayAnimId) { cancelAnimationFrame(overlayAnimId); overlayAnimId = null; }
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
      // Use the stretch's own canonical emoji via its index in S, not position i
      cell.innerHTML = `<div>${s.emoji || emojiForIndex(i)}</div>`;
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

  let finishing = false;
  function finish() {
    if (finishing) return;
    finishing = true;
    chrome.runtime.sendMessage({type:'START'});
    removeOverlay();
  }

  doneBtn.addEventListener('click', () => {
    if (finishing) return;
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
