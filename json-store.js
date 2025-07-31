"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = exports.Library = void 0;
const fs = require("fs");
const path = require("path");
const stringify = require('json-stringify-pretty-compact');
// represents a personal or group library
class Library {
    // load the whole library when requested
    async load(filename) {
        this.filename = filename;
        try {
            // place whatever is in the file on this object
            Object.assign(this, JSON.parse(await fs.promises.readFile(this.filename, 'utf-8')));
        }
        catch (err) {
            // when something goes wrong (such as the file not yet existing), initialize to empty library
            this.items = [];
            this.collections = [];
            this.version = 0;
            this.name = '';
        }
        return this;
    }
    // add a collection
    async add_collection(collection) {
        // collections can also be added when they are modified, so remove it first
        await this.remove_collections([collection.key]);
        this.collections.push(collection);
    }
    async remove_collections(keys) {
        // remove it by just forgetting it
        this.collections = this.collections.filter(coll => !keys.includes(coll.key));
    }
    async add(item) {
        // add or modify single item. Modify = remove + add
        await this.remove([item.key]);
        this.items.push(item);
    }
    async remove(keys) {
        // remove it by just forgetting it
        this.items = this.items.filter(item => !(keys.includes(item.key)));
    }
    // save to disk
    async save(name, version) {
        this.name = name;
        this.version = version;
        await fs.promises.writeFile(this.filename, stringify({ items: this.items, collections: this.collections, name: this.name, version: this.version }));
    }
}
exports.Library = Library;
class Store {
    // would have preverred to do this in the constructor, but async
    async load(dir) {
        this.dir = dir;
        this.libraries = (await fs.promises.readdir(dir)).filter(name => name.startsWith('%') && name.endsWith('.json')).map(name => decodeURIComponent(name.replace(/\.json$/, '')));
        return this;
    }
    // remove library
    async remove(user_or_group_prefix) {
        try {
            await fs.promises.unlink(path.join(this.dir, this.filename(user_or_group_prefix)));
            this.libraries = this.libraries.filter(prefix => prefix !== user_or_group_prefix);
        }
        catch (err) {
            // pass
        }
    }
    // get existing library or create new
    async get(user_or_group_prefix) {
        const library = new Library();
        if (!this.libraries.includes(user_or_group_prefix))
            this.libraries.push(user_or_group_prefix);
        return await library.load(path.join(this.dir, this.filename(user_or_group_prefix)));
    }
    filename(user_or_group_prefix) {
        return `${encodeURIComponent(user_or_group_prefix)}.json`;
    }
}
exports.Store = Store;
