// Test script for the new Marching Squares extractOutline
// Copy definitions from index.html

const PIECE_DEFS = {
    p1: { pts: "0,0 200,200 0,400", fill: "rgba(102, 204, 204, 0.85)" },
    p2: { pts: "0,0 400,0 200,200", fill: "rgba(204, 153, 102, 0.85)" },
    p3: { pts: "400,0 300,100 400,200", fill: "rgba(102, 204, 102, 0.85)" },
    p4: { pts: "200,200 300,100 400,200 300,300", fill: "rgba(204, 51, 51, 0.85)" },
    p5: { pts: "200,200 300,300 100,300", fill: "rgba(204, 204, 51, 0.85)" },
    p6: { pts: "0,400 200,400 300,300 100,300", fill: "rgba(51, 102, 204, 0.85)" },
    p7: { pts: "200,400 400,400 400,200", fill: "rgba(153, 51, 204, 0.85)" }
};
const PIECE_IDS = Object.keys(PIECE_DEFS);

function parsePts(str) {
    return str.split(' ').map(p => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
    });
}

function getTransformedVerts(id, transform) {
    const pts = parsePts(PIECE_DEFS[id].pts);
    const { x, y, rotate, flip } = transform;
    const rad = rotate * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    return pts.map(p => {
        const px = p.x * flip;
        const py = p.y;
        return {
            x: x + px * cos - py * sin,
            y: y + px * sin + py * cos
        };
    });
}

function polygonArea(verts) {
    let area = 0;
    for (let i = 0; i < verts.length; i++) {
        const j = (i + 1) % verts.length;
        area += verts[i].x * verts[j].y - verts[j].x * verts[i].y;
    }
    return Math.abs(area / 2);
}

function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        if (((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

function extractOutline(transforms) {
    const GRID = 2;
    const ids = Object.keys(transforms);
    const vertsList = ids.map(id => getTransformedVerts(id, transforms[id]));

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let verts of vertsList) {
        for (let v of verts) {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
        }
    }
    minX -= 2; maxX += 2; minY -= 2; maxY += 2;

    const cols = Math.ceil((maxX - minX) / GRID) + 1;
    const rows = Math.ceil((maxY - minY) / GRID) + 1;

    const grid = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
        const y = minY + r * GRID;
        for (let c = 0; c < cols; c++) {
            const x = minX + c * GRID;
            let inside = false;
            for (let verts of vertsList) {
                if (pointInPolygon({ x, y }, verts)) { inside = true; break; }
            }
            grid[r * cols + c] = inside ? 1 : 0;
        }
    }

    const segMap = new Map();
    function segKey(x1, y1, x2, y2) {
        if (x1 < x2 || (x1 === x2 && y1 < y2)) {
            return x1 + ',' + y1 + '-' + x2 + ',' + y2;
        }
        return x2 + ',' + y2 + '-' + x1 + ',' + y1;
    }
    function addSeg(x1, y1, x2, y2) {
        const k = segKey(x1, y1, x2, y2);
        if (segMap.has(k)) return;
        segMap.set(k, { v1: { x: x1, y: y1 }, v2: { x: x2, y: y2 } });
    }

    for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
            const tl = grid[r * cols + c];
            const tr = grid[r * cols + c + 1];
            const bl = grid[(r + 1) * cols + c];
            const br = grid[(r + 1) * cols + c + 1];
            const idx = (tl << 3) | (tr << 2) | (br << 1) | bl;
            if (idx === 0 || idx === 15) continue;

            const x0 = minX + c * GRID;
            const y0 = minY + r * GRID;
            const x1 = x0 + GRID;
            const y1 = y0 + GRID;
            const mx = x0 + GRID / 2;
            const my = y0 + GRID / 2;

            const top = { x: mx, y: y0 };
            const bottom = { x: mx, y: y1 };
            const left = { x: x0, y: my };
            const right = { x: x1, y: my };

            switch (idx) {
                case 1: addSeg(left.x, left.y, bottom.x, bottom.y); break;
                case 2: addSeg(bottom.x, bottom.y, right.x, right.y); break;
                case 3: addSeg(left.x, left.y, right.x, right.y); break;
                case 4: addSeg(top.x, top.y, right.x, right.y); break;
                case 5: addSeg(left.x, left.y, top.x, top.y); addSeg(bottom.x, bottom.y, right.x, right.y); break;
                case 6: addSeg(top.x, top.y, bottom.x, bottom.y); break;
                case 7: addSeg(left.x, left.y, top.x, top.y); break;
                case 8: addSeg(top.x, top.y, left.x, left.y); break;
                case 9: addSeg(top.x, top.y, bottom.x, bottom.y); break;
                case 10: addSeg(top.x, top.y, right.x, right.y); addSeg(left.x, left.y, bottom.x, bottom.y); break;
                case 11: addSeg(top.x, top.y, right.x, right.y); break;
                case 12: addSeg(left.x, left.y, right.x, right.y); break;
                case 13: addSeg(bottom.x, bottom.y, right.x, right.y); break;
                case 14: addSeg(left.x, left.y, bottom.x, bottom.y); break;
            }
        }
    }

    const segs = Array.from(segMap.values());
    if (segs.length === 0) return [];

    const vertMap = new Map();
    function vKey(v) { return Math.round(v.x * 10) + ',' + Math.round(v.y * 10); }
    for (let s of segs) {
        const k1 = vKey(s.v1), k2 = vKey(s.v2);
        if (!vertMap.has(k1)) vertMap.set(k1, { pt: s.v1, next: [] });
        if (!vertMap.has(k2)) vertMap.set(k2, { pt: s.v2, next: [] });
        vertMap.get(k1).next.push(k2);
        vertMap.get(k2).next.push(k1);
    }

    let startK = null, sx = Infinity, sy = Infinity;
    for (let [k, v] of vertMap) {
        if (v.pt.y < sy || (Math.abs(v.pt.y - sy) < 0.1 && v.pt.x < sx)) {
            sy = v.pt.y; sx = v.pt.x; startK = k;
        }
    }

    const used = new Set();
    const ring = [];
    let curK = startK;
    let prevK = null;
    let safety = segs.length * 2;
    while (safety-- > 0) {
        const v = vertMap.get(curK);
        ring.push({ x: v.pt.x, y: v.pt.y });
        let nextK = null;
        for (let nk of v.next) {
            if (nk === prevK) continue;
            if (used.has(curK + '|' + nk) || used.has(nk + '|' + curK)) continue;
            nextK = nk;
            break;
        }
        if (!nextK) break;
        used.add(curK + '|' + nextK);
        prevK = curK;
        curK = nextK;
        if (curK === startK) break;
    }

    if (ring.length < 3) return [];
    return ring;
}

// Test 1: All pieces in their original positions (should form a square-ish shape)
// Let's use a known valid configuration: the standard tangram square
// Actually, let's compute total area of all pieces first

let totalArea = 0;
for (let id of PIECE_IDS) {
    const pts = parsePts(PIECE_DEFS[id].pts);
    const a = polygonArea(pts);
    console.log(`${id}: area = ${a}`);
    totalArea += a;
}
console.log(`Total area of all pieces: ${totalArea}`);

// Test 2: Simple case - just one piece
console.log('\n--- Test: Single piece p1 ---');
const outline1 = extractOutline({ p1: { x: 0, y: 0, rotate: 0, flip: 1 } });
console.log(`Outline points: ${outline1.length}`);
console.log(`Outline area: ${polygonArea(outline1)}`);
console.log(`Expected area: ${polygonArea(parsePts(PIECE_DEFS.p1.pts))}`);

// Test 3: Two pieces adjacent
console.log('\n--- Test: Two pieces p1 + p2 (forming a larger triangle) ---');
const outline2 = extractOutline({
    p1: { x: 0, y: 0, rotate: 0, flip: 1 },
    p2: { x: 0, y: 0, rotate: 0, flip: 1 }
});
console.log(`Outline points: ${outline2.length}`);
console.log(`Outline area: ${polygonArea(outline2)}`);
const p1Area = polygonArea(parsePts(PIECE_DEFS.p1.pts));
const p2Area = polygonArea(parsePts(PIECE_DEFS.p2.pts));
console.log(`Expected area (p1 + p2): ${p1Area + p2Area}`);

// Test 4: Load puzzles_v2.json and check each one
const fs = require('fs');
const puzzles = JSON.parse(fs.readFileSync('puzzles_v2.json', 'utf8'));
console.log(`\n--- Testing ${puzzles.length} puzzles from puzzles_v2.json ---`);

let passCount = 0;
let failCount = 0;
for (let i = 0; i < Math.min(puzzles.length, 10); i++) {
    const p = puzzles[i];
    const transforms = {};
    for (let id in p.transforms) {
        transforms[id] = p.transforms[id];
    }
    const outline = extractOutline(transforms);
    const area = polygonArea(outline);
    const ratio = area / totalArea;
    const passed = Math.abs(ratio - 1) < 0.02; // 2% tolerance for grid discretization
    if (passed) {
        passCount++;
        console.log(`Puzzle ${i}: area=${area.toFixed(0)} ratio=${ratio.toFixed(4)} ✓`);
    } else {
        failCount++;
        console.log(`Puzzle ${i}: area=${area.toFixed(0)} ratio=${ratio.toFixed(4)} ✗ (points: ${outline.length})`);
    }
}
console.log(`Passed: ${passCount}, Failed: ${failCount}`);
