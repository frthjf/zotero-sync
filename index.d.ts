import * as events from 'events';
import type { Zotero } from './typings/zotero';
type RemoteLibrary = {
    type: 'group' | 'user' | 'local';
    prefix: string;
    name: string;
    version?: number;
};
export declare class Sync {
    static event: {
        library: string;
        collection: string;
        remove: string;
        item: string;
        error: string;
    };
    protected headers: Record<string, string>;
    private batch;
    userID: number;
    libraries: Record<string, RemoteLibrary>;
    emitter: events.EventEmitter;
    constructor(batch?: number, emitter?: events.EventEmitter);
    on(event: string, handler: (...args: any[]) => void): void;
    local(): void;
    login(api_key: string): Promise<void>;
    protected fetch(url: string): Promise<import("node-fetch").Response>;
    private json;
    get(prefix: string, uri: string): Promise<any>;
    sync(store: Zotero.Store, includeTrashed?: boolean): Promise<void>;
    private update;
}
export {};
