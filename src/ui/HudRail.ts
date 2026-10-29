import { cssColor, type I18n, type Theme, textStyle } from '@mg/core'
import Phaser from 'phaser'
import { gameColors } from '../colors'
import { BASE_HP, UNIT_ORDER, UNIT_SPECS } from '../logic/config'
import type { Team, TeamState, UnitKind } from '../logic/types'
import { CardView } from './CardView'
import type { BattleLayout } from './layout'

export interface HudRailOptions {
  scene: Phaser.Scene
  layout: BattleLayout
  team: Team
  /** Rotate the rail 180° for the player sitting at the top of the screen. */
  flipped?: boolean
  theme: Theme
  i18n: I18n
  labelKey: string
  initialHp?: number
  interactive?: boolean
  onSelect: (kind: UnitKind) => void
}

/** Bottom (blue) or top (red, rotated 180°) player rail. */
export class HudRail {
  readonly container: Phaser.GameObjects.Container
  private readonly cards = new Map<UnitKind, CardView>()
  private readonly hpFill: Phaser.GameObjects.Graphics
  private readonly hpText: Phaser.GameObjects.Text
  private readonly energyText: Phaser.GameObjects.Text
  private readonly hpWidth: number
  private readonly hpHeight: number
  private readonly hpY: number
  private shownHp = BASE_HP
  private actualHp = BASE_HP
  private flash = 0
  private lastEnergy = -1

  constructor(private readonly options: HudRailOptions) {
    const { scene, layout, team, theme, i18n } = options
    this.container = scene.add.container(
      layout.width / 2,
      team === 0 ? layout.rail0Y : layout.rail1Y,
    )
    if (options.flipped ?? team === 1) this.container.setRotation(Math.PI)
    const initialHp = options.initialHp ?? BASE_HP
    this.shownHp = initialHp
    this.actualHp = initialHp
    this.container.setDepth(50)

    const railWidth = layout.width
    const background = scene.add.graphics()
    background.fillStyle(0x1c1408, 0.08)
    background.fillRect(
      -railWidth / 2,
      -layout.railHeight / 2 + 6,
      railWidth,
      layout.railHeight - 12,
    )
    this.container.add(background)

    this.hpWidth = Math.min(railWidth - 120, 660)
    this.hpHeight = Phaser.Math.Clamp(layout.railHeight * 0.15, 22, 38)
    const outer = team === 0 || options.flipped ? 1 : -1
    this.hpY = outer * (layout.railHeight / 2 - this.hpHeight / 2 - 8)

    if (layout.railHeight >= 190) {
      const labelY = this.hpY - outer * (this.hpHeight / 2 + 14)
      const label = scene.add
        .text(0, labelY, i18n.t(options.labelKey), textStyle(theme, 16, theme.text, true))
        .setOrigin(0.5)
      this.container.add(label)
    }

    // HP bar frame and fill.
    const frame = scene.add.graphics()
    const frameRadius = this.hpHeight / 2 + 3
    frame.fillStyle(gameColors.wood.dark, 1)
    frame.fillRoundedRect(
      -this.hpWidth / 2 - 4,
      this.hpY - this.hpHeight / 2 - 4,
      this.hpWidth + 8,
      this.hpHeight + 8,
      frameRadius,
    )
    frame.fillStyle(0x2a1d10, 1)
    frame.fillRoundedRect(
      -this.hpWidth / 2,
      this.hpY - this.hpHeight / 2,
      this.hpWidth,
      this.hpHeight,
      this.hpHeight / 2,
    )
    frame.lineStyle(1, 0xffffff, 0.14)
    frame.strokeRoundedRect(
      -this.hpWidth / 2 + 2,
      this.hpY - this.hpHeight / 2 + 2,
      this.hpWidth - 4,
      this.hpHeight - 4,
      this.hpHeight / 2 - 2,
    )
    this.container.add(frame)

    this.hpFill = scene.add.graphics()
    this.container.add(this.hpFill)

    this.hpText = scene.add
      .text(
        0,
        this.hpY,
        String(BASE_HP),
        textStyle(theme, Math.round(this.hpHeight * 0.62), '#ffffff', true),
      )
      .setOrigin(0.5)
      .setStroke(cssColor(gameColors.theme.ink), 3)
    this.container.add(this.hpText)

    // Energy coin beside the bar.
    const pillX = -this.hpWidth / 2 - 30
    const energyPill = scene.add.graphics()
    energyPill.fillStyle(gameColors.wood.dark, 1)
    energyPill.fillRoundedRect(pillX - 26, this.hpY - 17, 52, 34, 17)
    energyPill.fillStyle(0xffcf52, 1)
    energyPill.fillCircle(pillX - 10, this.hpY, 11)
    energyPill.fillStyle(0xffffff, 0.55)
    energyPill.fillCircle(pillX - 13, this.hpY - 3, 3)
    this.container.add(energyPill)
    this.energyText = scene.add
      .text(pillX + 6, this.hpY, '12', textStyle(theme, 16, '#fff6e3', true))
      .setOrigin(0.5)
    this.container.add(this.energyText)

    // Cards.
    const total = layout.card.width * 4 + layout.card.gap * 3
    const cardsY = -outer * (layout.railHeight / 2 - layout.card.height / 2 - 10)
    UNIT_ORDER.forEach((kind, index) => {
      const card = new CardView(scene, {
        kind,
        width: layout.card.width,
        height: layout.card.height,
        theme,
        i18n,
        team,
        interactive: options.interactive,
        onSelect: options.onSelect,
      })
      card.setPosition(
        -total / 2 + layout.card.width / 2 + index * (layout.card.width + layout.card.gap),
        cardsY,
      )
      this.cards.set(kind, card)
      this.container.add(card)
    })

    this.drawHp()
  }

  update(team: TeamState, selected: UnitKind | null, dtMs: number): void {
    this.actualHp = team.baseHp
    const smoothing = Math.min(1, dtMs / 120)
    if (Math.abs(this.shownHp - team.baseHp) < 0.05) this.shownHp = team.baseHp
    else this.shownHp += (team.baseHp - this.shownHp) * smoothing
    this.flash = Math.max(0, this.flash - dtMs / 260)

    const energy = Math.floor(team.energy)
    if (energy !== this.lastEnergy) {
      this.lastEnergy = energy
      this.energyText.setText(String(energy))
      this.energyText.setColor(energy >= 5 ? '#fff6e3' : '#ffd1c9')
    }

    for (const [kind, card] of this.cards) {
      card.refresh(team.energy >= UNIT_SPECS[kind].cost, kind === selected)
    }
    this.drawHp()
  }

  flashBaseHit(): void {
    this.flash = 1
  }

  destroy(): void {
    for (const card of this.cards.values()) card.destroy()
    this.cards.clear()
    this.container.destroy(true)
  }

  private drawHp(): void {
    const ratio = Phaser.Math.Clamp(this.shownHp / BASE_HP, 0, 1)
    const color = this.flash > 0.02 ? 0xffffff : gameColors.teams[this.options.team]
    const g = this.hpFill
    g.clear()
    if (ratio <= 0) return
    const width = (this.hpWidth - 8) * ratio
    g.fillStyle(color, 1)
    g.fillRoundedRect(
      -this.hpWidth / 2 + 4,
      this.hpY - this.hpHeight / 2 + 4,
      width,
      this.hpHeight - 8,
      (this.hpHeight - 8) / 2,
    )
    g.fillStyle(0xffffff, 0.24)
    g.fillRoundedRect(
      -this.hpWidth / 2 + 8,
      this.hpY - this.hpHeight / 2 + 7,
      Math.max(0, width - 10),
      Math.max(2, (this.hpHeight - 8) * 0.24),
      (this.hpHeight - 8) / 4,
    )
    this.hpText.setText(String(Math.ceil(this.actualHp)))
  }
}
