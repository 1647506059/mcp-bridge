"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaptureReceipts = void 0;
exports.windowGeometry = windowGeometry;
exports.encodedSize = encodedSize;
const crypto_1 = require("crypto");
const ProjectContext_1 = require("../core/ProjectContext");
function windowGeometry(win) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const bounds = typeof win.getContentBounds === "function" ? win.getContentBounds() : null;
    return { windowId: (_a = win.id) !== null && _a !== void 0 ? _a : null, webContentsId: (_b = win.webContents.id) !== null && _b !== void 0 ? _b : null, bounds,
        zoomFactor: (_e = (_d = (_c = win.webContents).getZoomFactor) === null || _d === void 0 ? void 0 : _d.call(_c)) !== null && _e !== void 0 ? _e : null, url: (_h = (_g = (_f = win.webContents).getURL) === null || _g === void 0 ? void 0 : _g.call(_f)) !== null && _h !== void 0 ? _h : null };
}
// NativeImage 的逻辑尺寸可能与编码后的像素尺寸不同，坐标以实际返回图片为准。
function encodedSize(bytes, format) {
    if (format === "png" && bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }
    if (format === "jpeg" && bytes[0] === 255 && bytes[1] === 216) {
        let offset = 2;
        while (offset + 8 < bytes.length && bytes[offset] === 255) {
            const marker = bytes[offset + 1], length = bytes.readUInt16BE(offset + 2);
            if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
                return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
            }
            if (length < 2)
                break;
            offset += 2 + length;
        }
    }
    return null;
}
class CaptureReceipts {
    constructor() {
        this.records = new Map();
    }
    clear() { this.records.clear(); }
    register(win, geometry, sourceSize, crop, imageSize, generation, stable) {
        var _a, _b;
        const capturedAt = Date.now();
        for (const [id, item] of this.records)
            if (capturedAt - item.time > 60000)
                this.records.delete(id);
        while (this.records.size >= 16)
            this.records.delete(this.records.keys().next().value);
        const metadata = { captureId: "capture_" + (0, crypto_1.randomBytes)(12).toString("hex"), capturedAt: new Date(capturedAt).toISOString(),
            coordinateSpace: "image-pixels", origin: "top-left", imageSize, sourceSize, crop,
            window: geometry, expiresAfterMs: 60000, geometryStable: stable,
            coordinateMappingAvailable: !!imageSize && [imageSize.width, imageSize.height, sourceSize.width, sourceSize.height, (_a = geometry.bounds) === null || _a === void 0 ? void 0 : _a.width, (_b = geometry.bounds) === null || _b === void 0 ? void 0 : _b.height].every(value => Number.isFinite(value) && value > 0) && stable,
            projectContext: (0, ProjectContext_1.getProjectContext)(), sceneContentVerified: false };
        this.records.set(metadata.captureId, { win, contents: win.webContents, metadata, time: capturedAt, generation });
        return metadata;
    }
    resolve(args, generation, currentWindow) {
        var _a, _b, _c;
        const record = this.records.get(args.captureId);
        if (!record || Date.now() - record.time > 60000 || record.generation !== generation)
            throw new Error("截图已失效，请重新截图");
        const { win, contents, metadata } = record;
        if (win !== currentWindow || win.webContents !== contents || ((_a = win.isDestroyed) === null || _a === void 0 ? void 0 : _a.call(win)) || ((_b = win.isMinimized) === null || _b === void 0 ? void 0 : _b.call(win)) || ((_c = win.isVisible) === null || _c === void 0 ? void 0 : _c.call(win)) === false
            || JSON.stringify(windowGeometry(win)) !== JSON.stringify(metadata.window))
            throw new Error("窗口或缩放已变化，请重新截图");
        if (!metadata.coordinateMappingAvailable)
            throw new Error("截图缺少稳定的窗口几何信息，无法校准坐标");
        const image = metadata.imageSize, crop = metadata.crop, source = metadata.sourceSize, bounds = metadata.window.bounds;
        if (!Array.isArray(args.points) || !args.points.length || args.points.length > 100)
            throw new Error("points 必须包含 1–100 个图像像素坐标");
        const points = args.points.map(point => {
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.y < 0 || point.x >= image.width || point.y >= image.height)
                throw new Error("坐标必须位于返回的截图像素范围内");
            const x = crop.x + point.x * crop.width / image.width, y = crop.y + point.y * crop.height / image.height;
            return { image: point, capture: { x, y }, windowContent: { x: x * bounds.width / source.width, y: y * bounds.height / source.height } };
        });
        return { captureId: args.captureId, points, windowId: metadata.window.windowId,
            coordinateSpace: "electron-content-dip", sceneContentVerified: false };
    }
}
exports.CaptureReceipts = CaptureReceipts;
