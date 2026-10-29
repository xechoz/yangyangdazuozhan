import type { Rng } from '@mg/core/rng'
import { chooseAiCommand } from './ai'
import {
  AI_TUNING,
  ALLY_SPACING,
  BASE_DAMAGE_SCALE,
  BASE_HP,
  BASE_LINE,
  DEPLOY_COOLDOWN,
  damageMultiplier,
  energyRegen,
  LANE_COUNT,
  MAX_ENERGY,
  MAX_UNITS_PER_TEAM,
  PRESSURE_INTERVAL,
  SPAWN_Y,
  START_ENERGY,
  UNIT_SPECS,
} from './config'
import type {
  Command,
  DeployCommand,
  Difficulty,
  GameConfig,
  GameEvent,
  GameState,
  StepResult,
  Team,
  TeamState,
  UnitState,
} from './types'

type MutableUnit = { -readonly [K in keyof UnitState]: UnitState[K] }
type MutableTeam = { -readonly [K in keyof TeamState]: TeamState[K] }

const DEFAULT_CONFIG: GameConfig = { mode: 'ai', difficulty: 'normal' }

export function createInitialState(config: GameConfig = DEFAULT_CONFIG): GameState {
  return {
    mode: config.mode,
    difficulty: config.difficulty,
    elapsed: 0,
    pressure: 0,
    teams: [createTeam(), createTeam()],
    units: [],
    nextId: 1,
    winner: null,
  }
}

function createTeam(): TeamState {
  return {
    energy: START_ENERGY,
    baseHp: BASE_HP,
    deployTimer: 0,
    aiTimer: 0,
  }
}

export function teamUnitCount(state: GameState, team: Team): number {
  let count = 0
  for (const unit of state.units) {
    if (unit.team === team) count += 1
  }
  return count
}

/** Everything the UI needs to know before highlighting a card. */
export function canDeploy(state: GameState, command: DeployCommand): boolean {
  if (state.winner !== null) return false
  if (command.lane < 0 || command.lane >= LANE_COUNT) return false
  if (!Number.isInteger(command.lane)) return false
  const team = state.teams[command.team]
  if (team.deployTimer > 0) return false
  if (team.energy < UNIT_SPECS[command.kind].cost) return false
  return teamUnitCount(state, command.team) < MAX_UNITS_PER_TEAM
}

function applyDeploy(
  teams: [MutableTeam, MutableTeam],
  units: MutableUnit[],
  command: DeployCommand,
  nextId: number,
): UnitState | null {
  if (command.lane < 0 || command.lane >= LANE_COUNT) return null
  const spec = UNIT_SPECS[command.kind]
  const team = teams[command.team]
  if (team.energy < spec.cost || team.deployTimer > 0) return null
  const count = units.filter((unit) => unit.team === command.team).length
  if (count >= MAX_UNITS_PER_TEAM) return null

  team.energy -= spec.cost
  team.deployTimer = DEPLOY_COOLDOWN
  const unit: UnitState = {
    id: nextId,
    team: command.team,
    kind: command.kind,
    lane: command.lane,
    y: command.team === 0 ? SPAWN_Y : 1 - SPAWN_Y,
    hp: spec.maxHp,
    cooldown: 0,
  }
  units.push(unit)
  return unit
}

/**
 * Advances the simulation by one fixed step. Player commands are queued by the
 * scene and applied first so input never waits for the next AI decision.
 */
export function step(
  state: GameState,
  dt: number,
  commands: readonly Command[],
  rng: Rng,
): StepResult {
  if (state.winner !== null) return { state, events: [] }

  const events: GameEvent[] = []
  const elapsed = state.elapsed + dt
  const pressure = Math.floor(elapsed / PRESSURE_INTERVAL)
  if (pressure > state.pressure) {
    events.push({ type: 'pressure', tier: pressure })
  }

  const teams: [MutableTeam, MutableTeam] = [{ ...state.teams[0] }, { ...state.teams[1] }]
  const units: MutableUnit[] = state.units.map((unit) => ({ ...unit }))
  let nextId = state.nextId

  for (const team of teams) {
    team.energy = Math.min(MAX_ENERGY, team.energy + energyRegen(pressure, team.baseHp) * dt)
    team.deployTimer = Math.max(0, team.deployTimer - dt)
    team.aiTimer = Math.max(0, team.aiTimer - dt)
  }

  const snapshot: GameState = {
    ...state,
    elapsed,
    pressure,
    teams,
    units,
    nextId,
  }

  for (const command of commands) {
    if (!canDeploy(snapshot, command)) continue
    const unit = applyDeploy(teams, units, command, nextId)
    if (unit === null) continue
    nextId += 1
    events.push({ type: 'deploy', team: command.team, unit })
  }

  if (state.mode === 'ai' && teams[1].aiTimer === 0) {
    const command = chooseAiCommand(snapshot, rng)
    teams[1].aiTimer = aiDelay(snapshot.difficulty, rng)
    if (command !== null && canDeploy(snapshot, command)) {
      const unit = applyDeploy(teams, units, command, nextId)
      if (unit !== null) {
        nextId += 1
        events.push({ type: 'deploy', team: 1, unit })
      }
    }
  }

  resolveUnits(units, teams, damageMultiplier(pressure), dt, events)

  const alive = units.filter((unit) => unit.hp > 0)
  let winner: Team | null = null
  if (teams[0].baseHp <= 0 || teams[1].baseHp <= 0) {
    winner = teams[0].baseHp >= teams[1].baseHp ? 0 : 1
    teams[0].baseHp = Math.max(0, teams[0].baseHp)
    teams[1].baseHp = Math.max(0, teams[1].baseHp)
    events.push({ type: 'won', winner })
  }

  return {
    state: {
      mode: state.mode,
      difficulty: state.difficulty,
      elapsed,
      pressure,
      teams,
      units: alive,
      nextId,
      winner,
    },
    events,
  }
}

function aiDelay(difficulty: Difficulty, rng: Rng): number {
  return AI_TUNING[difficulty].interval * (0.88 + rng.next() * 0.24)
}

function resolveUnits(
  units: MutableUnit[],
  teams: [MutableTeam, MutableTeam],
  damageScale: number,
  dt: number,
  events: GameEvent[],
): void {
  for (const unit of units) {
    if (unit.hp <= 0) continue
    const spec = UNIT_SPECS[unit.kind]
    unit.cooldown = Math.max(0, unit.cooldown - dt)

    if (unit.kind === 'healer') {
      const patient = nearestInjuredAlly(units, unit)
      if (patient !== null) {
        if (unit.cooldown === 0) {
          const amount = Math.min(spec.heal, patient.hp === 0 ? 0 : spec.maxHp - patient.hp)
          patient.hp += amount
          unit.cooldown = spec.attackInterval
          events.push({
            type: 'heal',
            healerId: unit.id,
            targetId: patient.id,
            team: unit.team,
            lane: unit.lane,
            y: unit.y,
            amount,
          })
        }
        continue
      }
      advance(unit, units, spec.speed, dt)
      continue
    }

    const target = nearestEnemy(units, unit)
    if (target !== null && Math.abs(target.y - unit.y) <= spec.range + 1e-9) {
      if (unit.cooldown === 0) {
        const damage = spec.damage * damageScale
        target.hp -= damage
        unit.cooldown = spec.attackInterval
        const lethal = target.hp <= 0
        events.push({
          type: 'hit',
          attackerId: unit.id,
          targetId: target.id,
          team: unit.team,
          lane: unit.lane,
          y: target.y,
          damage,
          lethal,
        })
        if (lethal) {
          events.push({ type: 'unitDied', unit: target })
        }
      }
      continue
    }

    if (atEnemyBase(unit)) {
      if (unit.cooldown === 0) {
        const defender = (1 - unit.team) as Team
        const damage = spec.damage * damageScale * BASE_DAMAGE_SCALE
        teams[defender].baseHp = Math.max(0, teams[defender].baseHp - damage)
        unit.cooldown = spec.attackInterval
        events.push({
          type: 'baseHit',
          team: defender,
          lane: unit.lane,
          damage,
          baseHp: teams[defender].baseHp,
        })
      }
      continue
    }

    advance(unit, units, spec.speed, dt)
  }
}

function nearestEnemy(units: readonly MutableUnit[], unit: MutableUnit): MutableUnit | null {
  let best: MutableUnit | null = null
  let distance = Number.POSITIVE_INFINITY
  for (const other of units) {
    if (other.hp <= 0 || other.team === unit.team || other.lane !== unit.lane) continue
    const next = Math.abs(other.y - unit.y)
    if (next < distance) {
      distance = next
      best = other
    }
  }
  return best
}

function nearestInjuredAlly(
  units: readonly MutableUnit[],
  healer: MutableUnit,
): MutableUnit | null {
  let best: MutableUnit | null = null
  let ratio = 1
  for (const other of units) {
    if (other.hp <= 0 || other.team !== healer.team || other.lane !== healer.lane) continue
    if (other.id === healer.id) continue
    const spec = UNIT_SPECS[other.kind]
    const next = other.hp / spec.maxHp
    if (next < 1 && Math.abs(other.y - healer.y) <= UNIT_SPECS.healer.range && next < ratio) {
      ratio = next
      best = other
    }
  }
  return best
}

function atEnemyBase(unit: MutableUnit): boolean {
  return unit.team === 0 ? unit.y >= BASE_LINE - 1e-9 : unit.y <= 1 - BASE_LINE + 1e-9
}

function advance(
  unit: MutableUnit,
  units: readonly MutableUnit[],
  speed: number,
  dt: number,
): void {
  const direction = unit.team === 0 ? 1 : -1
  let nextY = unit.y + direction * speed * dt
  nextY = direction > 0 ? Math.min(nextY, BASE_LINE) : Math.max(nextY, 1 - BASE_LINE)
  if (blockedByAlly(unit, units, direction)) return
  unit.y = nextY
}

function blockedByAlly(
  unit: MutableUnit,
  units: readonly MutableUnit[],
  direction: number,
): boolean {
  for (const other of units) {
    if (other.hp <= 0 || other.id === unit.id) continue
    if (other.team !== unit.team || other.lane !== unit.lane) continue
    const gap = (other.y - unit.y) * direction
    if (gap > 0 && gap < ALLY_SPACING) return true
  }
  return false
}

/** Time in seconds until a team's next deployment, capped for UI display. */
export function deployReadyIn(state: GameState, team: Team): number {
  return Math.max(0, state.teams[team].deployTimer)
}
