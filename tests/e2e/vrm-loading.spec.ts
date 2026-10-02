import { test, expect, type Page } from '@playwright/test'

// VRM 1.0 requires these humanoid bones. Each entry is [bone, parent, offset].
const BONES: Array<[string, string | null, [number, number, number]]> = [
  ['hips', null, [0, 1, 0]],
  ['spine', 'hips', [0, 0.1, 0]],
  ['head', 'spine', [0, 0.5, 0]],
  ['leftUpperArm', 'spine', [0.2, 0.35, 0]],
  ['leftLowerArm', 'leftUpperArm', [0.25, 0, 0]],
  ['leftHand', 'leftLowerArm', [0.25, 0, 0]],
  ['rightUpperArm', 'spine', [-0.2, 0.35, 0]],
  ['rightLowerArm', 'rightUpperArm', [-0.25, 0, 0]],
  ['rightHand', 'rightLowerArm', [-0.25, 0, 0]],
  ['leftUpperLeg', 'hips', [0.1, -0.05, 0]],
  ['leftLowerLeg', 'leftUpperLeg', [0, -0.45, 0]],
  ['leftFoot', 'leftLowerLeg', [0, -0.45, 0]],
  ['rightUpperLeg', 'hips', [-0.1, -0.05, 0]],
  ['rightLowerLeg', 'rightUpperLeg', [0, -0.45, 0]],
  ['rightFoot', 'rightLowerLeg', [0, -0.45, 0]],
]

// A mesh-free VRM 1.0 GLB, so that the spec needs no binary fixture.
function minimalVrm(): Buffer {
  const index = new Map(BONES.map(([name], i) => [name, i]))
  const nodes = BONES.map(([name, , translation]) => ({
    name,
    translation,
    children: BONES.filter(([, parent]) => parent === name).map(([child]) => index.get(child)!),
  }))
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    extensionsUsed: ['VRMC_vrm'],
    extensions: {
      VRMC_vrm: {
        specVersion: '1.0',
        meta: {
          name: 'e2e',
          authors: ['animovi'],
          // three-vrm rejects any other license URL by default.
          licenseUrl: 'https://vrm.dev/licenses/1.0/',
        },
        humanoid: {
          humanBones: Object.fromEntries(BONES.map(([name], i) => [name, { node: i }])),
        },
      },
    },
  }

  // GLB chunks are 4-byte aligned. JSON chunks pad with spaces.
  let chunk = Buffer.from(JSON.stringify(json))
  chunk = Buffer.concat([chunk, Buffer.alloc((4 - (chunk.length % 4)) % 4, ' ')])
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67, 0) // "glTF"
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(20 + chunk.length, 8)
  header.writeUInt32LE(chunk.length, 12)
  header.writeUInt32LE(0x4e4f534a, 16) // "JSON"
  return Buffer.concat([header, chunk])
}

// Next.js adds an empty role="alert" route announcer outside <main>.
const appAlert = (page: Page) => page.getByRole('main').getByRole('alert')

test.describe('VRM Loading E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('avatar-scene')).toBeVisible()
  })

  test('loads a VRM file and adds it to the gallery', async ({ page }) => {
    await page.getByTestId('vrm-file-input').setInputFiles({
      name: 'minimal.vrm',
      mimeType: 'application/octet-stream',
      buffer: minimalVrm(),
    })

    await expect(page.getByTestId('vrm-gallery')).toBeVisible()
    await expect(page.getByTestId(/^vrm-gallery-item-/)).toHaveCount(1)
    await expect(appAlert(page)).toHaveCount(0)
  })

  test('shows an error for an invalid file', async ({ page }) => {
    await page.getByTestId('vrm-file-input').setInputFiles({
      name: 'invalid.vrm',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('not a valid vrm file'),
    })

    await expect(appAlert(page)).toContainText('VRM load error')
  })
})
