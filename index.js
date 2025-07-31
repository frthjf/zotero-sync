"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sync = void 0;
const events = require("events");
const node_fetch_1 = require("node-fetch");
function enumerate(array) {
    return array.map((v, i) => [i, v]);
}
class Sync {
    constructor(batch = 50, emitter) {
        this.headers = { 'Zotero-API-Version': '3' };
        this.libraries = {};
        this.batch = batch;
        this.emitter = emitter || new events.EventEmitter();
    }
    on(event, handler) {
        this.emitter.on(event, handler);
    }
    local() {
        const prefix = '/api/users/0';
        this.libraries[prefix] = {
            type: 'local',
            prefix,
            name: '',
        };
        this.userID = 0;
    }
    async login(api_key) {
        var _a, _b, _c, _d, _e, _f;
        this.headers.Authorization = `Bearer ${api_key}`;
        const account = await this.json('https://api.zotero.org/keys/current');
        if ((_b = (_a = account.access) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.library) {
            const prefix = `/users/${account.userID}`;
            this.libraries[prefix] = {
                type: 'user',
                prefix,
                name: '',
            };
        }
        if ((_c = account.access) === null || _c === void 0 ? void 0 : _c.groups) {
            for (const library of await this.json(`https://api.zotero.org/users/${account.userID}/groups`)) {
                if (((_e = (_d = account.access) === null || _d === void 0 ? void 0 : _d.groups) === null || _e === void 0 ? void 0 : _e.all) || ((_f = account.access) === null || _f === void 0 ? void 0 : _f.groups[library.id])) {
                    const prefix = `/groups/${library.id}`;
                    this.libraries[prefix] = {
                        type: 'group',
                        prefix,
                        name: library.data.name,
                    };
                }
            }
        }
        this.userID = account.userID;
    }
    async fetch(url) {
        return await (0, node_fetch_1.default)(url, { headers: this.headers });
    }
    async json(url) {
        return await (await this.fetch(url)).json(); // eslint-disable-line @typescript-eslint/no-unsafe-return
    }
    async get(prefix, uri) {
        const library = this.libraries[prefix];
        if (!library)
            throw new Error(`${this.userID} does not have access to ${prefix}`);
        const baseUrl = (library.type === 'local') ? 'http://localhost:23119' : 'https://api.zotero.org';
        uri = `${baseUrl}${prefix}${uri}`;
        const res = await this.fetch(uri);
        if (typeof library.version === 'number') {
            if (res.headers.get('last-modified-version') !== `${library.version}`) {
                throw new Error(`last-modified-version changed from ${library.version} to ${res.headers.get('last-modified-version')} during sync, retry later`);
            }
        }
        else {
            library.version = parseInt(res.headers.get('last-modified-version'));
            if (isNaN(library.version))
                throw new Error(`${res.headers.get('last-modified-version')} is not a number`);
        }
        return await res.json(); // eslint-disable-line @typescript-eslint/no-unsafe-return
    }
    async sync(store, includeTrashed = true) {
        // remove libraries we no longer have access to
        const libraries = Object.keys(this.libraries);
        for (const user_or_group_prefix of store.libraries) {
            if (!user_or_group_prefix.startsWith('/users/') && !libraries.includes(user_or_group_prefix))
                await store.remove(user_or_group_prefix);
        }
        // update all libraries
        for (const [n, [prefix, library]] of enumerate(Object.entries(this.libraries))) {
            this.emitter.emit(Sync.event.library, library, n + 1, libraries.length);
            try {
                await this.update(store, prefix, includeTrashed);
            }
            catch (err) {
                this.emitter.emit(Sync.event.error, err);
            }
        }
    }
    async update(store, prefix, includeTrashed) {
        const stored = await store.get(prefix);
        const remote = this.libraries[prefix];
        if (remote.type !== 'local') { // local does not yet support deleted
            // first fetch also gets the remote version
            const deleted = await this.get(prefix, `/deleted?since=${stored.version}`);
            if (stored.version === remote.version)
                return;
            if (deleted.items.length) {
                this.emitter.emit(Sync.event.remove, 'items', deleted.items);
                await stored.remove(deleted.items);
            }
            if (deleted.collections.length) {
                this.emitter.emit(Sync.event.remove, 'collections', deleted.collections);
                await stored.remove_collections(deleted.collections);
            }
        }
        const items = Object.keys(await this.get(prefix, `/items?since=${stored.version}&format=versions&includeTrashed=${Number(includeTrashed)}`));
        for (let n = 0; n < items.length; n++) {
            for (const item of await this.get(prefix, `/items?itemKey=${items.slice(n, n + this.batch).join(',')}&includeTrashed=${Number(includeTrashed)}`)) {
                await stored.add(item.data);
                n += 1;
                this.emitter.emit(Sync.event.item, item.data, n, items.length);
            }
        }
        const collections = Object.keys(await this.get(prefix, `/collections?since=${stored.version}&format=versions`));
        for (let n = 0; n < collections.length; n++) {
            for (const collection of await this.get(prefix, `/collections?collectionKey=${collections.slice(n, n + this.batch).join(',')}`)) {
                await stored.add_collection(collection.data);
                n += 1;
                this.emitter.emit(Sync.event.collection, collection.data, n, collections.length);
            }
        }
        await stored.save(remote.type === 'group' ? remote.name : undefined, remote.version);
    }
}
exports.Sync = Sync;
Sync.event = {
    library: 'zotero-sync.save-library',
    collection: 'zotero-sync.save-collection',
    remove: 'zotero-sync.remove-objects',
    item: 'zotero-sync.save-item',
    error: 'zotero-sync.error',
};
