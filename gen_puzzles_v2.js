// 回溯法生成七巧板形状：系统性尝试所有可能的拼接方式
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
const PIECE_NAMES = { p1: '大三角1', p2: '大三角2', p3: '小三角', p4: '正方形', p5: '中三角', p6: '平行四边形', p7: '三角板' };

const EPS = 1e-6;
const MATCH_EPS = 0.5;

function polygonArea(verts) {
    let area = 0;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        area += verts[i].x * verts[j].y - verts[j].x * verts[i].y;
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

function getEdges(id) {
    const pts = PIECE_DEFS[id].pts.split(' ').map(p => p.split(',').map(Number));
    const edges = [];
    for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        edges.push({ index: i, len: Math.hypot(pts[j][0]-pts[i][0], pts[j][1]-pts[i][1]) });
    }
    return edges;
}
const PIECE_EDGES = {};
for (let id in PIECE_DEFS) PIECE_EDGES[id] = getEdges(id);

// Sutherland-Hodgman 裁剪
function computeIntersectionArea(verts1, verts2) {
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
    return area > 0.1; // 小于0.1像素的重叠忽略
}

// 计算对齐变换：将 newId 的 ne 边与 placed[pid] 的 pe 边对齐
function computeAlignment(newId, neIndex, pid, peIndex, pVerts, flipDir) {
    const nePts = PIECE_DEFS[newId].pts.split(' ').map(p => p.split(',').map(Number));
    const n1 = nePts[neIndex];
    const n2 = nePts[(neIndex + 1) % nePts.length];
    const p1 = pVerts[peIndex];
    const p2 = pVerts[(peIndex + 1) % pVerts.length];
    
    const pAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let nAngle = (flipDir === -1)
        ? Math.atan2(n2[1] - n1[1], n1[0] - n2[0])
        : Math.atan2(n2[1] - n1[1], n2[0] - n1[0]);
    const angle = pAngle - nAngle;
    const flip = flipDir;
    
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
    
    return { x: dx, y: dy, rotate: angle * 180 / Math.PI, flip };
}

// 轮廓签名（用于去重）
function outlineSignature(outline) {
    const edges = [];
    for (let i = 0; i < outline.length; i++) {
        const j = (i + 1) % outline.length;
        edges.push(Math.round(Math.hypot(outline[j].x - outline[i].x, outline[j].y - outline[i].y)));
    }
    const n = edges.length;
    // 旋转+翻转最小化
    let minSeq = edges.slice().join(',');
    for (let start = 1; start < n; start++) {
        const seq = [];
        for (let k = 0; k < n; k++) seq.push(edges[(start + k) % n]);
        const s = seq.join(',');
        if (s < minSeq) minSeq = s;
    }
    const revEdges = edges.slice().reverse();
    for (let start = 0; start < n; start++) {
        const seq = [];
        for (let k = 0; k < n; k++) seq.push(revEdges[(start + k) % n]);
        const s = seq.join(',');
        if (s < minSeq) minSeq = s;
    }
    return `${n}_${minSeq}`;
}

function extractOutline(transforms) {
    const allEdges = [];
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
            if ((d1 < MATCH_EPS && d2 < MATCH_EPS) || (d3 < MATCH_EPS && d4 < MATCH_EPS)) {
                e1.used = true; e2.used = true;
            }
        }
    }
    const boundaryEdges = allEdges.filter(e => !e.used);
    if (boundaryEdges.length === 0) return [];
    const rings = [];
    const visited = new Set();
    for (let startEdge of boundaryEdges) {
        if (visited.has(startEdge)) continue;
        const ring = [];
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
                if (Math.hypot(e.v1.x - end.x, e.v1.y - end.y) < MATCH_EPS) { found = e; break; }
                if (Math.hypot(e.v2.x - end.x, e.v2.y - end.y) < MATCH_EPS) {
                    const temp = e.v1; e.v1 = e.v2; e.v2 = temp; found = e; break;
                }
            }
            if (!found) break;
            currentEdge = found;
            if (currentEdge === startEdge) break;
        }
        const unique = [];
        for (let p of ring) {
            let dup = false;
            for (let u of unique) if (Math.hypot(u.x - p.x, u.y - p.y) < MATCH_EPS) { dup = true; break; }
            if (!dup) unique.push(p);
        }
        if (unique.length >= 3) rings.push(unique);
    }
    if (rings.length === 0) return [];
    if (rings.length === 1) return rings[0];
    rings.sort((a, b) => polygonArea(b) - polygonArea(a));
    return rings[0];
}

// 使用迭代加深的生成方法
// 策略：从一块开始，每次添加一块新的，尝试所有可能的边对齐组合
function generatePuzzles(targetCount = 50, maxAttempts = 200000) {
    const results = [];
    const seen = new Set();
    
    // 迭代随机贪心，收集不同形状
    for (let attempt = 0; attempt < maxAttempts && results.length < targetCount; attempt++) {
        const ids = PIECE_IDS.slice();
        // 随机打乱顺序
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        
        const placed = {};
        const placedIds = [];
        
        // 第一块：随机旋转
        const firstId = ids[0];
        const rotations = [0, 45, 90, 135, 180, 225, 270, 315];
        const firstRot = rotations[Math.floor(Math.random() * rotations.length)];
        const firstFlip = Math.random() < 0.5 ? 1 : -1;
        placed[firstId] = { x: 0, y: 0, rotate: firstRot, flip: firstFlip };
        placedIds.push(firstId);
        
        let success = true;
        for (let idx = 1; idx < ids.length; idx++) {
            const newId = ids[idx];
            let found = false;
            
            // 打乱已放置碎片的顺序
            const shuffledPlaced = placedIds.slice();
            for (let i = shuffledPlaced.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledPlaced[i], shuffledPlaced[j]] = [shuffledPlaced[j], shuffledPlaced[i]];
            }
            
            // 收集所有可能的放置位置
            const candidates = [];
            
            for (const pid of shuffledPlaced) {
                const pTrans = placed[pid];
                const pVerts = getTransformedVerts(pid, pTrans);
                const pEdges = PIECE_EDGES[pid];
                const newEdges = PIECE_EDGES[newId];
                
                for (const ne of newEdges) {
                    for (const pe of pEdges) {
                        if (Math.abs(ne.len - pe.len) > 0.5) continue;
                        for (const dir of [1, -1]) {
                            const trans = computeAlignment(newId, ne.index, pid, pe.index, pVerts, dir);
                            const newVerts = getTransformedVerts(newId, trans);
                            
                            // 检查与所有已放置碎片的重叠
                            let overlap = false;
                            for (const pid2 of placedIds) {
                                const otherVerts = getTransformedVerts(pid2, placed[pid2]);
                                if (isOverlapping(newVerts, otherVerts)) { overlap = true; break; }
                            }
                            if (!overlap) {
                                candidates.push({ trans, verts: newVerts });
                            }
                        }
                    }
                }
            }
            
            if (candidates.length > 0) {
                // 随机选一个
                const chosen = candidates[Math.floor(Math.random() * candidates.length)];
                placed[newId] = chosen.trans;
                placedIds.push(newId);
                found = true;
            }
            
            if (!found) { success = false; break; }
        }
        
        if (success) {
            // 验证：所有碎片确实连通且不重叠
            const outline = extractOutline(placed);
            if (outline.length >= 3) {
                const sig = outlineSignature(outline);
                if (!seen.has(sig)) {
                    seen.add(sig);
                    // 归一化位置：让最小点在原点
                    let minX = Infinity, minY = Infinity;
                    for (let v of outline) {
                        if (v.x < minX) minX = v.x;
                        if (v.y < minY) minY = v.y;
                    }
                    const roundedOutline = outline.map(v => ({
                        x: Math.round((v.x - minX) * 10) / 10,
                        y: Math.round((v.y - minY) * 10) / 10
                    }));
                    const roundedSolution = {};
                    for (let id in placed) {
                        roundedSolution[id] = {
                            x: Math.round((placed[id].x - minX) * 10) / 10,
                            y: Math.round((placed[id].y - minY) * 10) / 10,
                            rotate: Math.round(placed[id].rotate * 10) / 10,
                            flip: placed[id].flip
                        };
                    }
                    results.push({ outline: roundedOutline, solution: roundedSolution });
                    if (results.length % 5 === 0) {
                        console.error(`已生成 ${results.length} 个（尝试 ${attempt} 次）`);
                    }
                }
            }
        }
    }
    
    return results;
}

const puzzles = generatePuzzles(40, 200000);
console.error(`最终生成 ${puzzles.length} 个不同形状`);
console.log(JSON.stringify(puzzles, null, 2));
