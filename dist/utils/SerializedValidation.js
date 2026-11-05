"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSerializedAsset = validateSerializedAsset;
exports.assertSerializedAsset = assertSerializedAsset;
/** 校验 2.4 对象表引用及层级关系；不添加 3.x CompPrefabInfo，不验证动态加载。 */
function validateSerializedAsset(data) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const errors = [];
    let errorCount = 0, visited = 0;
    const fail = text => { errorCount++; if (errors.length < 50)
        errors.push(text); };
    if (!Array.isArray(data) || !["cc.Prefab", "cc.SceneAsset"].includes((_a = data[0]) === null || _a === void 0 ? void 0 : _a.__type__)) {
        return { ok: false, complete: true, errors: ["不是 2.4 Prefab/SceneAsset 对象表"], errorCount: 1 };
    }
    const object = (ref, label) => {
        if (!ref || !Number.isInteger(ref.__id__) || ref.__id__ < 0 || !data[ref.__id__]) {
            fail(`${label}: 无效 __id__`);
            return null;
        }
        return data[ref.__id__];
    };
    const rootRef = data[0].__type__ === "cc.Prefab" ? data[0].data : data[0].scene;
    const root = object(rootRef, "资源根");
    if (root && root.__type__ !== (data[0].__type__ === "cc.Prefab" ? "cc.Node" : "cc.Scene"))
        fail("资源根类型错误");
    if (root === null || root === void 0 ? void 0 : root._parent)
        fail("资源根节点仍有父节点");
    const scan = (value, location, depth) => {
        if (++visited > 200000 || depth > 128)
            throw new Error("校验超出对象/深度预算");
        if (!value || typeof value !== "object")
            return;
        if (Object.prototype.hasOwnProperty.call(value, "__id__"))
            object(value, location);
        for (const key of Object.keys(value))
            scan(value[key], `${location}.${key}`, depth + 1);
    };
    try {
        scan(data, "$", 0);
    }
    catch (err) {
        fail(err.message);
        return { ok: false, complete: false, errors, errorCount };
    }
    const ids = new Set();
    for (let i = 0; i < data.length; i++) {
        const node = data[i];
        if (!["cc.Node", "cc.Scene"].includes(node === null || node === void 0 ? void 0 : node.__type__))
            continue;
        for (const key of ["_children", "_components"])
            if (node[key] !== undefined && !Array.isArray(node[key]))
                fail(`${i}.${key}: 需要数组`);
        const children = Array.isArray(node._children) ? node._children : [];
        const seen = new Set();
        for (const ref of children) {
            const child = object(ref, `${i}._children`);
            if (seen.has(ref === null || ref === void 0 ? void 0 : ref.__id__))
                fail(`${i}: 子节点重复`);
            seen.add(ref === null || ref === void 0 ? void 0 : ref.__id__);
            if (child && (child.__type__ !== "cc.Node" || ((_b = child._parent) === null || _b === void 0 ? void 0 : _b.__id__) !== i))
                fail(`${i}: 子节点类型或父子引用不一致`);
        }
        if (node !== root && node._parent) {
            const parent = object(node._parent, `${i}._parent`);
            if (parent && !((_c = parent._children) === null || _c === void 0 ? void 0 : _c.some(ref => ref.__id__ === i)))
                fail(`${i}: 父节点未引用该节点`);
        }
        for (const ref of Array.isArray(node._components) ? node._components : []) {
            const component = object(ref, `${i}._components`);
            if (component && ((_d = component.node) === null || _d === void 0 ? void 0 : _d.__id__) !== i)
                fail(`${i}: 组件 node 引用不一致`);
        }
        if (node._prefab) {
            const info = object(node._prefab, `${i}._prefab`);
            if (info && info.__type__ !== "cc.PrefabInfo")
                fail(`${i}: 预制体关联类型错误`);
            if (info && ((_e = object(info.root, `${i}.PrefabInfo.root`)) === null || _e === void 0 ? void 0 : _e.__type__) !== "cc.Node")
                fail(`${i}: PrefabInfo.root 类型错误`);
            if ((info === null || info === void 0 ? void 0 : info.asset) && Object.prototype.hasOwnProperty.call(info.asset, "__id__") && ((_f = object(info.asset, `${i}.PrefabInfo.asset`)) === null || _f === void 0 ? void 0 : _f.__type__) !== "cc.Prefab")
                fail(`${i}: PrefabInfo.asset 类型错误`);
            if (data[0].__type__ === "cc.Prefab" && ((_g = info === null || info === void 0 ? void 0 : info.asset) === null || _g === void 0 ? void 0 : _g.__id__) === 0 && ((_h = info.root) === null || _h === void 0 ? void 0 : _h.__id__) !== (rootRef === null || rootRef === void 0 ? void 0 : rootRef.__id__))
                fail(`${i}: 本资源 PrefabInfo.root 指向错误`);
            // 2.4 允许根 fileId 为空，嵌套实例按自己的 root/asset 区分。
            if (info === null || info === void 0 ? void 0 : info.fileId) {
                const key = JSON.stringify([info.root, info.asset, info.fileId]);
                if (ids.has(key))
                    fail(`${i}: 重复 Prefab fileId`);
                ids.add(key);
            }
        }
    }
    if (root) {
        const pending = [rootRef.__id__], reached = new Set();
        while (pending.length) {
            const id = pending.pop();
            if (reached.has(id)) {
                fail(`层级循环或重复节点: ${id}`);
                continue;
            }
            reached.add(id);
            const children = (_j = data[id]) === null || _j === void 0 ? void 0 : _j._children;
            if (Array.isArray(children))
                for (const ref of children)
                    if (Number.isInteger(ref === null || ref === void 0 ? void 0 : ref.__id__) && ((_k = data[ref.__id__]) === null || _k === void 0 ? void 0 : _k.__type__) === "cc.Node")
                        pending.push(ref.__id__);
        }
        data.forEach((item, id) => { if ((item === null || item === void 0 ? void 0 : item.__type__) === "cc.Node" && !reached.has(id))
            fail(`节点不属于资源根: ${id}`); });
    }
    return { ok: errorCount === 0, complete: true, errors, errorCount, objectCount: data.length, scope: "serialized-structure" };
}
function assertSerializedAsset(data) {
    const result = validateSerializedAsset(data);
    if (!result.ok)
        throw new Error("序列化结构校验失败: " + result.errors.join("; "));
    return result;
}
