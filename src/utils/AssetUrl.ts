/** AssetDB URL 不交给平台路径规范化，避免根目录、编码及回退语义不一致。 */

/** 资源根目录（assets / internal 本身，不带结尾斜杠）。 */
export function isAssetRoot(url: string): boolean {
    return url === "db://assets" || url === "db://internal";
}

export function validateAssetUrl(url: string, allowInternal = false): string {
    const roots = allowInternal ? /^db:\/\/(assets|internal)$/ : /^db:\/\/assets$/;
    const nested = allowInternal ? /^db:\/\/(assets|internal)\/.+/ : /^db:\/\/assets\/.+/;
    if (typeof url !== "string" || (!roots.test(url) && !nested.test(url))) {
        throw new Error("需要 db://assets/ 下的资源 URL（只读操作可传根目录 db://assets）");
    }
    const parts = url.slice(5).split("/");
    if (parts.some(part => !part || part === "." || part === ".." || /[\\\x00-\x1f%?#:]/.test(part))) {
        throw new Error("资源 URL 含非法路径或目录穿越");
    }
    return url;
}
