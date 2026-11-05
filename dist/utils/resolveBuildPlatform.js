"use strict";
/**
 * 将 MCP / 用户传入的平台名解析为 Cocos Creator 2.4.x `builder:start-task` 所需的
 * `platform` 与 `actualPlatform`。
 *
 * 2.4.15 的 `Editor.Builder.simpleBuildTargets` 键是具体平台名（bytedance、wechatgame、alipay），
 * 不是 3.x 的分组名 `mini-game`。`local/builder.json` 里若写成 mini-game，原样传给 start-task
 * 会触发 `simpleBuildTargets['mini-game'].isNative` → undefined.isNative。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveBuildPlatform = resolveBuildPlatform;
exports.alignWithKnownTargets = alignWithKnownTargets;
exports.resolveBuildDest = resolveBuildDest;
/** 构建面板里可能出现的分组名，不能作为 start-task 的 platform */
const GROUP_PLATFORMS = {
    "mini-game": true,
    runtime: true,
};
/** 2.4 构建器一级平台（同时也是产物目录名） */
const TOP_LEVEL_PLATFORMS = {
    "web-mobile": true,
    "web-desktop": true,
    "fb-instant-games": true,
    wechatgame: true,
    bytedance: true,
    baidugame: true,
    alipay: true,
    "alipay-minigame": true,
    "taobao-minigame": true,
    xiaomi: true,
    android: true,
    ios: true,
    mac: true,
    win32: true,
    "android-instant": true,
    "harmonyos-next": true,
};
/** 用户习惯名 → 2.4 start-task 平台键 */
const ALIAS_TO_ACTUAL = {
    bytedance: "bytedance",
    baidu: "baidugame",
    baidugame: "baidugame",
    "baidugame-subcontext": "baidugame-subcontext",
    "bytedance-subcontext": "bytedance-subcontext",
    alipay: "alipay",
    "alipay-minigame": "alipay-minigame",
    taobao: "taobao-minigame",
    "taobao-minigame": "taobao-minigame",
    xiaomi: "xiaomi",
    ks: "ks",
    kuaishou: "ks",
    wechat: "wechatgame",
    wechatgame: "wechatgame",
    oppo: "oppo-mini-game",
    "oppo-mini-game": "oppo-mini-game",
    "oppo-runtime": "oppo-runtime",
    vivo: "vivo-mini-game",
    "vivo-mini-game": "vivo-mini-game",
    "vivo-runtime": "vivo-runtime",
    huawei: "huawei-quick-game",
    "huawei-quick-game": "huawei-quick-game",
    "cocos-play": "cocos-play",
    cocosplay: "cocos-play",
    qgame: "quickgame",
    quickgame: "quickgame",
};
function collapseGroup(platform, actualPlatform) {
    const plat = (platform || "").trim();
    const actual = (actualPlatform || "").trim();
    if (GROUP_PLATFORMS[plat]) {
        const key = actual && !GROUP_PLATFORMS[actual] ? actual : "bytedance";
        return { platform: key, actualPlatform: key };
    }
    if (GROUP_PLATFORMS[actual]) {
        const key = plat && !GROUP_PLATFORMS[plat] ? plat : "bytedance";
        return { platform: key, actualPlatform: key };
    }
    const resolved = plat || actual || "web-mobile";
    return { platform: resolved, actualPlatform: actual || resolved };
}
function resolveBuildPlatform(requested, queried) {
    const q = queried || {};
    const raw = (requested || "").trim();
    // 小游戏一级平台应归属于 "mini-game" 分组（与 GUI 构建面板一致：platform=mini-game, actualPlatform=具体平台）
    // 这样 builder:start-task 才能命中 Editor.Builder.simpleBuildTargets['mini-game']，
    // 避免把具体平台名直接当 platform 传导致 simpleBuildTargets[<具体平台>] 缺失而崩 isNative。
    const MINI_GAME_PLATFORMS = {
        bytedance: "bytedance",
        wechatgame: "wechatgame",
        alipay: "alipay-minigame",
        "alipay-minigame": "alipay-minigame",
        taobao: "taobao-minigame",
        "taobao-minigame": "taobao-minigame",
        xiaomi: "xiaomi",
        ks: "ks",
        kuaishou: "ks",
        baidugame: "baidugame",
        baidu: "baidugame",
        qgame: "quickgame",
        quickgame: "quickgame",
        oppo: "oppo-mini-game",
        "oppo-mini-game": "oppo-mini-game",
        vivo: "vivo-mini-game",
        "vivo-mini-game": "vivo-mini-game",
        huawei: "huawei-quick-game",
        "huawei-quick-game": "huawei-quick-game",
    };
    const miniGameActual = MINI_GAME_PLATFORMS[raw];
    if (miniGameActual) {
        // 统一归入 mini-game 分组，actualPlatform 用具体平台，与 GUI 面板一致
        return {
            platform: "mini-game",
            actualPlatform: miniGameActual,
        };
    }
    if (!raw) {
        return collapseGroup(q.platform || "web-mobile", q.actualPlatform);
    }
    if (ALIAS_TO_ACTUAL[raw]) {
        const actual = ALIAS_TO_ACTUAL[raw];
        return { platform: actual, actualPlatform: actual };
    }
    if (GROUP_PLATFORMS[raw]) {
        return collapseGroup(raw, q.actualPlatform);
    }
    if (TOP_LEVEL_PLATFORMS[raw]) {
        return { platform: raw, actualPlatform: raw };
    }
    return { platform: raw, actualPlatform: raw };
}
/**
 * 对照编辑器运行时的 simpleBuildTargets，避免把分组名 mini-game 传给 start-task。
 */
function alignWithKnownTargets(pair, knownTargets) {
    const known = knownTargets || {};
    const keys = Object.keys(known);
    if (keys.length === 0) {
        return pair;
    }
    // simpleBuildTargets 仅列出扩展渠道；Web/原生平台由构建器内置表处理。
    if (["web-mobile", "web-desktop", "fb-instant-games", "android", "ios", "mac", "win32", "android-instant"].includes(pair.platform))
        return pair;
    // 若 pair 是「分组 platform + 具体 actualPlatform」的小游戏结构（如 {platform:'mini-game', actualPlatform:'bytedance'}），
    // 直接保留不动。编辑器 build() 内部会通过平台映射处理分组，不能把分组 platform 改写成具体平台名，
    // 否则 simpleBuildTargets 找不到分组键 → undefined.isNative。
    if (GROUP_PLATFORMS[pair.platform] && pair.actualPlatform && !GROUP_PLATFORMS[pair.actualPlatform]) {
        return pair;
    }
    const candidates = [pair.platform, pair.actualPlatform];
    for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        if (c && known[c]) {
            return {
                platform: c,
                actualPlatform: pair.actualPlatform && known[pair.actualPlatform] ? pair.actualPlatform : c,
            };
        }
    }
    return {
        platform: pair.platform,
        actualPlatform: pair.actualPlatform,
        error: `未知构建平台: ${pair.platform}/${pair.actualPlatform}（可用: ${keys.join(", ")}）`,
    };
}
function resolveBuildDest(projectPath, buildPath, actualPlatform) {
    const pathMod = require("path");
    const rel = buildPath && String(buildPath).trim() ? String(buildPath) : "./build";
    if (pathMod.isAbsolute(rel)) {
        return pathMod.join(rel, actualPlatform);
    }
    return pathMod.join(projectPath, rel, actualPlatform);
}
