import type { Rng } from '@mg/core/rng'
import { AI_TUNING, LANE_COUNT, MAX_UNITS_PER_TEAM, UNIT_ORDER, UNIT_SPECS } from './config'
import type { DeployCommand, GameState, Team, UnitKind, UnitState } from './types'

/**
 * One AI decision. The caller owns the decision cadence; this function only
 * reads the state and returns the command it would like to issue.
 */
export function chooseAiCommand(state: GameState, rng: Rng, side: Team = 1): DeployCommand | null {
  if (state.winner !== null) return null
  const tuning = AI_TUNING[state.difficulty]
  const team = state.teams[side]
  const mine = state.units.filter((unit) => unit.team === side)
  if (mine.length >= MAX_UNITS_PER_TEAM) return null

  const affordable = UNIT_ORDER.filter((kind) => UNIT_SPECS[kind].cost <= team.energy)
  if (affordable.length === 0) return null

  const foes = state.units.filter((unit) => unit.team !== side)
  const urgent = foes.some((unit) => unit.y > 0.68)

  if (!urgent && team.energy < tuning.reserve + 2) return null

  if (rng.next() < tuning.slip) {
    return { type: 'deploy', team: side, kind: rng.pick(affordable), lane: rng.int(LANE_COUNT) }
  }

  const threat = laneThreat(foes)
  const pressureLane = bestLane(threat)
  if (urgent && pressureLane !== null) {
    const kind = counterKind(affordable, mine, foes, pressureLane, team.energy)
    if (kind !== null) {
      return { type: 'deploy', team: side, kind, lane: pressureLane }
    }
  }

  const hurt = mine.filter((unit) => unit.hp < UNIT_SPECS[unit.kind].maxHp * 0.75)
  if (hurt.length >= 2 && affordable.includes('healer')) {
    const lane = mostCrowdedLane(mine)
    return { type: 'deploy', team: side, kind: 'healer', lane }
  }

  if (team.energy >= 14 && affordable.includes('ram') && rng.next() < 0.75) {
    return { type: 'deploy', team: side, kind: 'ram', lane: pushLane(mine, foes) }
  }

  const preferred: UnitKind[] = ['archer', 'ram', 'shield', 'healer']
  const kind = preferred.find((candidate) => affordable.includes(candidate)) ?? affordable[0]
  return { type: 'deploy', team: side, kind, lane: pushLane(mine, foes) }
}

function laneThreat(foes: readonly UnitState[]) {
  const threat = Array.from({ length: LANE_COUNT }, () => 0)
  for (const foe of foes) {
    const spec = UNIT_SPECS[foe.kind]
    // Foes closer to the AI base (y near 1) are more dangerous.
    threat[foe.lane] += (foe.hp / spec.maxHp) * (0.35 + foe.y)
  }
  return threat
}

function bestLane(threat: readonly number[]): number | null {
  let best = 0
  let value = threat[0] ?? 0
  for (let lane = 1; lane < threat.length; lane += 1) {
    const next = threat[lane] ?? 0
    if (next > value) {
      best = lane
      value = next
    }
  }
  return value > 0.15 ? best : null
}

function counterKind(
  affordable: readonly UnitKind[],
  mine: readonly UnitState[],
  foes: readonly UnitState[],
  lane: number,
  energy: number,
): UnitKind | null {
  const laneFoes = foes.filter((unit) => unit.lane === lane)
  const laneMine = mine.filter((unit) => unit.lane === lane)
  const hasShield = laneMine.some((unit) => unit.kind === 'shield')
  const enemyArcher = laneFoes.some((unit) => unit.kind === 'archer')

  if (enemyArcher && affordable.includes('ram') && energy >= 10) return 'ram'
  if (!hasShield && affordable.includes('shield')) return 'shield'
  if (affordable.includes('archer')) return 'archer'
  return affordable[0] ?? null
}

function mostCrowdedLane(mine: readonly UnitState[]): number {
  const counts = Array.from({ length: LANE_COUNT }, () => 0)
  for (const unit of mine) counts[unit.lane] += 1
  let best = 0
  for (let lane = 1; lane < counts.length; lane += 1) {
    if (counts[lane] > counts[best]) best = lane
  }
  return best
}

function pushLane(mine: readonly UnitState[], foes: readonly UnitState[]): number {
  const score = Array.from({ length: LANE_COUNT }, () => 0)
  for (const unit of mine) score[unit.lane] += 1.2
  for (const unit of foes) score[unit.lane] -= 1 + unit.hp / UNIT_SPECS[unit.kind].maxHp
  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    // Spread deployments so a single lane never becomes a traffic jam.
    if ((score[lane] ?? 0) > 2) score[lane] -= 1.5
  }
  let best = 0
  for (let lane = 1; lane < LANE_COUNT; lane += 1) {
    if ((score[lane] ?? 0) > (score[best] ?? 0)) best = lane
  }
  return best
}
