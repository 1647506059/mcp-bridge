import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

/** 同目录写完再替换；提交前确认读到的旧版本未变化。 */
export function atomicWrite(file: string, content: string | Buffer, expected?: Buffer | string) {
    const temporary = path.join(path.dirname(file), "." + path.basename(file) + ".mcp-" + crypto.randomBytes(8).toString("hex"));
    let published = false;
    try {
        fs.writeFileSync(temporary, content, { flag: "wx" });
        if (expected !== undefined && !fs.readFileSync(file).equals(Buffer.from(expected))) throw new Error("文件已变化，未覆盖，请重新读取");
        fs.renameSync(temporary, file);
        published = true;
    } finally {
        if (!published && fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
}

export function readBounded(file: string, maxBytes = 8 * 1024 * 1024): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        fs.open(file, "r", (err, fd) => {
            if (err) return reject(err);
            fs.fstat(fd, (statErr, stat) => {
                if (statErr || stat.size > maxBytes) {
                    fs.close(fd, () => reject(statErr || new Error(`文件超过读取上限 ${maxBytes} 字节`)));
                    return;
                }
                const data = Buffer.alloc(stat.size + 1);
                let offset = 0;
                const read = () => fs.read(fd, data, offset, data.length - offset, offset, (readErr, count) => {
                    if (readErr || !count || offset + count === data.length) {
                        fs.fstat(fd, (verifyErr, after) => fs.close(fd, () => {
                            if (readErr || verifyErr) return reject(readErr || verifyErr);
                            if (offset + count !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) {
                                return reject(new Error("读取期间文件已变化，请重新读取"));
                            }
                            resolve(data.slice(0, offset + count));
                        }));
                    } else { offset += count; read(); }
                });
                read();
            });
        });
    });
}
