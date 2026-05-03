const DB_NAME = 'opportunityRadar';
const DB_VERSION = 1;
const STORE_NAME = 'opportunities';
const FRESHNESS_KEY = 'opportunityRadar:v1:lastSyncedAt';
const FRESHNESS_TTL_MS = 2 * 60 * 1000;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
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

async function writeOpportunities(records) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        records.forEach(record => store.put(record));
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(event.target.error);
    });
}

async function clearCache() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(event.target.error);
    });
}

function isFresh() {
    try {
        const ts = localStorage.getItem(FRESHNESS_KEY);
        return ts !== null && (Date.now() - Number(ts)) < FRESHNESS_TTL_MS;
    } catch (e) {
        return false;
    }
}

function markSynced() {
    try {
        localStorage.setItem(FRESHNESS_KEY, String(Date.now()));
    } catch (e) {}
}

export { readOpportunities, writeOpportunities, clearCache, isFresh, markSynced };
