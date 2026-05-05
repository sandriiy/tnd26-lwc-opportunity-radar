const DB_NAME = 'opportunityRadar';
const DB_VERSION = 2;
const STORE_NAME = 'opportunities';

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (db.objectStoreNames.contains(STORE_NAME)) {
                db.deleteObjectStore(STORE_NAME);
            }
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => {
            dbPromise = null;
            reject(event.target.error);
        };
        request.onblocked = () => {
            dbPromise = null;
            reject(new Error('IndexedDB upgrade blocked. Please close other tabs running this app and reload.'));
        };
    });
    return dbPromise;
}

async function readOpportunities() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = (event) => resolve(event.target.result || []);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function mergeOpportunities(records) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        records.forEach(record => store.put(record));
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(event.target.error);
    });
}

async function clearCache() {    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(event.target.error);
    });
}

async function evictFromCache(ids) {
    if (!ids || ids.length === 0) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        ids.forEach(id => store.delete(id));
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(event.target.error);
    });
}

export { readOpportunities, mergeOpportunities, evictFromCache, clearCache };
