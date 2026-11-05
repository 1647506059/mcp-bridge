import { randomBytes } from "crypto";
import { getProjectContext } from "../core/ProjectContext";

export function windowGeometry(win) {
    const bounds = typeof win.getContentBounds === "function" ? win.getContentBounds() : null;
    return { windowId: win.id ?? null, webContentsId: win.webContents.id ?? null, bounds,
        zoomFactor: win.webContents.getZoomFactor?.() ?? null, url: win.webContents.getURL?.() ?? null };
}

// NativeImage 的逻辑尺寸可能与编码后的像素尺寸不同，坐标以实际返回图片为准。
export function encodedSize(bytes: Buffer, format: string) {
    if (format === "png" && bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
        return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }
    if (format === "jpeg" && bytes[0] === 255 && bytes[1] === 216) {
        let offset = 2;
        while (offset + 8 < bytes.length && bytes[offset] === 255) {
            const marker = bytes[offset + 1], length = bytes.readUInt16BE(offset + 2);
            if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
                return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
            }
            if (length < 2) break;
            offset += 2 + length;
        }
    }
    return null;
}

export class CaptureReceipts {
    private records = new Map<string, any>();
    clear() { this.records.clear(); }
    register(win, geometry, sourceSize, crop, imageSize, generation, stable) {
        const capturedAt = Date.now();
        for (const [id, item] of this.records) if (capturedAt - item.time > 60000) this.records.delete(id);
        while (this.records.size >= 16) this.records.delete(this.records.keys().next().value);
        const metadata = { captureId: "capture_" + randomBytes(12).toString("hex"), capturedAt: new Date(capturedAt).toISOString(),
            coordinateSpace: "image-pixels", origin: "top-left", imageSize, sourceSize, crop,
            window: geometry, expiresAfterMs: 60000, geometryStable: stable,
            coordinateMappingAvailable: !!imageSize && [imageSize.width, imageSize.height, sourceSize.width, sourceSize.height,
                geometry.bounds?.width, geometry.bounds?.height].every(value => Number.isFinite(value) && value > 0) && stable,
            projectContext: getProjectContext(), sceneContentVerified: false };
        this.records.set(metadata.captureId, { win, contents: win.webContents, metadata, time: capturedAt, generation });
        return metadata;
    }
    resolve(args, generation, currentWindow) {
        const record = this.records.get(args.captureId);
        if (!record || Date.now() - record.time > 60000 || record.generation !== generation) throw new Error("截图已失效，请重新截图");
        const { win, contents, metadata } = record;
        if (win !== currentWindow || win.webContents !== contents || win.isDestroyed?.() || win.isMinimized?.() || win.isVisible?.() === false
            || JSON.stringify(windowGeometry(win)) !== JSON.stringify(metadata.window)) throw new Error("窗口或缩放已变化，请重新截图");
        if (!metadata.coordinateMappingAvailable) throw new Error("截图缺少稳定的窗口几何信息，无法校准坐标");
        const image = metadata.imageSize, crop = metadata.crop, source = metadata.sourceSize, bounds = metadata.window.bounds;
        if (!Array.isArray(args.points) || !args.points.length || args.points.length > 100) throw new Error("points 必须包含 1–100 个图像像素坐标");
        const points = args.points.map(point => {
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.y < 0 || point.x >= image.width || point.y >= image.height) throw new Error("坐标必须位于返回的截图像素范围内");
            const x = crop.x + point.x * crop.width / image.width, y = crop.y + point.y * crop.height / image.height;
            return { image: point, capture: { x, y }, windowContent: { x: x * bounds.width / source.width, y: y * bounds.height / source.height } };
        });
        return { captureId: args.captureId, points, windowId: metadata.window.windowId,
            coordinateSpace: "electron-content-dip", sceneContentVerified: false };
    }
}
