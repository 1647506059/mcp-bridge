"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.atomicWrite = atomicWrite;
exports.readBounded = readBounded;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
/** 同目录写完再替换；提交前确认读到的旧版本未变化。 */
function atomicWrite(file, content, expected) {
    const temporary = path.join(path.dirname(file), "." + path.basename(file) + ".mcp-" + crypto.randomBytes(8).toString("hex"));
    let published = false;
    try {
        fs.writeFileSync(temporary, content, { flag: "wx" });
        if (expected !== undefined && !fs.readFileSync(file).equals(Buffer.from(expected)))
            throw new Error("文件已变化，未覆盖，请重新读取");
        fs.renameSync(temporary, file);
        published = true;
    }
    finally {
        if (!published && fs.existsSync(temporary))
            fs.unlinkSync(temporary);
    }
}
function readBounded(file, maxBytes = 8 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        fs.open(file, "r", (err, fd) => {
            if (err)
                return reject(err);
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
                            if (readErr || verifyErr)
                                return reject(readErr || verifyErr);
                            if (offset + count !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) {
                                return reject(new Error("读取期间文件已变化，请重新读取"));
                            }
                            resolve(data.slice(0, offset + count));
                        }));
                    }
                    else {
                        offset += count;
                        read();
                    }
                });
                read();
            });
        });
    });
}
