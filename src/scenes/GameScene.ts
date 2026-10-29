import {
  Button,
  cssColor,
  displayTextStyle,
  getServices,
  Modal,
  onAppHidden,
  onLayoutChange,
  randomSeed,
  type SfxName,
  textStyle,
  type Viewport,
} from '@mg/core'
import { createRng, type Rng } from '@mg/core/rng'
import Phaser from 'phaser'
import { gameColors } from '../colors'
import { TICK_SECONDS } from '../logic/config'
import { canDeploy, createInitialState, step } from '../logic/state'
import type {
  Command,
  Difficulty,
  GameEvent,
  GameMode,
  GameState,
  Team,
  UnitKind,
  UnitState,
} from '../logic/types'
import { recordAiResult, recordLocalMatch } from '../save'
import { createUnitTextures } from '../ui/art'
import { BoardView } from '../ui/BoardView'
import { drawBackdrop } from '../ui/backdrop'
import { formatTime } from '../ui/format'
import { HudRail } from '../ui/HudRail'
import {
  type BattleLayout,
  computeBattleLayout,
  fieldY,
  halfAtY,
  laneAtX,
  laneCenterX,
} from '../ui/layout'
import { UnitView } from '../ui/UnitView'

interface GameSceneData {
  readonly mode?: GameMode
  readonly difficulty?: Difficulty
}

type Phase = 'countdown' | 'playing' | 'paused' | 'result'

const TICK_MS = TICK_SECONDS * 1000

export class GameScene extends Phaser.Scene {
  private mode: GameMode = 'ai'
  private difficulty: Difficulty = 'normal'
  private state!: GameState
  private rng!: Rng
  private phase: Phase = 'countdown'
  private layout!: BattleLayout
  private accumulator = 0
  private commands: Command[] = []
  private selected: [UnitKind | null, UnitKind | null] = [null, null]
  private board?: BoardView
  private rails: Array<HudRail | undefined> = []
  private backdrop?: Phaser.GameObjects.Graphics
  private timerText?: Phaser.GameObjects.Text
  private pressureText?: Phaser.GameObjects.Text
  private hintText?: Phaser.GameObjects.Text
  private pauseButton?: Button
  private modal?: Modal
  private countdownOverlay?: Phaser.GameObjects.Container
  private countdownText?: Phaser.GameObjects.Text
  private countdownLeft = 3.3
  private lastCountdownLabel = ''
  private unitViews = new Map<number, UnitView>()
  private previousY = new Map<number, number>()
  private art: Phaser.GameObjects.GameObject[] = []
  private hiddenUnsub?: () => void
  private lastHitSound = 0
  private finished = false
  private deployedOnce = false

  constructor() {
    super('Game')
  }

  init(data: GameSceneData): void {
    this.mode = data.mode === 'local' ? 'local' : 'ai'
    this.difficulty =
      data.difficulty === 'easy' || data.difficulty === 'hard' ? data.difficulty : 'normal'
  }

  create(): void {
    const services = getServices()
    this.phase = 'countdown'
    this.countdownLeft = 3.3
    this.lastCountdownLabel = ''
    this.accumulator = 0
    this.commands = []
    this.selected = [null, null]
    this.rails = []
    this.unitViews.clear()
    this.previousY.clear()
    this.art = []
    this.finished = false
    this.deployedOnce = false
    this.modal = undefined
    this.countdownOverlay = undefined
    this.timerText = undefined
    this.pressureText = undefined
    this.hintText = undefined
    this.pauseButton = undefined
    this.board = undefined
    this.backdrop = undefined

    this.state = createInitialState({ mode: this.mode, difficulty: this.difficulty })
    this.rng = createRng(randomSeed())
    createUnitTextures(this)
    this.cameras.main.setBackgroundColor(services.theme.bg)

    this.input.on('pointerdown', this.handlePointer, this)
    this.hiddenUnsub = onAppHidden(() => this.pause())
    onLayoutChange(this, (viewport) => this.rebuild(viewport))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hiddenUnsub?.()
      this.hiddenUnsub = undefined
      this.input.off('pointerdown', this.handlePointer, this)
    })
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 120)
    if (this.phase === 'countdown') {
      this.tickCountdown(delta)
      this.updateHud(dt)
      return
    }
    if (this.phase !== 'playing') {
      this.updateUnitViews(dt)
      this.updateHud(dt)
      return
    }

    this.accumulator += Math.min(delta, 250)
    let pending = this.commands
    let steps = 0
    while (this.accumulator >= TICK_MS && steps < 6 && this.phase === 'playing') {
      for (const unit of this.state.units) this.previousY.set(unit.id, unit.y)
      const result = step(this.state, TICK_SECONDS, pending, this.rng)
      pending = []
      this.state = result.state
      this.handleEvents(result.events)
      this.accumulator -= TICK_MS
      steps += 1
    }
    if (steps === 6) this.accumulator = 0
    this.commands = pending
    this.syncUnits()
    this.updateUnitViews(dt)
    this.updateHud(dt)
  }

  private rebuild(viewport: Viewport): void {
    this.layout = computeBattleLayout(viewport.width, viewport.height, viewport.insets)
    this.destroyArt()
    this.drawArt()
    this.refreshOverlay()
  }

  private destroyArt(): void {
    this.modal?.close()
    this.modal = undefined
    this.countdownOverlay?.destroy(true)
    this.countdownOverlay = undefined
    this.countdownText = undefined
    this.backdrop?.destroy()
    this.backdrop = undefined
    this.board?.destroy()
    this.board = undefined
    for (const rail of this.rails) rail?.destroy()
    this.rails = []
    for (const view of this.unitViews.values()) view.destroy()
    this.unitViews.clear()
    this.previousY.clear()
    for (const object of this.art) object.destroy()
    this.art = []
    this.backdrop = undefined
    this.timerText = undefined
    this.pressureText = undefined
    this.hintText = undefined
    this.pauseButton = undefined
  }

  private drawArt(): void {
    const services = getServices()
    const { width, height } = this.layout
    this.backdrop = drawBackdrop(this, width, height).setDepth(-10)

    this.board = new BoardView(this, this.layout)
    this.board.container.setDepth(2)
    const selectedTeam = this.selected[0] !== null ? 0 : this.selected[1] !== null ? 1 : null
    if (selectedTeam !== null) {
      this.board.setSelection(selectedTeam, this.selected[selectedTeam])
    }

    const labels = this.mode === 'ai' ? ['hud.you', 'hud.ai'] : ['hud.player1', 'hud.player2']
    for (const team of [0, 1] as const) {
      this.rails[team] = new HudRail({
        scene: this,
        layout: this.layout,
        team,
        flipped: this.mode === 'local' && team === 1,
        theme: services.theme,
        i18n: services.i18n,
        labelKey: labels[team] ?? 'hud.you',
        initialHp: this.state.teams[team].baseHp,
        interactive: this.mode === 'local' || team === 0,
        onSelect: (kind) => this.selectUnit(team, kind),
      })
    }

    this.drawTimer()
    this.drawPauseButton()
    if (this.phase === 'playing' && !this.deployedOnce) this.showDeployHint()
    this.syncUnits()
    this.updateHud(0)
  }

  private drawTimer(): void {
    const services = getServices()
    const { x, y } = this.layout.timer
    const plate = this.add.graphics().setDepth(60)
    plate.fillStyle(gameColors.wood.dark, 0.92)
    plate.fillRoundedRect(x - 62, y - 17, 124, 34, 17)
    plate.lineStyle(1, 0xffffff, 0.2)
    plate.strokeRoundedRect(x - 60, y - 15, 120, 30, 15)
    this.art.push(plate)
    this.timerText = this.add
      .text(x, y, '0:00', textStyle(services.theme, 17, '#fff6e3', true))
      .setOrigin(0.5)
      .setDepth(61)
    this.art.push(this.timerText)

    this.pressureText = this.add
      .text(x, y + 26, '', {
        ...textStyle(services.theme, 12, '#ffe27a', true),
        stroke: cssColor(gameColors.wood.dark),
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(61)
      .setVisible(false)
    this.art.push(this.pressureText)
  }

  private drawPauseButton(): void {
    const services = getServices()
    this.pauseButton = new Button(
      this,
      this.layout.pause.x,
      this.layout.pause.y,
      '',
      services.theme,
      {
        width: this.layout.pause.size,
        height: this.layout.pause.size,
        variant: 'soft',
        icon: 'pause',
        minHitSize: 52,
        onClick: () => this.pause(),
      },
    )
    this.pauseButton.setDepth(60)
    this.art.push(this.pauseButton)
  }

  private refreshOverlay(): void {
    this.modal?.close()
    this.modal = undefined
    this.countdownOverlay?.destroy(true)
    this.countdownOverlay = undefined
    this.countdownText = undefined
    if (this.phase === 'countdown') this.showCountdown()
    else if (this.phase === 'paused') this.showPause()
    else if (this.phase === 'result' && this.state.winner !== null)
      this.showResult(this.state.winner)
  }

  private showCountdown(): void {
    const services = getServices()
    const { width, height } = this.layout
    const overlay = this.add.container(0, 0).setDepth(1200)
    const backdrop = this.add
      .rectangle(0, 0, width, height, 0x1c1408, 0.36)
      .setOrigin(0)
      .setInteractive()
    const text = this.add
      .text(width / 2, height / 2, '', displayTextStyle(services.theme, 96, '#ffffff', true, 10, 7))
      .setOrigin(0.5)
    overlay.add([backdrop, text])
    this.countdownOverlay = overlay
    this.countdownText = text
    this.lastCountdownLabel = ''
  }

  private tickCountdown(delta: number): void {
    if (!this.countdownText) this.showCountdown()
    this.countdownLeft -= delta / 1000
    const services = getServices()
    const label =
      this.countdownLeft > 2.2
        ? '3'
        : this.countdownLeft > 1.2
          ? '2'
          : this.countdownLeft > 0.2
            ? '1'
            : services.i18n.t('countdown.go')
    if (label !== this.lastCountdownLabel) {
      this.lastCountdownLabel = label
      this.countdownText?.setText(label)
      this.countdownText?.setScale(1.35)
      this.tweens.add({
        targets: this.countdownText,
        scale: 1,
        duration: 180,
        ease: 'Back.Out',
      })
      services.audio.play('click')
    }
    if (this.countdownLeft <= 0) this.startPlaying()
  }

  private startPlaying(): void {
    this.phase = 'playing'
    this.accumulator = 0
    this.countdownOverlay?.destroy(true)
    this.countdownOverlay = undefined
    this.countdownText = undefined
    getServices().platform.gameplayStart()
    getServices().audio.play('start')
    if (!this.deployedOnce) this.showDeployHint()
  }

  private showDeployHint(): void {
    if (this.hintText || this.deployedOnce) return
    const services = getServices()
    this.hintText = this.add
      .text(this.layout.hint.x, this.layout.hint.y, services.i18n.t('hint.deploy'), {
        ...textStyle(services.theme, 18, '#ffffff', true),
        stroke: cssColor(gameColors.wood.dark),
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(55)
      .setAlpha(0)
    this.tweens.add({ targets: this.hintText, alpha: 1, duration: 240 })
    this.tweens.add({
      targets: this.hintText,
      alpha: 0,
      delay: 4200,
      duration: 500,
      onComplete: () => {
        this.hintText?.destroy()
        this.hintText = undefined
      },
    })
  }

  private selectUnit(team: Team, kind: UnitKind): void {
    if (this.phase !== 'playing') return
    if (this.mode === 'ai' && team === 1) return
    const services = getServices()
    const next = this.selected[team] === kind ? null : kind
    this.selected[team] = next
    if (next !== null) this.selected[1 - team] = null
    this.board?.setSelection(next === null ? null : team, kind)
    services.audio.play('click')
  }

  private handlePointer(pointer: Phaser.Input.Pointer): void {
    if (this.phase !== 'playing') return
    const x = pointer.worldX
    const y = pointer.worldY
    if (this.pauseButton?.getBounds().contains(x, y)) return
    const lane = laneAtX(this.layout, x)
    const half = halfAtY(this.layout, y)
    if (lane === null || half === null) return
    if (this.mode === 'ai' && half === 1) return
    const kind = this.selected[half]
    if (kind === null) {
      this.showTip(getServices().i18n.t('hint.select'))
      return
    }
    const command: Command = { type: 'deploy', team: half, kind, lane }
    if (!canDeploy(this.state, command)) {
      this.showTip(getServices().i18n.t('hint.wait'))
      return
    }
    this.commands.push(command)
    this.selected[half] = null
    this.board?.setSelection(null, null)
    this.deployedOnce = true
    this.hintText?.destroy()
    this.hintText = undefined
  }

  private showTip(text: string): void {
    if (!this.layout) return
    const services = getServices()
    const tip = this.add
      .text(this.layout.hint.x, this.layout.hint.y, text, {
        ...textStyle(services.theme, 16, '#fff6e3', true),
        stroke: cssColor(gameColors.wood.dark),
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(58)
    this.tweens.add({
      targets: tip,
      y: tip.y - 14,
      alpha: 0,
      duration: 700,
      ease: 'Quad.Out',
      onComplete: () => tip.destroy(),
    })
  }

  private updateHud(dtMs: number): void {
    this.rails[0]?.update(this.state.teams[0], this.selected[0], dtMs)
    this.rails[1]?.update(this.state.teams[1], this.selected[1], dtMs)
    this.timerText?.setText(formatTime(this.state.elapsed))
    if (this.pressureText) {
      const pressure = this.state.pressure
      this.pressureText.setVisible(pressure > 0)
      if (pressure > 0) {
        this.pressureText.setText(getServices().i18n.t('hud.pressureTier', { tier: pressure }))
      }
    }
  }

  private syncUnits(): void {
    const alive = new Set<number>()
    for (const unit of this.state.units) {
      alive.add(unit.id)
      if (!this.unitViews.has(unit.id)) this.spawnView(unit)
    }
    for (const [id, view] of [...this.unitViews]) {
      if (alive.has(id)) continue
      view.destroy()
      this.unitViews.delete(id)
      this.previousY.delete(id)
    }
  }

  private spawnView(unit: UnitState): void {
    if (this.unitViews.has(unit.id)) return
    this.unitViews.set(unit.id, new UnitView(this, this.layout, unit))
    this.previousY.set(unit.id, unit.y)
  }

  private updateUnitViews(dtMs: number): void {
    const alpha = Phaser.Math.Clamp(this.accumulator / TICK_MS, 0, 1)
    for (const unit of this.state.units) {
      const view = this.unitViews.get(unit.id)
      if (!view) continue
      const previous = this.previousY.get(unit.id) ?? unit.y
      const y = previous + (unit.y - previous) * alpha
      view.update(unit, y, dtMs)
    }
  }

  private handleEvents(events: readonly GameEvent[]): void {
    const services = getServices()
    for (const event of events) {
      switch (event.type) {
        case 'deploy':
          this.spawnView(event.unit)
          services.audio.play('boost', { pitch: 1.25, gain: 0.22 })
          break
        case 'hit': {
          const view = this.unitViews.get(event.targetId)
          view?.flashHit()
          this.floatText(
            laneCenterX(this.layout, event.lane),
            fieldY(this.layout, event.y) - 16,
            `-${Math.round(event.damage)}`,
            '#fff3c4',
          )
          this.playHitSound('eat', 1.35, 0.18)
          break
        }
        case 'heal': {
          const view = this.unitViews.get(event.targetId)
          view?.flashHeal()
          this.floatText(
            laneCenterX(this.layout, event.lane),
            fieldY(this.layout, event.y) - 16,
            `+${Math.round(event.amount)}`,
            '#9dffbe',
          )
          this.playHitSound('turn', 1.4, 0.16)
          break
        }
        case 'baseHit': {
          this.rails[event.team]?.flashBaseHit()
          this.cameras.main.shake(90, 0.0035)
          const y = fieldY(this.layout, event.team === 0 ? 0.02 : 0.98)
          this.burst(laneCenterX(this.layout, event.lane), y, gameColors.wood.light)
          this.playHitSound('die', 0.9, 0.24)
          break
        }
        case 'unitDied': {
          const view = this.unitViews.get(event.unit.id)
          view?.death()
          this.unitViews.delete(event.unit.id)
          this.previousY.delete(event.unit.id)
          this.playHitSound('die', 1.25, 0.16)
          break
        }
        case 'pressure':
          this.showBanner(services.i18n.t('hud.pressureTier', { tier: event.tier }))
          services.audio.play('boost', { pitch: 0.9, gain: 0.4 })
          break
        case 'won':
          this.finish(event.winner)
          break
      }
    }
  }

  private playHitSound(name: SfxName, pitch: number, gain: number): void {
    if (this.time.now - this.lastHitSound < 70) return
    this.lastHitSound = this.time.now
    getServices().audio.play(name, { pitch, gain })
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const label = this.add
      .text(x, y, text, {
        ...textStyle(getServices().theme, 16, color, true),
        stroke: cssColor(gameColors.wood.dark),
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(40)
    this.tweens.add({
      targets: label,
      y: y - 22,
      alpha: 0,
      duration: 520,
      ease: 'Quad.Out',
      onComplete: () => label.destroy(),
    })
  }

  private burst(x: number, y: number, color: number): void {
    const puff = this.add.graphics().setDepth(40)
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2
      const distance = 10 + (index % 3) * 5
      puff.fillStyle(color, 0.9)
      puff.fillCircle(Math.cos(angle) * distance, Math.sin(angle) * distance, 3 + (index % 2) * 2)
    }
    puff.setPosition(x, y)
    this.tweens.add({
      targets: puff,
      scale: 1.8,
      alpha: 0,
      duration: 280,
      onComplete: () => puff.destroy(),
    })
  }

  private showBanner(text: string): void {
    const services = getServices()
    const banner = this.add
      .text(this.layout.width / 2, this.layout.height * 0.42, text, {
        ...displayTextStyle(services.theme, 44, '#ffe27a', true, 8, 5),
      })
      .setOrigin(0.5)
      .setDepth(1100)
      .setScale(0.7)
      .setAlpha(0)
    this.tweens.add({
      targets: banner,
      scale: 1,
      alpha: 1,
      duration: 220,
      ease: 'Back.Out',
      yoyo: true,
      hold: 950,
      onComplete: () => banner.destroy(),
    })
  }

  private pause(): void {
    if (this.phase !== 'playing' && this.phase !== 'countdown') return
    this.phase = 'paused'
    this.accumulator = 0
    this.commands = []
    this.countdownOverlay?.destroy(true)
    this.countdownOverlay = undefined
    this.countdownText = undefined
    getServices().platform.gameplayStop()
    getServices().audio.play('pause')
    this.showPause()
  }

  private showPause(): void {
    if (this.modal) return
    const services = getServices()
    const i18n = services.i18n
    this.modal = new Modal(this, services.theme, {
      title: i18n.t('pause.title'),
      body: this.mode === 'local' ? i18n.t('menu.mode.local') : i18n.t('menu.mode.ai'),
      width: 440,
      height: 360,
      actionsLayout: 'column',
      actionHeight: 48,
      actions: [
        {
          label: i18n.t('pause.resume'),
          icon: 'play',
          variant: 'primary',
          onClick: () => {
            this.modal = undefined
            this.beginCountdown()
          },
        },
        {
          label: i18n.t('pause.restart'),
          icon: 'restart',
          variant: 'soft',
          onClick: () => {
            this.scene.restart({ mode: this.mode, difficulty: this.difficulty })
          },
        },
        {
          label: i18n.t('pause.menu'),
          icon: 'home',
          variant: 'ghost',
          onClick: () => {
            this.scene.start('Menu')
          },
        },
      ],
    })
  }

  private beginCountdown(): void {
    this.phase = 'countdown'
    this.countdownLeft = 3.3
    this.lastCountdownLabel = ''
    this.accumulator = 0
    this.commands = []
    this.selected = [null, null]
    this.board?.setSelection(null, null)
    this.countdownOverlay?.destroy(true)
    this.countdownOverlay = undefined
    this.countdownText = undefined
    this.showCountdown()
  }

  private finish(winner: Team): void {
    if (this.finished) return
    this.finished = true
    this.phase = 'result'
    const services = getServices()
    services.platform.gameplayStop()
    const playerWon = winner === 0
    if (this.mode === 'local' || playerWon) services.platform.happyTime()
    if (this.mode === 'ai') recordAiResult(services, playerWon, this.state.elapsed)
    else recordLocalMatch(services, winner)
    services.audio.play(playerWon || this.mode === 'local' ? 'start' : 'die')
    this.time.delayedCall(650, () => {
      if (this.phase === 'result' && this.scene.isActive() && !this.modal) {
        this.showResult(winner)
      }
    })
  }

  private showResult(winner: Team): void {
    const services = getServices()
    const i18n = services.i18n
    const title =
      this.mode === 'local'
        ? i18n.t(winner === 0 ? 'result.p0Win' : 'result.p1Win')
        : i18n.t(winner === 0 ? 'result.win' : 'result.lose')
    this.modal = new Modal(this, services.theme, {
      title,
      hero: formatTime(this.state.elapsed),
      body: i18n.t('result.time'),
      width: 460,
      height: 360,
      actions: [
        {
          label: i18n.t('result.replay'),
          icon: 'restart',
          variant: 'primary',
          onClick: () => {
            this.scene.restart({ mode: this.mode, difficulty: this.difficulty })
          },
        },
        {
          label: i18n.t('result.menu'),
          icon: 'home',
          variant: 'soft',
          onClick: () => {
            this.scene.start('Menu')
          },
        },
      ],
    })
  }
}
