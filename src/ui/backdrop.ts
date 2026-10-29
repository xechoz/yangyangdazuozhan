import type Phaser from 'phaser'
import { gameColors } from '../colors'

/** Cheerful sky-and-grass backdrop used by both the menu and the battlefield. */
export function drawBackdrop(
  scene: Phaser.Scene,
  width: number,
  height: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics()
  const horizon = height * 0.34
  const { grass } = gameColors

  g.fillStyle(0xa9e3ff, 1)
  g.fillRect(0, 0, width, horizon + 2)
  g.fillStyle(0xc9f0ff, 0.65)
  g.fillRect(0, 0, width, horizon * 0.45)

  g.fillStyle(0xfff3b0, 0.9)
  g.fillCircle(width * 0.84, height * 0.07, Math.max(24, height * 0.045))

  cloud(g, width * 0.16, height * 0.1, Math.max(22, height * 0.032))
  cloud(g, width * 0.62, height * 0.07, Math.max(18, height * 0.026))

  g.fillStyle(0x7fbe57, 1)
  g.fillEllipse(width * 0.2, horizon + 6, width * 0.72, height * 0.16)
  g.fillStyle(0x74b34c, 1)
  g.fillEllipse(width * 0.82, horizon + 10, width * 0.66, height * 0.15)

  g.fillStyle(grass.laneA, 1)
  g.fillRect(0, horizon, width, height - horizon)
  const band = Math.max(46, height * 0.08)
  for (let index = 0; index * band < height - horizon; index += 1) {
    if (index % 2 === 0) continue
    g.fillStyle(grass.laneB, 0.55)
    g.fillRect(0, horizon + index * band, width, band)
  }

  drawTree(g, width * 0.06, horizon + height * 0.05, Math.max(26, height * 0.05))
  drawTree(g, width * 0.94, horizon + height * 0.12, Math.max(22, height * 0.042))
  drawBush(g, width * 0.03, height * 0.86, Math.max(30, height * 0.055))
  drawBush(g, width * 0.97, height * 0.7, Math.max(26, height * 0.045))

  for (const [x, y, color] of FLOWERS) {
    g.fillStyle(color, 0.9)
    g.fillCircle(width * x, height * y, Math.max(2, height * 0.004))
  }
  return g
}

const FLOWERS: readonly (readonly [number, number, number])[] = [
  [0.035, 0.58, 0xffffff],
  [0.07, 0.66, 0xffd84d],
  [0.95, 0.48, 0xfff1b8],
  [0.9, 0.58, 0xffffff],
  [0.04, 0.78, 0xff9ec4],
  [0.96, 0.82, 0xffd84d],
]

function cloud(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
  g.fillStyle(0xffffff, 0.85)
  g.fillCircle(x, y, size)
  g.fillCircle(x + size * 0.9, y + size * 0.18, size * 0.75)
  g.fillCircle(x - size * 0.9, y + size * 0.22, size * 0.65)
  g.fillRoundedRect(x - size * 1.5, y + size * 0.2, size * 3, size * 0.7, size * 0.35)
}

function drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
  g.fillStyle(gameColors.wood.mid, 1)
  g.fillRoundedRect(x - size * 0.1, y, size * 0.2, size * 0.7, size * 0.08)
  g.fillStyle(0x3f8f3a, 1)
  g.fillTriangle(x, y - size, x - size * 0.62, y + size * 0.12, x + size * 0.62, y + size * 0.12)
  g.fillStyle(0x4fa347, 1)
  g.fillTriangle(
    x,
    y - size * 1.15,
    x - size * 0.52,
    y - size * 0.05,
    x + size * 0.52,
    y - size * 0.05,
  )
}

function drawBush(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
  g.fillStyle(0x3f8f3a, 0.9)
  g.fillCircle(x, y, size)
  g.fillCircle(x + size * 0.75, y + size * 0.2, size * 0.7)
  g.fillCircle(x - size * 0.7, y + size * 0.24, size * 0.62)
  g.fillStyle(0x54a94b, 0.9)
  g.fillCircle(x - size * 0.1, y - size * 0.12, size * 0.72)
  g.fillCircle(x + size * 0.6, y + size * 0.12, size * 0.5)
}
