// 修正版七巧板题库生成器
// 修复了 Sutherland-Hodgman 裁剪bug，使用正确的重叠检测
// 使用光栅化+Marching Squares 提取轮廓用于去重

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

// 正确的 Sutherland-Hodgman 多边形裁剪
function isInside(p, a, b) {
    return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) <= 0;
}

function intersectSegments(s, e, a, b) {
    const d1x = e.x - s.x, d1y = e.y - s.y;
    const d2x = b.x - a.x, d2y = b.y - a.y;
    const denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) < 1e-10) return null;
    const t = (a.x - s.x) * d2y - (a.y - s.y) * d2x;
    const tt = t / denom;
    return { x: s.x + tt * d1x, y: s.y + tt * d1y };
}

function clipPolygon(subject, clip) {
    let output = subject.slice();
    let cp1 = clip[clip.length - 1];
    for (let i = 0; i < clip.length; i++) {
        let cp2 = clip[i];
        let input = output;
        output = [];
        let s = input[input.length - 1];
        for (let j = 0; j < input.length; j++) {
            let e = input[j];
            if (isInside(e, cp1, cp2)) {
                if (!isInside(s, cp1, cp2)) {
                    let inter = intersectSegments(s, e, cp1, cp2);
                    if (inter) output.push(inter);
                }
                output.push(e);
            } else if (isInside(s, cp1, cp2)) {
                let inter = intersectSegments(s, e, cp1, cp2);
                if (inter) output.push(inter);
            }
            s = e;
        }
        cp1 = cp2;
        if (output.length === 0) break;
    }
    // 去重
    const deduped = [];
    for (let p of output) {
        let dup = false;
        for (let u of deduped) if (Math.hypot(u.x - p.x, u.y - p.y) < 0.01) { dup = true; break; }
        if (!dup) deduped.push(p);
    }
    return deduped;
}

function computeIntersectionArea(verts1, verts2) {
    const clipped = clipPolygon(verts1, verts2);
    if (clipped.length < 3) return 0;
    return polygonArea(clipped);
}

function isOverlapping(verts1, verts2) {
    const area = computeIntersectionArea(verts1, verts2);
    return area > 0.1;
}

function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i=0, j=polygon.length-1; i<polygon.length; j=i++) {
        const xi=polygon[i].x, yi=polygon[i].y;
        const xj=polygon[j].x, yj=polygon[j].y;
        if ((yi > point.y) !== (yj > point.y)) {
            if (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi) inside = !inside;
        }
    }
    return inside;
}

// 光栅化 + Marching Squares 提取外轮廓
function extractOutline(transforms) {
    const GRID = 2;
    const ids = Object.keys(transforms);
    const vertsList = ids.map(id => getTransformedVerts(id, transforms[id]));

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let verts of vertsList) for (let v of verts) {
        if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
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
        if (x1 < x2 || (x1 === x2 && y1 < y2)) return x1 + ',' + y1 + '-' + x2 + ',' + y2;
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

            const x0 = minX + c * GRID, y0 = minY + r * GRID;
            const x1 = x0 + GRID, y1 = y0 + GRID;
            const mx = x0 + GRID / 2, my = y0 + GRID / 2;
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
    let curK = startK, prevK = null;
    let safety = segs.length * 2;
    while (safety-- > 0) {
        const v = vertMap.get(curK);
        ring.push({ x: v.pt.x, y: v.pt.y });
        let nextK = null;
        for (let nk of v.next) {
            if (nk === prevK) continue;
            if (used.has(curK + '|' + nk) || used.has(nk + '|' + curK)) continue;
            nextK = nk; break;
        }
        if (!nextK) break;
        used.add(curK + '|' + nextK);
        prevK = curK; curK = nextK;
        if (curK === startK) break;
    }

    if (ring.length < 3) return [];
    return ring;
}

// 计算对齐变换
function computeAlignment(newId, neIndex, pid, peIndex, pVerts, flipDir) {
    const nePts = PIECE_DEFS[newId].pts.split(' ').map(p => p.split(',').map(Number));
    const n1 = nePts[neIndex];
    const n2 = nePts[(neIndex + 1) % nePts.length];
    const p1 = pVerts[peIndex];
    const p2 = pVerts[(peIndex + 1) % pVerts.length];

    const pAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let nAngle;
    if (flipDir === -1) {
        // 水平翻转后边向量：dx取反，dy不变
        const dx = n1[0] - n2[0]; // 翻转后的边方向
        const dy = n2[1] - n1[1];
        nAngle = Math.atan2(dy, dx);
    } else {
        nAngle = Math.atan2(n2[1] - n1[1], n2[0] - n1[0]);
    }
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

// 轮廓签名：将轮廓归一化后用于去重
function outlineSignature(outline) {
    // 先简化轮廓，减少点数（每5个点取一个），然后做旋转+翻转归一化
    const n = outline.length;
    if (n < 3) return '';
    // 计算质心
    let cx = 0, cy = 0;
    for (let v of outline) { cx += v.x; cy += v.y; }
    cx /= n; cy /= n;
    // 计算各点到质心的距离序列（归一化）
    const dists = outline.map(v => Math.round(Math.hypot(v.x - cx, v.y - cy)));
    // 找最小旋转表示
    let minStr = dists.join(',');
    for (let start = 1; start < n; start++) {
        const seq = [];
        for (let k = 0; k < n; k++) seq.push(dists[(start + k) % n]);
        const s = seq.join(',');
        if (s < minStr) minStr = s;
    }
    // 反向
    const rev = dists.slice().reverse();
    for (let start = 0; start < n; start++) {
        const seq = [];
        for (let k = 0; k < n; k++) seq.push(rev[(start + k) % n]);
        const s = seq.join(',');
        if (s < minStr) minStr = s;
    }
    return n + '_' + minStr;
}

// 随机打乱
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function generatePuzzles(targetCount = 40, maxAttempts = 500000) {
    const results = [];
    const seen = new Set();

    for (let attempt = 0; attempt < maxAttempts && results.length < targetCount; attempt++) {
        const ids = shuffle(PIECE_IDS.slice());
        const placed = {};
        const placedIds = [];

        // 第一块随机旋转翻转
        const firstId = ids[0];
        const rotations = [0, 45, 90, 135, 180, 225, 270, 315];
        const firstRot = rotations[Math.floor(Math.random() * rotations.length)];
        const firstFlip = Math.random() < 0.5 ? 1 : -1;
        placed[firstId] = { x: 0, y: 0, rotate: firstRot, flip: firstFlip };
        placedIds.push(firstId);

        let success = true;
        for (let idx = 1; idx < ids.length; idx++) {
            const newId = ids[idx];
            const candidates = [];

            const shuffledPlaced = shuffle(placedIds.slice());

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
                const chosen = candidates[Math.floor(Math.random() * candidates.length)];
                placed[newId] = chosen.trans;
                placedIds.push(newId);
            } else {
                success = false;
                break;
            }
        }

        if (success) {
            // 用光栅化方法提取轮廓验证
            const outline = extractOutline(placed);
            const area = polygonArea(outline);
            // 面积应该接近160000（容差2%）
            if (Math.abs(area - 160000) / 160000 < 0.02 && outline.length > 10) {
                const sig = outlineSignature(outline);
                if (!seen.has(sig)) {
                    seen.add(sig);
                    // 归一化：平移到原点
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

const puzzles = generatePuzzles(30, 500000);
console.error(`最终生成 ${puzzles.length} 个不同形状`);
// 验证所有题目的面积
for (let i = 0; i < puzzles.length; i++) {
    const outline = extractOutline(puzzles[i].solution);
    const area = polygonArea(outline);
    console.error(`  题目 ${i}: 面积=${area.toFixed(0)} 点数=${outline.length}`);
}
console.log(JSON.stringify(puzzles, null, 2));
