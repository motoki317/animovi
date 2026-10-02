import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { MEDIAPIPE_VERSION } from './constants'

describe('MEDIAPIPE_VERSION', () => {
  it('matches the installed @mediapipe/tasks-vision package', () => {
    // The package "exports" map hides package.json, so resolve the entry file.
    const entry = createRequire(import.meta.url).resolve('@mediapipe/tasks-vision')
    const pkg = JSON.parse(readFileSync(join(dirname(entry), 'package.json'), 'utf8'))
    expect(MEDIAPIPE_VERSION).toBe(pkg.version)
  })
})
