/** Shared game types. `src/logic` stays free of Phaser, DOM, audio and ad SDKs. */

export type Team = 0 | 1
export type UnitKind = 'shield' | 'archer' | 'ram' | 'healer'
export type GameMode = 'ai' | 'local'
export type Difficulty = 'easy' | 'normal' | 'hard'

export interface UnitSpec {
  readonly kind: UnitKind
  readonly cost: number
  readonly maxHp: number
  /** Normalized field progress per second (the field spans 0..1). */
  readonly speed: number
  /** Normalized distance at which the unit stops and acts. */
  readonly range: number
  readonly damage: number
  readonly attackInterval: number
  /** Zero for combat units; healers use this and keep `damage` at zero. */
  readonly heal: number
}

export interface UnitState {
  readonly id: number
  readonly team: Team
  readonly kind: UnitKind
  readonly lane: number
  /** 0 is team 0's base, 1 is team 1's base. */
  readonly y: number
  readonly hp: number
  readonly cooldown: number
}

export interface TeamState {
  readonly energy: number
  readonly baseHp: number
  /** Seconds until the next deployment is accepted. */
  readonly deployTimer: number
  /** Seconds until the AI is allowed to make another decision. */
  readonly aiTimer: number
}

export interface GameState {
  readonly mode: GameMode
  readonly difficulty: Difficulty
  readonly elapsed: number
  readonly pressure: number
  readonly teams: readonly [TeamState, TeamState]
  readonly units: readonly UnitState[]
  readonly nextId: number
  readonly winner: Team | null
}

export interface DeployCommand {
  readonly type: 'deploy'
  readonly team: Team
  readonly kind: UnitKind
  readonly lane: number
}

export type Command = DeployCommand

export type GameEvent =
  | { readonly type: 'deploy'; readonly team: Team; readonly unit: UnitState }
  | {
      readonly type: 'hit'
      readonly attackerId: number
      readonly targetId: number
      readonly team: Team
      readonly lane: number
      readonly y: number
      readonly damage: number
      readonly lethal: boolean
    }
  | {
      readonly type: 'heal'
      readonly healerId: number
      readonly targetId: number
      readonly team: Team
      readonly lane: number
      readonly y: number
      readonly amount: number
    }
  | {
      readonly type: 'baseHit'
      readonly team: Team
      readonly lane: number
      readonly damage: number
      readonly baseHp: number
    }
  | { readonly type: 'pressure'; readonly tier: number }
  | { readonly type: 'unitDied'; readonly unit: UnitState }
  | { readonly type: 'won'; readonly winner: Team }

export interface StepResult {
  readonly state: GameState
  readonly events: readonly GameEvent[]
}

export interface GameConfig {
  readonly mode: GameMode
  readonly difficulty: Difficulty
}
