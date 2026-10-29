import { createGame } from '@mg/core'
import { gameColors } from './colors'
import { gameI18n } from './i18n'
import { GameScene } from './scenes/GameScene'
import { MenuScene } from './scenes/MenuScene'

createGame({
  id: 'yangyangdazuozhan',
  design: { base: 720 },
  theme: gameColors.theme,
  defaultLang: 'en',
  i18n: gameI18n,
  menuScene: 'Menu',
  scenes: [MenuScene, GameScene],
})
