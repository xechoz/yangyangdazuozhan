import { getServices, textStyle } from '@mg/core'
import Phaser from 'phaser'

export class PlaceholderScene extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create(): void {
    const services = getServices()
    const theme = services.theme

    services.platform.gameplayStop()
    this.cameras.main.setBackgroundColor(theme.bg)

    this.add
      .text(640, 320, services.i18n.t('game.title'), textStyle(theme, 64, theme.text, true))
      .setOrigin(0.5)
    this.add
      .text(640, 392, services.i18n.t('game.subtitle'), textStyle(theme, 18, theme.textMuted))
      .setOrigin(0.5)
  }
}
