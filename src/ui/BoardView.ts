import type Phaser from 'phaser'
import { gameColors } from '../colors'
import { LANE_COUNT, SPAWN_Y } from '../logic/config'
import type { Team, UnitKind } from '../logic/types'
import type { BattleLayout } from './layout'
import { fieldY, laneCenterX } from './layout'

/** Static battlefield art plus the deploy-selection overlay. */
export class BoardView {
  readonly container: Phaser.GameObjects.Container
  private readonly selection: Phaser.GameObjects.Graphics
  private pulse?: Phaser.Tweens.Tween

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: BattleLayout,
  ) {
    this.container = scene.add.container(0, 0)
    const field = scene.add.graphics()
    this.drawField(field)
    this.container.add(field)

    this.selection = scene.add.graphics()
    this.container.add(this.selection)
  }

  setSelection(team: Team | null, _kind: UnitKind | null): void {
    this.pulse?.stop()
    this.pulse = undefined
    this.selection.clear()
    this.selection.setAlpha(1)
    if (team === null) return

    const { board, laneWidth } = this.layout
    const color = gameColors.teams[team]
    this.selection.fillStyle(color, 0.1)
    this.selection.fillRect(
      board.x,
      team === 0 ? board.y + board.height / 2 : board.y,
      board.width,
      board.height / 2,
    )
    for (let lane = 0; lane < LANE_COUNT; lane += 1) {
      const x = board.x + laneWidth * lane
      const halfY = team === 0 ? board.y + board.height / 2 : board.y
      this.selection.lineStyle(2, 0xffffff, 0.3)
      this.selection.strokeRoundedRect(x + 3, halfY + 3, laneWidth - 6, board.height / 2 - 6, 8)
      const spawnY = fieldY(this.layout, team === 0 ? SPAWN_Y : 1 - SPAWN_Y)
      const dir = team === 0 ? -1 : 1
      this.selection.fillStyle(color, 0.75)
      this.selection.fillTriangle(
        x + laneWidth / 2,
        spawnY + dir * laneWidth * 0.26,
        x + laneWidth / 2 - laneWidth * 0.16,
        spawnY - dir * laneWidth * 0.08,
        x + laneWidth / 2 + laneWidth * 0.16,
        spawnY - dir * laneWidth * 0.08,
      )
    }
    this.pulse = this.scene.tweens.add({
      targets: this.selection,
      alpha: { from: 0.55, to: 1 },
      duration: 620,
      yoyo: true,
      repeat: -1,
    })
  }

  destroy(): void {
    this.pulse?.stop()
    this.container.destroy(true)
  }

  private drawField(g: Phaser.GameObjects.Graphics): void {
    const { board, laneWidth } = this.layout
    const { grass } = gameColors

    g.fillStyle(grass.edge, 1)
    g.fillRoundedRect(board.x - 7, board.y - 7, board.width + 14, board.height + 14, 20)
    g.fillStyle(grass.laneA, 1)
    g.fillRoundedRect(board.x, board.y, board.width, board.height, 14)

    for (let lane = 0; lane < LANE_COUNT; lane += 1) {
      const x = board.x + lane * laneWidth
      g.fillStyle(lane % 2 === 0 ? grass.laneA : grass.laneB, 1)
      g.fillRect(x, board.y, laneWidth, board.height)
      // Mowed-grass streaks inside every lane.
      g.lineStyle(2, 0xffffff, 0.055)
      for (const offset of [0.28, 0.52, 0.76]) {
        g.beginPath()
        g.moveTo(x + laneWidth * offset, board.y + 8)
        g.lineTo(x + laneWidth * offset, board.y + board.height - 8)
        g.strokePath()
      }
      if (lane > 0) {
        g.lineStyle(2, grass.line, 0.22)
        g.beginPath()
        g.moveTo(x, board.y + 6)
        g.lineTo(x, board.y + board.height - 6)
        g.strokePath()
      }
    }

    // Halfway marker.
    g.lineStyle(3, 0xffffff, 0.12)
    g.beginPath()
    g.moveTo(board.x + 10, board.y + board.height / 2)
    g.lineTo(board.x + board.width - 10, board.y + board.height / 2)
    g.strokePath()

    // Wooden trim at both ends.
    for (const top of [true, false]) {
      const y = top ? board.y - 7 : board.y + board.height + 7
      g.fillStyle(gameColors.wood.dark, 1)
      g.fillRoundedRect(board.x - 7, y - 5, board.width + 14, 12, 6)
      g.fillStyle(gameColors.wood.light, 1)
      g.fillRoundedRect(board.x - 4, y - 3, board.width + 8, 5, 3)
      g.lineStyle(1, gameColors.wood.grain, 0.7)
      for (let x = board.x + 18; x < board.x + board.width - 10; x += 34) {
        g.beginPath()
        g.moveTo(x, y - 2)
        g.lineTo(x + 14, y + 2)
        g.strokePath()
      }
    }

    // Base glow bands and spawn pads.
    for (const team of [0, 1] as const) {
      const color = gameColors.teams[team]
      const bandY = team === 0 ? board.y + board.height - 16 : board.y
      g.fillStyle(color, 0.28)
      g.fillRect(board.x, bandY, board.width, 16)
      for (let lane = 0; lane < LANE_COUNT; lane += 1) {
        const x = laneCenterX(this.layout, lane)
        const y = fieldY(this.layout, team === 0 ? SPAWN_Y : 1 - SPAWN_Y)
        g.lineStyle(2, color, 0.45)
        g.strokeCircle(x, y, laneWidth * 0.26)
        g.fillStyle(color, 0.16)
        g.fillCircle(x, y, laneWidth * 0.24)
      }
    }
  }
}
