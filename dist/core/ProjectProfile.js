"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadProjectProfile = loadProjectProfile;
/** Creator 2.4 的第二参数是默认配置对象，不能传插件名字符串。 */
function loadProjectProfile() {
    const profile = Editor.Profile.load("profile://project/mcp-bridge.json", {
        "auto-start": false, "last-port": 8200, "host": "127.0.0.1",
        "screenshot-max-width": 1280, "screenshot-throttle": 1500
    });
    const legacy = "mcp-bridge";
    // 只迁移旧错误参数产生的完整字符签名；undefined 在 JSON 保存时会被省略。
    if (Array.from(legacy).every((char, index) => profile.get(String(index)) === char)) {
        for (let index = 0; index < legacy.length; index++)
            profile.set(String(index), undefined);
        profile.save();
    }
    return profile;
}
