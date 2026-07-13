// 提取七巧板核心算法，批量生成不同形状的拼图
const PIECE_DEFS = {
    p1: { pts: "0,0 200,200 0,400" },
    p2: { pts: "0,0 400,0 200,200" },
    p3: { pts: "400,0 300,100 400,200" },
    p4: { pts: "200,200 300,100 400,200 300,300" },
    p5: { pts: "200,200 300,300 100,300" },
    p6: { pts: "0,400 200,400 300,300 100,300" },
    p7: { pts: "200,400 400,400 400,200" }
};
const PIECE_IDS = Object.keys(PIECE_DEFS);
const EPS = 1e-4;

function getEdges(pointsStr) {
    const pts = pointsStr.split(' ').map(p => p.split(',').map(Number));
    const edges = [];
    for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        edges.push({ index: i, len: Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]) });
    }
    return edges;
}
const PIECE_EDGES = {};
for (let id in PIECE_DEFS) { PIECE_EDGES[id] = getEdges(PIECE_DEFS[id].pts); }

function polygonArea(verts) {
    let area = 0;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        area += verts[i].x * verts[j].y;
        area -= verts[j].x * verts[i].y;
    }
    return Math.abs(area) / 2;
}

function getTransformedVerts(id, transform) {
    const ptsStr = PIECE_DEFS[id].pts;
    const pts = ptsStr.split(' ').map(p => p.split(',').map(Number));
    const { x, y, rotate, flip } = transform;
    const rad = rotate * Math.PI / 180;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let p of pts) {
        if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
    }
    const cxx = (minX + maxX) / 2, cyy = (minY + maxY) / 2;
    const verts = [];
    for (let p of pts) {
        let px = p[0], py = p[1];
        if (flip === -1) px = 2 * cxx - px;
        let rx = cxx + (px - cxx) * Math.cos(rad) - (py - cyy) * Math.sin(rad);
        let ry = cyy + (px - cxx) * Math.sin(rad) + (py - cyy) * Math.cos(rad);
        verts.push({ x: rx + x, y: ry + y });
    }
    return verts;
}

function computeIntersectionArea(verts1, verts2) {
    // Sutherland-Hodgman
    let output = verts1.slice();
    for (let i = 0; i < verts2.length; i++) {
        if (output.length === 0) break;
        const a = verts2[i], b = verts2[(i + 1) % verts2.length];
        const input = output;
        output = [];
        for (let j = 0; j < input.length; j++) {
            const p = input[j], q = input[(j + 1) % input.length];
            const cp = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
            const cq = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
            if (cp <= 0) {
                if (cq > 0) {
                    const t = cp / (cp - cq);
                    output.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
                }
                output.push(q);
            } else if (cq <= 0) {
                const t = cp / (cp - cq);
                output.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
            }
        }
    }
    return polygonArea(output);
}

function isOverlapping(verts1, verts2) {
    const area = computeIntersectionArea(verts1, verts2);
    if (area > 1e-4) return true;
    return false;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function extractOutline(transforms) {
    let allEdges = [];
    for (let id in transforms) {
        const verts = getTransformedVerts(id, transforms[id]);
        for (let i = 0; i < verts.length; i++) {
            const j = (i + 1) % verts.length;
            allEdges.push({ id, v1: verts[i], v2: verts[j], used: false });
        }
    }
    for (let i = 0; i < allEdges.length; i++) {
        for (let j = i + 1; j < allEdges.length; j++) {
            const e1 = allEdges[i], e2 = allEdges[j];
            const d1 = Math.hypot(e1.v1.x - e2.v1.x, e1.v1.y - e2.v1.y);
            const d2 = Math.hypot(e1.v2.x - e2.v2.x, e1.v2.y - e2.v2.y);
            const d3 = Math.hypot(e1.v1.x - e2.v2.x, e1.v1.y - e2.v2.y);
            const d4 = Math.hypot(e1.v2.x - e2.v1.x, e1.v2.y - e2.v1.y);
            if ((d1 < EPS && d2 < EPS) || (d3 < EPS && d4 < EPS)) {
                e1.used = true; e2.used = true;
            }
        }
    }
    let boundaryEdges = allEdges.filter(e => !e.used);
    if (boundaryEdges.length === 0) return [];
    let rings = [];
    let visited = new Set();
    for (let startEdge of boundaryEdges) {
        if (visited.has(startEdge)) continue;
        let ring = [];
        let currentEdge = startEdge;
        ring.push(currentEdge.v1);
        let iter = 0;
        const maxIter = boundaryEdges.length * 2;
        while (iter < maxIter) {
            iter++;
            visited.add(currentEdge);
            const end = currentEdge.v2;
            ring.push(end);
            let found = null;
            for (let e of boundaryEdges) {
                if (visited.has(e)) continue;
                if (Math.hypot(e.v1.x - end.x, e.v1.y - end.y) < EPS) { found = e; break; }
                if (Math.hypot(e.v2.x - end.x, e.v2.y - end.y) < EPS) {
                    let temp = e.v1; e.v1 = e.v2; e.v2 = temp; found = e; break;
                }
            }
            if (!found) break;
            currentEdge = found;
            if (currentEdge === startEdge) break;
        }
        let unique = [];
        for (let p of ring) {
            let dup = false;
            for (let u of unique) if (Math.hypot(u.x - p.x, u.y - p.y) < EPS) { dup = true; break; }
            if (!dup) unique.push(p);
        }
        if (unique.length >= 3) rings.push(unique);
    }
    if (rings.length === 0) return [];
    if (rings.length === 1) return rings[0];
    rings.sort((a, b) => polygonArea(b) - polygonArea(a));
    return rings[0];
}

function tryGenerate() {
    const ids = PIECE_IDS.slice();
    shuffle(ids);
    const placed = {};
    const placedIds = [];
    const firstId = ids[0];
    placed[firstId] = { x: 0, y: 0, rotate: 0, flip: 1 };
    placedIds.push(firstId);
    let success = true;
    for (let idx = 1; idx < ids.length; idx++) {
        const newId = ids[idx];
        let found = false;
        const shuffledPlaced = placedIds.slice();
        shuffle(shuffledPlaced);
        for (let pid of shuffledPlaced) {
            if (found) break;
            const pTrans = placed[pid];
            const pVerts = getTransformedVerts(pid, pTrans);
            const pEdges = PIECE_EDGES[pid];
            const newEdges = PIECE_EDGES[newId];
            const shuffledNewEdges = newEdges.slice();
            shuffle(shuffledNewEdges);
            for (let ne of shuffledNewEdges) {
                if (found) break;
                const shuffledPEdges = pEdges.slice();
                shuffle(shuffledPEdges);
                for (let pe of shuffledPEdges) {
                    if (Math.abs(ne.len - pe.len) > 0.5) continue;
                    for (let dir of [1, -1]) {
                        const p1 = pVerts[pe.index];
                        const p2 = pVerts[(pe.index + 1) % pVerts.length];
                        const nePts = PIECE_DEFS[newId].pts.split(' ').map(p => p.split(',').map(Number));
                        const n1 = nePts[ne.index];
                        const n2 = nePts[(ne.index + 1) % nePts.length];
                        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) - Math.atan2(n2[1] - n1[1], n2[0] - n1[0]) * dir;
                        const flip = dir;
                        const rad = angle;
                        const cos = Math.cos(rad), sin = Math.sin(rad);
                        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                        for (let pt of nePts) {
                            if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0];
                            if (pt[1] < minY) minY = pt[1]; if (pt[1] > maxY) maxY = pt[1];
                        }
                        const cx2 = (minX + maxX) / 2, cy2 = (minY + maxY) / 2;
                        let nx1 = n1[0], ny1 = n1[1];
                        if (flip === -1) nx1 = 2 * cx2 - nx1;
                        let rx1 = cx2 + (nx1 - cx2) * cos - (ny1 - cy2) * sin;
                        let ry1 = cy2 + (nx1 - cx2) * sin + (ny1 - cy2) * cos;
                        const dx = p1.x - rx1;
                        const dy = p1.y - ry1;
                        const newTrans = { x: dx, y: dy, rotate: angle * 180 / Math.PI, flip: flip };
                        const newVerts = getTransformedVerts(newId, newTrans);
                        let overlap = false;
                        for (let pid2 of placedIds) {
                            const otherVerts = getTransformedVerts(pid2, placed[pid2]);
                            if (isOverlapping(newVerts, otherVerts)) { overlap = true; break; }
                        }
                        if (!overlap) {
                            placed[newId] = newTrans;
                            placedIds.push(newId);
                            found = true;
                            break;
                        }
                    }
                }
            }
        }
        if (!found) { success = false; break; }
    }
    if (!success) return null;
    for (let i = 0; i < placedIds.length; i++) {
        for (let j = i + 1; j < placedIds.length; j++) {
            const v1 = getTransformedVerts(placedIds[i], placed[placedIds[i]]);
            const v2 = getTransformedVerts(placedIds[j], placed[placedIds[j]]);
            if (isOverlapping(v1, v2)) return null;
        }
    }
    const outlineVerts = extractOutline(placed);
    if (outlineVerts.length < 3) return null;
    return { outline: outlineVerts, solution: placed };
}

// 生成100个，按轮廓形状去重，挑不同的
const puzzles = [];
const seenSignatures = new Set();

function outlineSignature(outline) {
    // 归一化：平移到原点，计算边长序列和角度序列作为签名
    let minX = Infinity, minY = Infinity;
    for (let v of outline) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
    }
    const normalized = outline.map(v => ({ x: v.x - minX, y: v.y - minY }));
    // 计算边长序列（四舍五入到整数）
    const edges = [];
    for (let i = 0; i < normalized.length; i++) {
        const j = (i + 1) % normalized.length;
        edges.push(Math.round(Math.hypot(normalized[j].x - normalized[i].x, normalized[j].y - normalized[i].y)));
    }
    // 找最小旋转作为规范形式
    const n = edges.length;
    let minSeq = edges.slice().join(',');
    for (let start = 1; start < n; start++) {
        const seq = [];
        for (let k = 0; k < n; k++) seq.push(edges[(start + k) % n]);
        const s = seq.join(',');
        if (s < minSeq) minSeq = s;
    }
    // 也考虑反向
    const revEdges = edges.slice().reverse();
    for (let start = 0; start < n; start++) {
        const seq = [];
        for (let k = 0; k < n; k++) seq.push(revEdges[(start + k) % n]);
        const s = seq.join(',');
        if (s < minSeq) minSeq = s;
    }
    return `${n}_${minSeq}`;
}

let attempts = 0;
const target = 30;
while (puzzles.length < target && attempts < 30000) {
    attempts++;
    const result = tryGenerate();
    if (!result) continue;
    const sig = outlineSignature(result.outline);
    if (seenSignatures.has(sig)) continue;
    seenSignatures.add(sig);
    // 平移轮廓让最小点在(0,0)附近
    let minX = Infinity, minY = Infinity;
    for (let v of result.outline) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
    }
    result.outline = result.outline.map(v => ({ x: Math.round(v.x * 10) / 10, y: Math.round(v.y * 10) / 10 }));
    for (let id in result.solution) {
        result.solution[id].x = Math.round(result.solution[id].x * 10) / 10;
        result.solution[id].y = Math.round(result.solution[id].y * 10) / 10;
        result.solution[id].rotate = Math.round(result.solution[id].rotate * 10) / 10;
    }
    puzzles.push(result);
    if (puzzles.length % 5 === 0) console.error(`已生成 ${puzzles.length} 个不同形状，尝试次数 ${attempts}`);
}

console.error(`总共生成 ${puzzles.length} 个不同形状（尝试 ${attempts} 次）`);
console.log(JSON.stringify(puzzles, null, 2));
