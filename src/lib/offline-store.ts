const DB_NAME = "fvl-offline";
const DB_VERSION = 1;

export interface PendingOp {
  id?: number;
  type: "insert" | "update" | "delete";
  table: string;
  data: Record<string, any>;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("cached-rides")) db.createObjectStore("cached-rides", { keyPath: "id" });
      if (!db.objectStoreNames.contains("cached-tbrs")) db.createObjectStore("cached-tbrs", { keyPath: "id" });
      if (!db.objectStoreNames.contains("pending-ops")) db.createObjectStore("pending-ops", { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putAll(storeName: string, items: any[]) {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  store.clear();
  items.forEach((item) => store.put(item));
  return new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const req = store.getAll();
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

export async function cacheRides(rides: any[]) { await putAll("cached-rides", rides); }
export async function getCachedRides() { return getAll<any>("cached-rides"); }

export async function cacheTbrs(tbrs: any[]) { await putAll("cached-tbrs", tbrs); }
export async function getCachedTbrs() { return getAll<any>("cached-tbrs"); }

export async function addPendingOp(op: Omit<PendingOp, "id">) {
  const db = await openDB();
  const tx = db.transaction("pending-ops", "readwrite");
  tx.objectStore("pending-ops").add(op);
  return new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function getPendingOps(): Promise<PendingOp[]> {
  const db = await openDB();
  const tx = db.transaction("pending-ops", "readonly");
  const store = tx.objectStore("pending-ops");
  const req = store.openCursor();
  const ops: PendingOp[] = [];
  return new Promise((res, rej) => {
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) { ops.push({ ...cursor.value, id: cursor.key as number }); cursor.continue(); }
      else res(ops.sort((a, b) => a.timestamp - b.timestamp));
    };
    req.onerror = () => rej(req.error);
  });
}

export async function removePendingOp(id: number) {
  const db = await openDB();
  const tx = db.transaction("pending-ops", "readwrite");
  tx.objectStore("pending-ops").delete(id);
  return new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function clearPendingOps() {
  const db = await openDB();
  const tx = db.transaction("pending-ops", "readwrite");
  tx.objectStore("pending-ops").clear();
  return new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function getPendingOpsCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction("pending-ops", "readonly");
  const req = tx.objectStore("pending-ops").count();
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}
