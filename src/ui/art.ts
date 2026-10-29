import type Phaser from 'phaser'
import { gameColors } from '../colors'
import type { Team, UnitKind } from '../logic/types'

const SIZE = 96
const INK = 0x3a2a1e
const WOOL = 0xfffaf0
const WOOL_SHADE = 0xe8dfcf
const FACE = 0xf2d3a7
const HOOF = 0x6e4524

export function unitTexture(kind: UnitKind, team: Team): string {
  return `sheep-${kind}-${team}`
}

/** Generates all procedural unit art once. Textures survive scene restarts. */
export function createUnitTextures(scene: Phaser.Scene): void {
  for (const team of [0, 1] as const) {
    for (const kind of ['shield', 'archer', 'ram', 'healer'] as const) {
      const key = unitTexture(kind, team)
      if (scene.textures.exists(key)) continue
      const graphics = scene.add.graphics()
      drawSheep(graphics, kind, team)
      graphics.generateTexture(key, SIZE, SIZE)
      graphics.destroy()
    }
  }
}

function drawSheep(g: Phaser.GameObjects.Graphics, kind: UnitKind, team: Team): void {
  const teamColor = gameColors.teams[team]

  // Soft ground shadow.
  g.fillStyle(0x1c1408, 0.16)
  g.fillEllipse(48, 84, 52, 14)

  // Ink silhouette, then wool on top so the outline stays on the outside only.
  g.fillStyle(INK, 1)
  for (const [x, y, r] of BODY) g.fillCircle(x, y, r + 2)
  g.fillEllipse(48, 28, 31, 28)
  g.fillRoundedRect(29, 68, 15, 18, 6)
  g.fillRoundedRect(53, 68, 15, 18, 6)

  g.fillStyle(HOOF, 1)
  g.fillRoundedRect(29, 69, 15, 17, 6)
  g.fillRoundedRect(53, 69, 15, 17, 6)

  g.fillStyle(WOOL_SHADE, 1)
  for (const [x, y, r] of BODY) g.fillCircle(x, y, r)
  g.fillStyle(WOOL, 1)
  for (const [x, y, r] of BODY) g.fillCircle(x - 1, y - 1, r - 1)

  // Head, ears and face.
  g.fillStyle(INK, 1)
  g.fillEllipse(32, 25, 18, 13)
  g.fillEllipse(64, 25, 18, 13)
  g.fillStyle(FACE, 1)
  g.fillEllipse(32, 25, 15, 10)
  g.fillEllipse(64, 25, 15, 10)
  g.fillStyle(INK, 1)
  g.fillEllipse(48, 27, 33, 30)
  g.fillStyle(FACE, 1)
  g.fillEllipse(48, 27, 29, 26)

  // Team scarf.
  g.fillStyle(INK, 1)
  g.fillRoundedRect(30, 38, 37, 11, 5)
  g.fillStyle(teamColor, 1)
  g.fillRoundedRect(31, 39, 35, 9, 4)
  g.fillStyle(teamColor, 1)
  g.fillRoundedRect(25, 43, 11, 16, 4)

  // Eyes, nose, mouth, cheeks.
  g.fillStyle(INK, 1)
  g.fillCircle(42, 25, 2.6)
  g.fillCircle(54, 25, 2.6)
  g.fillStyle(0xffffff, 0.9)
  g.fillCircle(41.2, 24.2, 0.9)
  g.fillCircle(53.2, 24.2, 0.9)
  g.fillStyle(0xa8654c, 1)
  g.fillRoundedRect(45, 31, 7, 5, 2)
  g.lineStyle(1.6, INK, 0.8)
  g.beginPath()
  g.moveTo(46, 36)
  g.lineTo(48, 38)
  g.lineTo(50, 36)
  g.strokePath()
  g.fillStyle(0xf2a1a1, 0.5)
  g.fillCircle(37, 32, 3)
  g.fillCircle(59, 32, 3)

  drawRole(g, kind, team)
}

const BODY: readonly (readonly [number, number, number])[] = [
  [48, 54, 22],
  [31, 50, 13],
  [65, 50, 13],
  [37, 37, 12],
  [59, 37, 12],
]

function drawRole(g: Phaser.GameObjects.Graphics, kind: UnitKind, team: Team): void {
  const teamColor = gameColors.teams[team]
  switch (kind) {
    case 'shield': {
      g.fillStyle(INK, 1)
      g.fillCircle(24, 56, 14)
      g.fillStyle(gameColors.wood.mid, 1)
      g.fillCircle(24, 56, 12)
      g.lineStyle(2, gameColors.wood.dark, 1)
      g.strokeCircle(24, 56, 8)
      g.fillStyle(0xd9c89a, 1)
      g.fillCircle(24, 56, 4)
      g.lineStyle(2, teamColor, 1)
      g.strokeCircle(24, 56, 11)
      break
    }
    case 'archer': {
      g.lineStyle(3, INK, 1)
      g.beginPath()
      g.arc(70, 55, 15, -Math.PI / 2, Math.PI / 2, false)
      g.strokePath()
      g.lineStyle(2, gameColors.wood.light, 1)
      g.beginPath()
      g.arc(70, 55, 15, -Math.PI / 2, Math.PI / 2, false)
      g.strokePath()
      g.lineStyle(1.5, 0xffffff, 0.85)
      g.beginPath()
      g.moveTo(70, 40)
      g.lineTo(70, 70)
      g.strokePath()
      g.fillStyle(teamColor, 1)
      g.fillTriangle(67, 42, 73, 42, 70, 36)
      break
    }
    case 'ram': {
      // Bronze helmet and curled horns.
      g.fillStyle(INK, 1)
      g.fillCircle(33, 18, 9)
      g.fillCircle(63, 18, 9)
      g.fillStyle(0xe8c17a, 1)
      g.fillCircle(33, 18, 7)
      g.fillCircle(63, 18, 7)
      g.fillStyle(INK, 1)
      g.fillCircle(33, 18, 3.5)
      g.fillCircle(63, 18, 3.5)
      g.fillStyle(teamColor, 1)
      g.fillRoundedRect(36, 10, 24, 8, 4)
      g.fillStyle(0xd9a845, 1)
      g.fillTriangle(48, 2, 44, 12, 52, 12)
      break
    }
    case 'healer': {
      g.fillStyle(INK, 1)
      g.fillCircle(48, 9, 10)
      g.fillStyle(0xffffff, 1)
      g.fillCircle(48, 9, 8)
      g.fillStyle(gameColors.role.healer, 1)
      g.fillRoundedRect(46, 3, 4, 12, 1)
      g.fillRoundedRect(42, 7, 12, 4, 1)
      break
    }
  }
}
