import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  saveVRM,
  loadVRM,
  deleteVRM,
  listVRMs,
  updateLastUsed,
  getVRMCount,
  evictOldest,
  MAX_STORED_VRMS,
} from './vrm-storage'

// Helper to create a test ArrayBuffer of given byte length
function createBuffer(byteLength: number): ArrayBuffer {
  return new ArrayBuffer(byteLength)
}

// Helper to create a test Blob
function createThumbnail(): Blob {
  return new Blob(['thumb'], { type: 'image/jpeg' })
}

describe('vrm-storage', () => {
  beforeEach(async () => {
    // Clear all databases between tests
    const dbs = await indexedDB.databases()
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name)
    }
  })

  describe('saveVRM', () => {
    it('should store data and return a numeric ID', async () => {
      const id = await saveVRM(createBuffer(100), createThumbnail(), 'avatar.vrm', 100)
      expect(id).toBeTypeOf('number')
      expect(id).toBeGreaterThan(0)
    })

    it('should return incrementing IDs for successive saves', async () => {
      const id1 = await saveVRM(createBuffer(100), createThumbnail(), 'first.vrm', 100)
      const id2 = await saveVRM(createBuffer(200), createThumbnail(), 'second.vrm', 200)
      expect(id2).toBeGreaterThan(id1)
    })
  })

  describe('loadVRM', () => {
    it('should retrieve the correct ArrayBuffer by ID', async () => {
      const buffer = createBuffer(256)
      const view = new Uint8Array(buffer)
      view[0] = 42
      view[255] = 99

      const id = await saveVRM(buffer, createThumbnail(), 'test.vrm', 256)
      const stored = await loadVRM(id)

      expect(stored).not.toBeNull()
      expect(stored!.name).toBe('test.vrm')
      expect(stored!.size).toBe(256)
      const loadedView = new Uint8Array(stored!.data)
      expect(loadedView[0]).toBe(42)
      expect(loadedView[255]).toBe(99)
    })

    it('should return null for non-existent ID', async () => {
      const result = await loadVRM(9999)
      expect(result).toBeNull()
    })
  })

  describe('deleteVRM', () => {
    it('should remove the entry', async () => {
      const id = await saveVRM(createBuffer(100), createThumbnail(), 'delete-me.vrm', 100)
      await deleteVRM(id)
      const result = await loadVRM(id)
      expect(result).toBeNull()
    })
  })

  describe('listVRMs', () => {
    it('should return metadata without ArrayBuffer data', async () => {
      await saveVRM(createBuffer(100), createThumbnail(), 'a.vrm', 100)
      await saveVRM(createBuffer(200), createThumbnail(), 'b.vrm', 200)

      const list = await listVRMs()
      expect(list).toHaveLength(2)
      expect(list[0].name).toBe('a.vrm')
      expect(list[1].name).toBe('b.vrm')
      // Should not include the heavy ArrayBuffer data
      for (const entry of list) {
        expect(entry).not.toHaveProperty('data')
        expect(entry.id).toBeTypeOf('number')
        // fake-indexeddb doesn't fully support Blob structured cloning,
        // so we just check the property exists (real browsers handle Blob fine)
        expect(entry).toHaveProperty('thumbnail')
        expect(entry.createdAt).toBeTypeOf('number')
        expect(entry.lastUsedAt).toBeTypeOf('number')
      }
    })

    it('should return empty array when no VRMs stored', async () => {
      const list = await listVRMs()
      expect(list).toEqual([])
    })
  })

  describe('updateLastUsed', () => {
    it('should update the timestamp', async () => {
      const id = await saveVRM(createBuffer(100), createThumbnail(), 'test.vrm', 100)
      const before = (await loadVRM(id))!.lastUsedAt

      // Wait a tick to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 10))
      await updateLastUsed(id)

      const after = (await loadVRM(id))!.lastUsedAt
      expect(after).toBeGreaterThan(before)
    })
  })

  describe('getVRMCount', () => {
    it('should return correct count', async () => {
      expect(await getVRMCount()).toBe(0)
      await saveVRM(createBuffer(100), createThumbnail(), 'a.vrm', 100)
      expect(await getVRMCount()).toBe(1)
      await saveVRM(createBuffer(100), createThumbnail(), 'b.vrm', 100)
      expect(await getVRMCount()).toBe(2)
    })
  })

  describe('evictOldest', () => {
    it('should remove the entry with the oldest lastUsedAt', async () => {
      const id1 = await saveVRM(createBuffer(100), createThumbnail(), 'oldest.vrm', 100)
      await new Promise((r) => setTimeout(r, 10))
      const id2 = await saveVRM(createBuffer(100), createThumbnail(), 'newer.vrm', 100)

      await evictOldest()

      expect(await loadVRM(id1)).toBeNull()
      expect(await loadVRM(id2)).not.toBeNull()
    })

    it('should respect the excludeId parameter', async () => {
      const id1 = await saveVRM(createBuffer(100), createThumbnail(), 'oldest.vrm', 100)
      await new Promise((r) => setTimeout(r, 10))
      const id2 = await saveVRM(createBuffer(100), createThumbnail(), 'middle.vrm', 100)
      await new Promise((r) => setTimeout(r, 10))
      const id3 = await saveVRM(createBuffer(100), createThumbnail(), 'newest.vrm', 100)

      // Exclude the oldest — should evict the next oldest (id2)
      await evictOldest(id1)

      expect(await loadVRM(id1)).not.toBeNull()
      expect(await loadVRM(id2)).toBeNull()
      expect(await loadVRM(id3)).not.toBeNull()
    })
  })

  describe('LRU eviction at capacity', () => {
    it('should auto-evict when importing beyond MAX_STORED_VRMS', async () => {
      // Fill to capacity
      const ids: number[] = []
      for (let i = 0; i < MAX_STORED_VRMS; i++) {
        await new Promise((r) => setTimeout(r, 5))
        ids.push(await saveVRM(createBuffer(100), createThumbnail(), `vrm-${i}.vrm`, 100))
      }
      expect(await getVRMCount()).toBe(MAX_STORED_VRMS)

      // Import one more — should evict the first (oldest lastUsedAt)
      await new Promise((r) => setTimeout(r, 5))
      await saveVRM(createBuffer(100), createThumbnail(), 'overflow.vrm', 100)

      expect(await getVRMCount()).toBe(MAX_STORED_VRMS)
      // First entry should be evicted
      expect(await loadVRM(ids[0])).toBeNull()
    })

    it('should keep MAX_STORED_VRMS constant at 10', () => {
      expect(MAX_STORED_VRMS).toBe(10)
    })
  })

  describe('graceful degradation', () => {
    it('should handle operations when store is empty', async () => {
      // evictOldest on empty store should not throw
      await expect(evictOldest()).resolves.not.toThrow()
      // deleteVRM on non-existent ID should not throw
      await expect(deleteVRM(9999)).resolves.not.toThrow()
    })
  })
})
