import { cssColor, type I18n, type Theme, textStyle } from '@mg/core'
import Phaser from 'phaser'
import { gameColors } from '../colors'
import { UNIT_SPECS } from '../logic/config'
import type { Team, UnitKind } from '../logic/types'
import { unitTexture } from './art'

export interface CardViewOptions {
  kind: UnitKind
  width: number
  height: number
  theme: Theme
  i18n: I18n
  team: Team
  interactive?: boolean
  onSelect: (kind: UnitKind) => void
}

/** One deployment card inside a player's rail. */
export class CardView extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.Graphics
  private readonly icon: Phaser.GameObjects.Image
  private readonly cardWidth: number
  private readonly cardHeight: number
  private affordable = true
  private selected = false

  constructor(scene: Phaser.Scene, options: CardViewOptions) {
    super(scene, 0, 0)
    this.cardWidth = options.width
    this.cardHeight = options.height

    this.background = scene.add.graphics()
    this.add(this.background)

    const iconSize = Math.round(this.cardHeight * 0.56)
    this.icon = scene.add.image(0, -this.cardHeight * 0.12, unitTexture(options.kind, options.team))
    this.icon.setDisplaySize(iconSize, iconSize)
    this.add(this.icon)

    const nameSize = Math.round(Phaser.Math.Clamp(this.cardHeight * 0.13, 10, 17))
    const name = scene.add
      .text(
        0,
        this.cardHeight * 0.3,
        options.i18n.t(`unit.${options.kind}`),
        textStyle(options.theme, nameSize, cssColor(gameColors.wood.dark), true),
      )
      .setOrigin(0.5)
    this.add(name)

    const costSize = Math.round(Phaser.Math.Clamp(this.cardHeight * 0.11, 10, 15))
    const badgeX = this.cardWidth / 2 - Math.max(14, this.cardWidth * 0.13)
    const badgeY = -this.cardHeight / 2 + Math.max(14, this.cardHeight * 0.12)
    const badge = scene.add.graphics()
    badge.fillStyle(gameColors.wood.dark, 1)
    badge.fillCircle(badgeX, badgeY, Math.max(11, this.cardWidth * 0.108))
    badge.fillStyle(0xffcf52, 1)
    badge.fillCircle(badgeX, badgeY, Math.max(9, this.cardWidth * 0.092))
    badge.lineStyle(1.5, 0xffffff, 0.65)
    badge.strokeCircle(badgeX, badgeY, Math.max(9, this.cardWidth * 0.092) - 2)
    this.add(badge)
    const costLabel = scene.add
      .text(
        badgeX,
        badgeY - 1,
        String(UNIT_SPECS[options.kind].cost),
        textStyle(options.theme, costSize, '#4a3216', true),
      )
      .setOrigin(0.5)
    this.add(costLabel)

    if (options.interactive !== false) {
      const zone = scene.add.zone(0, 0, this.cardWidth, this.cardHeight)
      zone.setInteractive({ useHandCursor: true })
      zone.on('pointerover', () => this.setScale(1.03))
      zone.on('pointerout', () => this.setScale(1))
      zone.on('pointerdown', () => this.setScale(0.96))
      zone.on('pointerup', () => {
        this.setScale(1)
        if (this.affordable) options.onSelect(options.kind)
      })
      this.add(zone)
    }

    this.redraw()
    scene.add.existing(this)
  }

  refresh(affordable: boolean, selected: boolean): void {
    const changed = affordable !== this.affordable || selected !== this.selected
    this.affordable = affordable
    this.selected = selected
    this.setAlpha(affordable ? 1 : 0.55)
    if (changed) this.redraw()
  }

  private redraw(): void {
    const w = this.cardWidth
    const h = this.cardHeight
    const radius = Math.min(16, w * 0.16)
    const g = this.background
    g.clear()

    g.fillStyle(gameColors.wood.dark, 0.3)
    g.fillRoundedRect(-w / 2 + 1, -h / 2 + 5, w, h, radius)
    g.fillStyle(this.selected ? 0xffffff : gameColors.cream, 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius)
    g.lineStyle(
      this.selected ? 4 : 2,
      this.selected ? gameColors.theme.accent : gameColors.wood.mid,
      1,
    )
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius)
    g.fillStyle(this.selected ? gameColors.theme.accent : gameColors.wood.light, 0.18)
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.3, radius - 4)
  }
}
