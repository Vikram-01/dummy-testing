const crypto = require('crypto');
const store = new Map(); const files = new Map();
module.exports.secure = { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (k) => store.get(k) ?? null, setItemAsync: async (k, v) => { store.set(k, v); }, deleteItemAsync: async (k) => { store.delete(k); } };
module.exports.expoCrypto = { getRandomBytes: (n) => new Uint8Array(crypto.randomBytes(n)) };
class File { constructor(dir, name) { this.p = (dir?.p ?? '') + '/' + name; }
  get exists() { return files.has(this.p); } create() { files.set(this.p, ''); } write(t) { files.set(this.p, t); }
  async text() { return files.get(this.p); } delete() { files.delete(this.p); } }
module.exports.fs = { File, Paths: { document: { p: '/doc' }, cache: { p: '/cache' } } };
module.exports.files = files;
