import {
  Button,
  LANG_LABELS,
  type Lang,
  readViewport,
  SUPPORTED_LANGS,
  type Theme,
  textStyle,
} from '@mg/core'
import Phaser from 'phaser'

export interface LanguageModalOptions {
  theme: Theme
  current: Lang
  title: string
  onSelect: (lang: Lang) => void
}

/** Compact 11-language picker. Native names only, no flags. */
export class LanguageModal extends Phaser.GameObjects.Container {
  private closed = false

  constructor(scene: Phaser.Scene, options: LanguageModalOptions) {
    super(scene, 0, 0)
    scene.add.existing(this).setDepth(2000)

    const viewport = readViewport(scene)
    const width = viewport.width
    const height = viewport.height
    const backdrop = scene.add
      .rectangle(0, 0, width, height, options.theme.overlay, 0.72)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
    backdrop.on('pointerup', () => this.close())
    this.add(backdrop)

    const cardWidth = Math.min(width - 24, 700)
    const cardHeight = Math.min(height - 24, 620)
    const card = scene.add.container(width / 2, height / 2)
    this.add(card)

    card.add(scene.add.rectangle(0, 0, cardWidth, cardHeight, 0, 0).setInteractive())

    const panel = scene.add.graphics()
    panel.fillStyle(options.theme.panel, 1)
    panel.fillRoundedRect(
      -cardWidth / 2,
      -cardHeight / 2,
      cardWidth,
      cardHeight,
      options.theme.radiusLarge,
    )
    panel.lineStyle(3, options.theme.ink, 1)
    panel.strokeRoundedRect(
      -cardWidth / 2,
      -cardHeight / 2,
      cardWidth,
      cardHeight,
      options.theme.radiusLarge,
    )
    card.add(panel)

    const title = scene.add
      .text(
        0,
        -cardHeight / 2 + 44,
        options.title,
        textStyle(options.theme, 30, options.theme.text, true),
      )
      .setOrigin(0.5)
    card.add(title)

    const close = new Button(scene, cardWidth / 2 - 34, -cardHeight / 2 + 34, '×', options.theme, {
      width: 44,
      height: 44,
      variant: 'soft',
      fontSize: 30,
      minHitSize: 48,
      onClick: () => this.close(),
    })
    card.add(close)

    const columns = cardWidth >= 560 ? 4 : cardWidth >= 420 ? 3 : 2
    const rows = Math.ceil(SUPPORTED_LANGS.length / columns)
    const gap = 8
    const availableHeight = cardHeight - 108
    const buttonHeight = Math.max(38, Math.min(56, (availableHeight - (rows - 1) * gap) / rows))
    const gridHeight = rows * buttonHeight + (rows - 1) * gap
    const buttonWidth = (cardWidth - 32 - (columns - 1) * gap) / columns
    const startY = -cardHeight / 2 + 84 + (availableHeight - gridHeight) / 2

    SUPPORTED_LANGS.forEach((lang, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const x = -cardWidth / 2 + 16 + column * (buttonWidth + gap) + buttonWidth / 2
      const y = startY + row * (buttonHeight + gap) + buttonHeight / 2
      const button = new Button(scene, x, y, LANG_LABELS[lang], options.theme, {
        width: buttonWidth,
        height: buttonHeight,
        variant: lang === options.current ? 'primary' : 'soft',
        fontSize: 22,
        minHitSize: 40,
        onClick: () => {
          if (this.closed) return
          this.close()
          options.onSelect(lang)
        },
      })
      card.add(button)
    })

    const onEsc = (): void => this.close()
    scene.input.keyboard?.on('keydown-ESC', onEsc)
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.keyboard?.off('keydown-ESC', onEsc)
    })

    this.setAlpha(0)
    card.setScale(0.96)
    scene.tweens.add({ targets: this, alpha: 1, duration: 150 })
    scene.tweens.add({ targets: card, scale: 1, duration: 180, ease: 'Back.Out' })
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.destroy(true)
  }
}
