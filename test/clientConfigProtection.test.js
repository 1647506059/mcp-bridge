const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { loadSource } = require('./sourceHarness');
const api = loadSource('utils/ClientConfigProtection.ts');
const name = 'mcp-bridge-project';
const entry = { command: 'node', args: [path.resolve('project/packages/mcp-bridge/dist/mcp-proxy.js')], env: { MCP_BRIDGE_PROJECT_PATH: path.resolve('project'), MCP_BRIDGE_HOST: '127.0.0.1' } };

test('POSIX 项目路径保持大小写敏感，不能覆盖仅大小写不同的工程', () => {
    const posix = loadSource('utils/ClientConfigProtection.ts', {}, { path: path.posix });
    const desired = { command: 'node', args: ['/project/A/proxy.js'], env: { MCP_BRIDGE_PROJECT_PATH: '/project/A' } };
    assert.throws(() => posix.mergeOwnedEntry({ ...desired, args: ['/project/a/proxy.js'] }, desired));
});

test('JSONC 注入保持注释、其他项目与自定义参数，重复注入不再改写', () => {
    const source = '{\n // 用户设置\n "theme": "dark", "mcpServers": { "other": {"command":"other"}, },\n}';
    const first = api.updateJsonClient(source, 'mcpServers', name, entry);
    assert.ok(first.includes('// 用户设置')); assert.ok(first.includes('"other"'));
    assert.equal(api.updateJsonClient(first, 'mcpServers', name, entry), first);
    const custom = api.mergeOwnedEntry({ ...entry, timeout: 999, headers: { custom: 'keep' }, env: { ...entry.env, EXTRA: 'keep' } }, entry);
    assert.equal(custom.timeout, 999); assert.equal(custom.env.EXTRA, 'keep');
    for (const current of [{ ...entry, disabled: true }, { ...entry, args: ['foreign.js'] }, { ...entry, env: { MCP_BRIDGE_PROJECT_PATH: path.resolve('foreign') } }]) assert.throws(() => api.mergeOwnedEntry(current, entry));
    assert.throws(() => api.updateJsonClient('{"mcpServers":{},"mcpServers":{}}', 'mcpServers', name, entry), /Duplicate|duplicate/);
    assert.throws(() => api.updateJsonClient('{"mcpServers":[]}', 'mcpServers', name, entry));
});

test('TOML 保留其他表、自定义超时、env 和注释，拒绝重复与歧义形式', () => {
    const source = '# 用户配置\nmodel = "existing"\n[mcp_servers.other]\ncommand = "other"\n';
    const first = api.updateTomlClient(source, name, entry);
    assert.ok(first.startsWith(source)); assert.equal(api.updateTomlClient(first, name, entry), first);
    const custom = first.replace('command = "node"', 'timeout = 99\n# 自定义注释\ncommand = "node"');
    assert.equal(api.updateTomlClient(custom, name, entry), custom);
    const quoted = first.replace('[mcp_servers.' + name + ']', '[mcp_servers."' + name + '"]').replace('[mcp_servers.' + name + '.env]', '[mcp_servers."' + name + '".env]');
    assert.equal(api.updateTomlClient(quoted, name, entry), quoted);
    assert.throws(() => api.updateTomlClient(first + '\n[mcp_servers.' + name + ']\n', name, entry), /重复/);
    assert.throws(() => api.updateTomlClient('x = """\n[mcp_servers.x]\n"""', name, entry), /多行/);
    assert.throws(() => api.updateTomlClient(first.replace('command = "node"', 'command = "foreign"'), name, entry));
});

test('DSH 仅生成项目专属 overlay，保护禁用、外部地址和无关补丁', () => {
    const url = 'http://127.0.0.1:8200/mcp/project/id/';
    const first = api.updateDshPatch(undefined, name, url), parsed = JSON.parse(first);
    assert.equal(parsed[0].insert[0].config.transport, 'streamable-http');
    assert.equal(api.updateDshPatch(first, name, url), first);
    assert.throws(() => api.updateDshPatch(first, name, url + 'other'));
    parsed[0].insert[0].disabled = true;
    assert.throws(() => api.updateDshPatch(JSON.stringify(parsed), name, url));
    assert.throws(() => api.updateDshPatch('[{"remove":["user"]}]', name, url));
});
