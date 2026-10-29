import type { Difficulty, UnitKind, UnitSpec } from './types'

/** Fixed simulation step in seconds. Rendering interpolates between steps. */
export const TICK_SECONDS = 0.05

export const LANE_COUNT = 5
export const BASE_HP = 100
export const START_ENERGY = 12
export const MAX_ENERGY = 20
export const ENERGY_REGEN = 0.85
export const DEPLOY_COOLDOWN = 0.45
export const MAX_UNITS_PER_TEAM = 16

/** Every pressure interval the whole field speeds up so matches always resolve. */
export const PRESSURE_INTERVAL = 60
export const PRESSURE_ENERGY = 0.18
export const PRESSURE_DAMAGE = 0.12
/** Base damage is deliberately lower than unit damage so pushes need support. */
export const BASE_DAMAGE_SCALE = 0.6
/** Missing base HP grants a small energy comeback bonus. */
export const COMEBACK_REGEN = 0.35

/** Units spawn just in front of their own base and stop just before the enemy base. */
export const SPAWN_Y = 0.03
export const BASE_LINE = 0.965
export const ALLY_SPACING = 0.028

export const UNIT_ORDER: readonly UnitKind[] = ['shield', 'archer', 'ram', 'healer']

export const UNIT_SPECS: Readonly<Record<UnitKind, UnitSpec>> = {
  shield: {
    kind: 'shield',
    cost: 2,
    maxHp: 64,
    speed: 0.036,
    range: 0.04,
    damage: 7,
    attackInterval: 1.05,
    heal: 0,
  },
  archer: {
    kind: 'archer',
    cost: 4,
    maxHp: 30,
    speed: 0.044,
    range: 0.16,
    damage: 9,
    attackInterval: 0.95,
    heal: 0,
  },
  ram: {
    kind: 'ram',
    cost: 5,
    maxHp: 38,
    speed: 0.062,
    range: 0.04,
    damage: 15,
    attackInterval: 1.25,
    heal: 0,
  },
  healer: {
    kind: 'healer',
    cost: 5,
    maxHp: 34,
    speed: 0.044,
    range: 0.18,
    damage: 0,
    attackInterval: 1.2,
    heal: 9,
  },
}

export interface AiTuning {
  /** Seconds between decisions. */
  readonly interval: number
  /** Chance per decision to ignore the smart choice. */
  readonly slip: number
  /** Minimum energy kept in reserve before pushing with an expensive unit. */
  readonly reserve: number
}

export const AI_TUNING: Readonly<Record<Difficulty, AiTuning>> = {
  easy: { interval: 1.5, slip: 0.35, reserve: 0 },
  normal: { interval: 1.05, slip: 0.14, reserve: 2 },
  hard: { interval: 0.7, slip: 0, reserve: 4 },
}

export function energyRegen(pressure: number, baseHp: number): number {
  const missing = 1 - Math.min(1, Math.max(0, baseHp / BASE_HP))
  return ENERGY_REGEN * (1 + PRESSURE_ENERGY * pressure) * (1 + COMEBACK_REGEN * missing)
}

export function damageMultiplier(pressure: number): number {
  return 1 + PRESSURE_DAMAGE * pressure
}
