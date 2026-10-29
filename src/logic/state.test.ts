import { createRng } from '@mg/core/rng'
import { describe, expect, it } from 'vitest'
import { chooseAiCommand } from './ai'
import {
  BASE_HP,
  BASE_LINE,
  PRESSURE_INTERVAL,
  START_ENERGY,
  TICK_SECONDS,
  UNIT_SPECS,
} from './config'
import { canDeploy, createInitialState, step, teamUnitCount } from './state'
import type { GameMode, GameState, Team, UnitKind, UnitState } from './types'

const rng = () => createRng(7)

function localState(mode: GameMode = 'local'): GameState {
  return createInitialState({ mode, difficulty: 'normal' })
}

function unit(
  team: Team,
  kind: UnitKind,
  lane: number,
  y: number,
  overrides: Partial<UnitState> = {},
): UnitState {
  return {
    id: overrides.id ?? 100 + lane,
    team,
    kind,
    lane,
    y,
    hp: overrides.hp ?? UNIT_SPECS[kind].maxHp,
    cooldown: overrides.cooldown ?? 0,
  }
}

function withUnits(state: GameState, units: readonly UnitState[]): GameState {
  return { ...state, units, nextId: 500 }
}

function run(state: GameState, seconds: number, seed = 7): GameState {
  const random = createRng(seed)
  let current = state
  const ticks = Math.round(seconds / TICK_SECONDS)
  for (let tick = 0; tick < ticks; tick += 1) {
    current = step(current, TICK_SECONDS, [], random).state
  }
  return current
}

describe('createInitialState', () => {
  it('starts both sides at full HP with equal energy', () => {
    const state = localState()
    expect(state.teams[0].baseHp).toBe(BASE_HP)
    expect(state.teams[1].baseHp).toBe(BASE_HP)
    expect(state.teams[0].energy).toBe(START_ENERGY)
    expect(state.winner).toBeNull()
    expect(state.units).toHaveLength(0)
  })
})

describe('deployment', () => {
  it('spends energy and spawns on the requested lane', () => {
    const state = localState()
    const result = step(
      state,
      TICK_SECONDS,
      [{ type: 'deploy', team: 0, kind: 'ram', lane: 2 }],
      rng(),
    )
    expect(result.state.teams[0].energy).toBeCloseTo(START_ENERGY - UNIT_SPECS.ram.cost, 1)
    expect(result.state.units).toHaveLength(1)
    expect(result.state.units[0]?.lane).toBe(2)
    expect(result.state.units[0]?.team).toBe(0)
    expect(result.events.some((event) => event.type === 'deploy')).toBe(true)
  })

  it('rejects a second deployment during the cooldown window', () => {
    const state = localState()
    const first = step(
      state,
      TICK_SECONDS,
      [{ type: 'deploy', team: 0, kind: 'shield', lane: 0 }],
      rng(),
    )
    const second = step(
      first.state,
      TICK_SECONDS,
      [{ type: 'deploy', team: 0, kind: 'shield', lane: 1 }],
      rng(),
    )
    expect(second.state.units).toHaveLength(1)
  })

  it('rejects out-of-range lanes and unaffordable units', () => {
    const state = localState()
    expect(canDeploy(state, { type: 'deploy', team: 0, kind: 'ram', lane: -1 })).toBe(false)
    expect(canDeploy(state, { type: 'deploy', team: 0, kind: 'ram', lane: 5 })).toBe(false)
    const poor: GameState = {
      ...state,
      teams: [{ ...state.teams[0], energy: 1 }, state.teams[1]],
    }
    expect(canDeploy(poor, { type: 'deploy', team: 0, kind: 'ram', lane: 2 })).toBe(false)
    expect(teamUnitCount(poor, 0)).toBe(0)
  })
})

describe('combat', () => {
  it('moves units toward the enemy base when the lane is empty', () => {
    const state = withUnits(localState(), [unit(0, 'shield', 0, 0.5)])
    const next = step(state, TICK_SECONDS, [], rng()).state
    expect(next.units[0]?.y).toBeGreaterThan(0.5)
  })

  it('stops and trades damage when enemies meet', () => {
    const state = withUnits(localState(), [
      unit(0, 'shield', 0, 0.5, { id: 1 }),
      unit(1, 'archer', 0, 0.53, { id: 2 }),
    ])
    const result = step(state, TICK_SECONDS, [], rng())
    const hit = result.events.find((event) => event.type === 'hit')
    expect(hit).toBeDefined()
    const damaged = result.state.units.filter((entry) => entry.hp < UNIT_SPECS[entry.kind].maxHp)
    expect(damaged.length).toBeGreaterThan(0)
  })

  it('damages the enemy base at the front line and ends the match at zero', () => {
    const state = withUnits(localState(), [unit(0, 'ram', 3, BASE_LINE)])
    const next: GameState = {
      ...state,
      teams: [{ ...state.teams[0] }, { ...state.teams[1], baseHp: 8 }],
    }
    const result = step(next, TICK_SECONDS, [], rng())
    const baseHit = result.events.find((event) => event.type === 'baseHit')
    expect(baseHit).toBeDefined()
    expect(result.state.teams[1].baseHp).toBe(0)
    expect(result.state.winner).toBe(0)
    expect(result.events.some((event) => event.type === 'won')).toBe(true)
  })

  it('heals injured allies in the same lane', () => {
    const state = withUnits(localState(), [
      unit(0, 'healer', 1, 0.4, { id: 1 }),
      unit(0, 'shield', 1, 0.42, { id: 2, hp: 20 }),
    ])
    const result = step(state, TICK_SECONDS, [], rng())
    const heal = result.events.find((event) => event.type === 'heal')
    expect(heal).toBeDefined()
    expect(result.state.units.find((entry) => entry.id === 2)?.hp).toBe(29)
  })

  it('kills a unit and emits a death event', () => {
    const state = withUnits(localState(), [
      unit(0, 'ram', 0, 0.5, { id: 1, cooldown: 0 }),
      unit(1, 'archer', 0, 0.51, { id: 2, hp: 1 }),
    ])
    const result = step(state, TICK_SECONDS, [], rng())
    expect(result.state.units.some((entry) => entry.id === 2)).toBe(false)
    expect(result.events.some((event) => event.type === 'unitDied')).toBe(true)
  })
})

describe('pressure', () => {
  it('raises the tier and boosts regen after each interval', () => {
    const state = localState()
    const almost: GameState = {
      ...state,
      elapsed: PRESSURE_INTERVAL - 0.01,
      teams: [
        { ...state.teams[0], energy: 0 },
        { ...state.teams[1], energy: 0 },
      ],
    }
    const result = step(almost, TICK_SECONDS, [], rng())
    expect(result.state.pressure).toBe(1)
    expect(result.events.some((event) => event.type === 'pressure')).toBe(true)
    expect(result.state.teams[0].energy).toBeGreaterThan(0.04)
  })

  it('has no time-limit draw: a match only ends when a base falls', () => {
    const state = run(localState(), 180)
    expect(state.elapsed).toBeGreaterThan(179)
    expect(state.winner).toBeNull()
    expect(state.teams[0].baseHp).toBeGreaterThan(0)
    expect(state.teams[1].baseHp).toBeGreaterThan(0)
  })
})

describe('ai', () => {
  it('deploys units and eventually wins from both difficulties', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      let state: GameState = createInitialState({ mode: 'ai', difficulty })
      const random = createRng(11)
      let ticks = 0
      while (state.winner === null && ticks < 36_000) {
        state = step(state, TICK_SECONDS, [], random).state
        ticks += 1
      }
      expect(state.winner, difficulty).not.toBeNull()
      expect(state.units.length).toBeLessThanOrEqual(32)
    }
  })

  it('resolves when both sides play actively', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      let state: GameState = createInitialState({ mode: 'local', difficulty })
      const random = createRng(5)
      let ticks = 0
      while (state.winner === null && ticks < 36_000) {
        const commands = [
          chooseAiCommand(state, random, 0),
          chooseAiCommand(state, random, 1),
        ].filter((command) => command !== null)
        state = step(state, TICK_SECONDS, commands, random).state
        ticks += 1
      }
      expect(state.winner, difficulty).not.toBeNull()
      expect(state.elapsed, difficulty).toBeLessThan(30 * 60)
    }
  })

  it('is deterministic for a fixed seed', () => {
    const simulate = (): GameState => {
      let state: GameState = createInitialState({ mode: 'ai', difficulty: 'normal' })
      const random = createRng(99)
      for (let tick = 0; tick < 2400; tick += 1) {
        state = step(state, TICK_SECONDS, [], random).state
      }
      return state
    }
    const a = simulate()
    const b = simulate()
    expect(a.teams[0].baseHp).toBeCloseTo(b.teams[0].baseHp, 6)
    expect(a.teams[1].baseHp).toBeCloseTo(b.teams[1].baseHp, 6)
    expect(
      a.units.map((entry) => `${entry.team}:${entry.kind}:${entry.lane}:${entry.y.toFixed(4)}`),
    ).toEqual(
      b.units.map((entry) => `${entry.team}:${entry.kind}:${entry.lane}:${entry.y.toFixed(4)}`),
    )
  })
})
