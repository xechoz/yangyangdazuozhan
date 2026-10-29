import Phaser from 'phaser'
import { gameColors } from '../colors'
import { UNIT_SPECS } from '../logic/config'
import type { UnitState } from '../logic/types'
import { unitTexture } from './art'
import type { BattleLayout } from './layout'
import { fieldY, laneCenterX } from './layout'

/** One animated unit on the field. Keeps render position separate from logic. */
export class UnitView {
  readonly container: Phaser.GameObjects.Container
  private readonly sprite: Phaser.GameObjects.Image
  private readonly hpBar: Phaser.GameObjects.Graphics
  private readonly size: number
  private readonly lane: number
  private readonly team: UnitState['team']
  private targetY: number
  private renderY: number
  private hp: number
  private maxHp: number
  private bobSeed: number

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: BattleLayout,
    unit: UnitState,
  ) {
    const spec = UNIT_SPECS[unit.kind]
    this.lane = unit.lane
    this.team = unit.team
    this.hp = unit.hp
    this.maxHp = spec.maxHp
    this.targetY = unit.y
    this.renderY = unit.y
    this.bobSeed = (unit.id * 2.399) % (Math.PI * 2)

    this.size = Phaser.Math.Clamp(layout.laneWidth * 0.86, 26, 68)
    this.container = scene.add.container(laneCenterX(layout, unit.lane), fieldY(layout, unit.y))
    this.container.setDepth(10 + Math.round((1 - unit.y) * 5))

    const shadow = scene.add.graphics()
    shadow.fillStyle(0x1c1408, 0.16)
    shadow.fillEllipse(0, this.size * 0.36, this.size * 0.68, this.size * 0.2)
    this.container.add(shadow)

    this.sprite = scene.add.image(0, 0, unitTexture(unit.kind, unit.team))
    this.sprite.setDisplaySize(this.size, this.size)
    if (unit.team === 1) this.sprite.setRotation(Math.PI)
    this.container.add(this.sprite)

    this.hpBar = scene.add.graphics()
    if (unit.team === 1) this.hpBar.setRotation(Math.PI)
    this.container.add(this.hpBar)
    this.drawHp()

    this.container.setScale(0.2)
    this.container.setAlpha(0)
    scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 160,
      ease: 'Back.Out',
    })
  }

  update(unit: UnitState, fieldPosition: number, dtMs: number): void {
    this.targetY = fieldPosition
    const y = fieldY(this.layout, this.renderY)
    this.container.setPosition(laneCenterX(this.layout, this.lane), y)
    const smoothing = Math.min(1, dtMs / 70)
    this.renderY += (this.targetY - this.renderY) * smoothing
    this.sprite.y =
      Math.sin(this.scene.time.now / 260 + this.bobSeed) * Math.max(0.8, this.size * 0.018)
    this.container.setDepth(10 + Math.round((1 - this.renderY) * 5))
    if (unit.hp !== this.hp) {
      this.hp = unit.hp
      this.drawHp()
    }
  }

  flashHit(): void {
    this.sprite.setTint(0xffd36e)
    this.scene.time.delayedCall(90, () => this.sprite.clearTint())
  }

  flashHeal(): void {
    this.sprite.setTint(0x9dffbe)
    this.scene.time.delayedCall(160, () => this.sprite.clearTint())
  }

  death(): void {
    const x = this.container.x
    const y = this.container.y
    const puff = this.scene.add.graphics()
    puff.fillStyle(gameColors.wool, 0.9)
    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI * 2
      puff.fillCircle(
        Math.cos(angle) * this.size * 0.22,
        Math.sin(angle) * this.size * 0.22,
        this.size * 0.18,
      )
    }
    puff.setPosition(x, y).setDepth(30)
    this.scene.tweens.add({
      targets: puff,
      alpha: 0,
      scale: 1.8,
      duration: 300,
      onComplete: () => puff.destroy(),
    })
    this.container.destroy(true)
  }

  destroy(): void {
    this.container.destroy(true)
  }

  private drawHp(): void {
    const width = this.size * 0.72
    const height = Math.max(4, this.size * 0.09)
    const y = -this.size * 0.55
    const ratio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1)
    const g = this.hpBar
    g.clear()
    g.fillStyle(0x2a1d10, 0.9)
    g.fillRoundedRect(-width / 2 - 1, y - 1, width + 2, height + 2, height / 2 + 1)
    g.fillStyle(gameColors.teams[this.team], 1)
    g.fillRoundedRect(-width / 2, y, width * ratio, height, height / 2)
    if (ratio < 1) {
      g.fillStyle(0x2a1d10, 0.55)
      g.fillRoundedRect(-width / 2 + width * ratio, y, width * (1 - ratio), height, height / 2)
    }
  }
}
