export const MAX_STORED_VRMS = 10

const DB_NAME = 'animovi-vrm'
const DB_VERSION = 1
const STORE_NAME = 'vrm-files'

export interface StoredVRM {
  id: number
  data: ArrayBuffer
  thumbnail: Blob
  name: string
  size: number
  createdAt: number
  lastUsedAt: number
}

export interface VRMMeta {
  id: number
  name: string
  size: number
  createdAt: number
  lastUsedAt: number
  thumbnail: Blob
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('lastUsedAt', 'lastUsedAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Settles on commit, not on request success. A quota error arrives only as an
// abort, after every request in the transaction already succeeded.
function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => () => T
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode)
        const readResult = run(tx.objectStore(STORE_NAME))
        tx.oncomplete = () => {
          db.close()
          resolve(readResult())
        }
        tx.onabort = () => {
          db.close()
          reject(tx.error ?? new Error('IndexedDB transaction aborted'))
        }
      })
  )
}

export async function saveVRM(
  data: ArrayBuffer,
  thumbnail: Blob,
  name: string,
  size: number
): Promise<number> {
  // No excludeId: the VRM being saved is the active one and is not stored yet,
  // so eviction cannot remove the active VRM.
  if ((await getVRMCount()) >= MAX_STORED_VRMS) {
    await evictOldest()
  }

  const now = Date.now()
  const entry = { data, thumbnail, name, size, createdAt: now, lastUsedAt: now }
  return transact('readwrite', (store) => {
    const request = store.add(entry)
    return () => request.result as number
  })
}

export function loadVRM(id: number): Promise<StoredVRM | null> {
  return transact('readonly', (store) => {
    const request = store.get(id)
    return () => (request.result as StoredVRM | undefined) ?? null
  })
}

export function deleteVRM(id: number): Promise<void> {
  return transact('readwrite', (store) => {
    store.delete(id)
    return () => undefined
  })
}

export function listVRMs(): Promise<VRMMeta[]> {
  return transact('readonly', (store) => {
    const request = store.getAll()
    return () =>
      (request.result as StoredVRM[]).map(({ id, name, size, createdAt, lastUsedAt, thumbnail }) => ({
        id,
        name,
        size,
        createdAt,
        lastUsedAt,
        thumbnail,
      }))
  })
}

function updateEntry(id: number, patch: Partial<StoredVRM>): Promise<void> {
  return transact('readwrite', (store) => {
    const request = store.get(id)
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, ...patch })
    }
    return () => undefined
  })
}

export function updateLastUsed(id: number): Promise<void> {
  return updateEntry(id, { lastUsedAt: Date.now() })
}

export function updateThumbnail(id: number, thumbnail: Blob): Promise<void> {
  return updateEntry(id, { thumbnail })
}

export function getVRMCount(): Promise<number> {
  return transact('readonly', (store) => {
    const request = store.count()
    return () => request.result
  })
}

export function evictOldest(excludeId?: number): Promise<void> {
  return transact('readwrite', (store) => {
    const request = store.index('lastUsedAt').openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      if ((cursor.value as StoredVRM).id === excludeId) {
        cursor.continue()
        return
      }
      cursor.delete()
    }
    return () => undefined
  })
}
