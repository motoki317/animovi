/**
 * VRM Storage - IndexedDB persistence layer for VRM files.
 * Stores VRM ArrayBuffers with thumbnails, supports LRU eviction.
 */

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

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode)
        const store = tx.objectStore(STORE_NAME)
        const request = fn(store)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        tx.oncomplete = () => db.close()
        tx.onerror = () => {
          db.close()
          reject(tx.error)
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
  const count = await getVRMCount()
  if (count >= MAX_STORED_VRMS) {
    await evictOldest()
  }

  const now = Date.now()
  const entry = { data, thumbnail, name, size, createdAt: now, lastUsedAt: now }
  const id = await withStore<IDBValidKey>('readwrite', (store) => store.add(entry))
  return id as number
}

export async function loadVRM(id: number): Promise<StoredVRM | null> {
  const result = await withStore<StoredVRM | undefined>('readonly', (store) => store.get(id))
  return result ?? null
}

export async function deleteVRM(id: number): Promise<void> {
  await withStore<undefined>('readwrite', (store) => store.delete(id))
}

export async function listVRMs(): Promise<VRMMeta[]> {
  const db = await openDB()
  return new Promise<VRMMeta[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => {
      const entries: StoredVRM[] = request.result
      const metas: VRMMeta[] = entries.map(({ id, name, size, createdAt, lastUsedAt, thumbnail }) => ({
        id,
        name,
        size,
        createdAt,
        lastUsedAt,
        thumbnail,
      }))
      resolve(metas)
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

export async function updateLastUsed(id: number): Promise<void> {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      if (getReq.result) {
        const entry = getReq.result
        entry.lastUsedAt = Date.now()
        store.put(entry)
      }
      resolve()
    }
    getReq.onerror = () => reject(getReq.error)
    tx.oncomplete = () => db.close()
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function updateThumbnail(id: number, thumbnail: Blob): Promise<void> {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      if (getReq.result) {
        const entry = getReq.result
        entry.thumbnail = thumbnail
        store.put(entry)
      }
      resolve()
    }
    getReq.onerror = () => reject(getReq.error)
    tx.oncomplete = () => db.close()
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function getVRMCount(): Promise<number> {
  return withStore<number>('readonly', (store) => store.count())
}

export async function evictOldest(excludeId?: number): Promise<void> {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('lastUsedAt')
    const request = index.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        // No entries to evict
        resolve()
        return
      }
      const entry = cursor.value as StoredVRM
      if (excludeId !== undefined && entry.id === excludeId) {
        // Skip excluded, try next
        cursor.continue()
        return
      }
      cursor.delete()
      resolve()
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}
