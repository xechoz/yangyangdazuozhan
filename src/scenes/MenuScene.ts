import {
  Button,
  displayTextStyle,
  getServices,
  LANG_SHORT,
  maybeEnterFullscreen,
  onLayoutChange,
  readViewport,
  textStyle,
  type Viewport,
} from '@mg/core'
import Phaser from 'phaser'
import { gameColors } from '../colors'
import type { Difficulty, GameMode } from '../logic/types'
import { profileSave } from '../save'
import { createUnitTextures, unitTexture } from '../ui/art'
import { drawBackdrop } from '../ui/backdrop'
import { formatTime } from '../ui/format'
import { LanguageModal } from '../ui/LanguageModal'

export class MenuScene extends Phaser.Scene {
  private difficulty: Difficulty = 'normal'
  private languageModal?: LanguageModal

  constructor() {
    super('Menu')
  }

  create(): void {
    const services = getServices()
    services.platform.gameplayStop()
    createUnitTextures(this)
    this.cameras.main.setBackgroundColor(gameColors.theme.bg)
    this.difficulty = this.readDifficulty()
    onLayoutChange(this, (viewport) => this.build(viewport))
  }

  private readDifficulty(): Difficulty {
    const value = getServices().params.get('difficulty')
    return value === 'easy' || value === 'hard' ? value : 'normal'
  }

  private build(viewport: Viewport): void {
    const services = getServices()
    const theme = services.theme
    const i18n = services.i18n
    const save = profileSave(services).read()
    const { width, height, insets } = viewport
    const top = insets.top
    const bottom = height - insets.bottom

    this.languageModal?.close()
    this.languageModal = undefined
    this.tweens.killAll()
    this.children.removeAll(true)

    drawBackdrop(this, width, height)

    const titleSize = Phaser.Math.Clamp(height * 0.068, 40, 72)
    const title = this.add
      .text(
        width / 2,
        top + height * 0.11,
        i18n.t('game.title'),
        displayTextStyle(theme, titleSize, '#ffffff', true, 7, 5),
      )
      .setOrigin(0.5)
    title.setShadow(0, 6, 'rgba(42,29,16,0.28)', 0)

    const subtitleSize = Phaser.Math.Clamp(height * 0.022, 14, 22)
    this.add
      .text(width / 2, top + height * 0.11 + titleSize * 0.72, i18n.t('game.subtitle'), {
        ...textStyle(theme, subtitleSize, '#ffffff', true),
        stroke: '#3a2a1e',
        strokeThickness: 3,
      })
      .setOrigin(0.5)

    const mascotY = height * 0.31
    const mascotSize = Phaser.Math.Clamp(height * 0.11, 56, 112)
    const mascots = ['shield', 'ram', 'healer'] as const
    mascots.forEach((kind, index) => {
      const x = width / 2 + (index - 1) * mascotSize * 0.82
      const y = mascotY + (index === 1 ? -mascotSize * 0.12 : 0)
      const shadow = this.add.graphics()
      shadow.fillStyle(0x1c1408, 0.16)
      shadow.fillEllipse(x, y + mascotSize * 0.42, mascotSize * 0.7, mascotSize * 0.18)
      const image = this.add
        .image(x, y, unitTexture(kind, 0))
        .setDisplaySize(mascotSize, mascotSize)
      this.tweens.add({
        targets: image,
        y: y - Math.max(4, mascotSize * 0.07),
        duration: 900 + index * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      })
    })

    let y = mascotY + mascotSize * 0.66 + 26
    const buttonWidth = Math.min(width - 64, 520)
    const buttonHeight = Phaser.Math.Clamp(height * 0.052, 48, 64)
    const descSize = Phaser.Math.Clamp(height * 0.017, 11, 16)

    new Button(this, width / 2, y, i18n.t('menu.mode.ai'), theme, {
      width: buttonWidth,
      height: buttonHeight,
      fontSize: Math.round(buttonHeight * 0.42),
      icon: 'play',
      onClick: () => this.start('ai'),
    })
    y += buttonHeight / 2 + descSize * 0.9
    this.add
      .text(width / 2, y, i18n.t('menu.mode.aiDesc'), {
        ...textStyle(theme, descSize, '#ffffff', true),
        stroke: '#3a2a1e',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0.9)
    y += descSize * 1.6 + buttonHeight / 2

    new Button(this, width / 2, y, i18n.t('menu.mode.local'), theme, {
      width: buttonWidth,
      height: buttonHeight,
      variant: 'soft',
      fontSize: Math.round(buttonHeight * 0.42),
      onClick: () => this.start('local'),
    })
    y += buttonHeight / 2 + descSize * 0.9
    this.add
      .text(width / 2, y, i18n.t('menu.mode.localDesc'), {
        ...textStyle(theme, descSize, '#ffffff', true),
        stroke: '#3a2a1e',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0.9)
    y += descSize * 1.6 + 14

    this.add
      .text(width / 2, y, i18n.t('menu.difficulty'), textStyle(theme, 15, '#ffffff', true))
      .setOrigin(0.5)
    y += 24

    const chipGap = 8
    const chipWidth = Math.min((buttonWidth - chipGap * 2) / 3, 150)
    const chipHeight = Phaser.Math.Clamp(height * 0.034, 34, 44)
    const difficulties: Difficulty[] = ['easy', 'normal', 'hard']
    difficulties.forEach((difficulty, index) => {
      new Button(
        this,
        width / 2 + (index - 1) * (chipWidth + chipGap),
        y + chipHeight / 2,
        i18n.t(`difficulty.${difficulty}`),
        theme,
        {
          width: chipWidth,
          height: chipHeight,
          variant: difficulty === this.difficulty ? 'primary' : 'soft',
          fontSize: 16,
          minHitSize: 40,
          onClick: () => {
            this.difficulty = difficulty
            services.audio.play('click')
            this.build(readViewport(this))
          },
        },
      )
    })
    y += chipHeight + 28

    const panelWidth = Math.min(width - 48, 580)
    const panelHeight = 52
    const statsPanel = this.add.graphics()
    statsPanel.fillStyle(gameColors.wood.dark, 0.22)
    statsPanel.fillRoundedRect(width / 2 - panelWidth / 2 + 2, y + 6, panelWidth, panelHeight, 14)
    statsPanel.fillStyle(gameColors.cream, 0.94)
    statsPanel.fillRoundedRect(width / 2 - panelWidth / 2, y, panelWidth, panelHeight, 14)
    statsPanel.lineStyle(2, gameColors.wood.mid, 0.8)
    statsPanel.strokeRoundedRect(width / 2 - panelWidth / 2, y, panelWidth, panelHeight, 14)
    const best = save.ai.bestSeconds === null ? '—' : formatTime(save.ai.bestSeconds)
    this.add
      .text(
        width / 2,
        y + panelHeight / 2,
        `${i18n.t('menu.stats')}   ${save.ai.wins} ${i18n.t('menu.wins')} · ${save.ai.losses} ${i18n.t('menu.losses')} · ${i18n.t('menu.best')} ${best}`,
        {
          ...textStyle(theme, 15, gameColors.theme.text, true),
          align: 'center',
          wordWrap: { width: panelWidth - 24 },
        },
      )
      .setOrigin(0.5)
    y += panelHeight + 18

    if (y + 46 < bottom - 60) {
      const hintPanel = this.add.graphics()
      const hintWidth = Math.min(width - 48, 600)
      hintPanel.fillStyle(gameColors.wood.dark, 0.3)
      hintPanel.fillRoundedRect(width / 2 - hintWidth / 2, y, hintWidth, 38, 10)
      hintPanel.fillStyle(gameColors.wood.mid, 0.9)
      hintPanel.fillRoundedRect(width / 2 - hintWidth / 2, y + 4, hintWidth, 34, 9)
      this.add
        .text(width / 2, y + 21, i18n.t('menu.hint'), {
          ...textStyle(theme, 14, '#fff6e3', true),
          align: 'center',
          wordWrap: { width: hintWidth - 20 },
        })
        .setOrigin(0.5)
    }

    const controlY = bottom - 42
    new Button(this, width / 2 - 66, controlY, LANG_SHORT[i18n.lang], theme, {
      width: 118,
      height: 46,
      variant: 'soft',
      fontSize: 18,
      icon: 'globe',
      minHitSize: 48,
      onClick: () => this.openLanguage(),
    })

    const soundOn = services.settings.value.sound
    new Button(
      this,
      width / 2 + 66,
      controlY,
      soundOn ? i18n.t('menu.soundOn') : i18n.t('menu.soundOff'),
      theme,
      {
        width: 118,
        height: 46,
        variant: 'soft',
        fontSize: 14,
        icon: soundOn ? 'soundOn' : 'soundOff',
        minHitSize: 48,
        onClick: () => {
          services.setSound(!soundOn)
          if (!soundOn) services.audio.play('click')
          this.build(readViewport(this))
        },
      },
    )
  }

  private openLanguage(): void {
    const services = getServices()
    this.languageModal?.close()
    this.languageModal = new LanguageModal(this, {
      theme: services.theme,
      current: services.i18n.lang,
      title: services.i18n.t('menu.language'),
      onSelect: (lang) => {
        services.setLang(lang)
        services.audio.play('click')
        this.languageModal = undefined
        this.build(readViewport(this))
      },
    })
  }

  private start(mode: GameMode): void {
    maybeEnterFullscreen(this.scale)
    getServices().audio.play('start')
    this.scene.start('Game', { mode, difficulty: this.difficulty })
  }
}
