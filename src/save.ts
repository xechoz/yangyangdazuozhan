import type { GameServices } from '@mg/core'
import type { Team } from './logic/types'

export interface AiRecord {
  readonly wins: number
  readonly losses: number
  readonly bestSeconds: number | null
}

export interface Profile {
  readonly ai: AiRecord
  readonly localMatches: number
}

export const PROFILE_VERSION = 1

export function initialProfile(): Profile {
  return { ai: { wins: 0, losses: 0, bestSeconds: null }, localMatches: 0 }
}

export function profileSave(services: GameServices) {
  return services.createSave<Profile>({
    name: 'profile',
    version: PROFILE_VERSION,
    initial: initialProfile,
    migrate: () => initialProfile(),
  })
}

export function recordAiResult(services: GameServices, won: boolean, seconds: number): Profile {
  return profileSave(services).update((current) => {
    const wins = current.ai.wins + (won ? 1 : 0)
    const losses = current.ai.losses + (won ? 0 : 1)
    const best =
      won && (current.ai.bestSeconds === null || seconds < current.ai.bestSeconds)
        ? seconds
        : current.ai.bestSeconds
    return { ...current, ai: { wins, losses, bestSeconds: best } }
  })
}

export function recordLocalMatch(services: GameServices, _winner: Team): Profile {
  return profileSave(services).update((current) => ({
    ...current,
    localMatches: current.localMatches + 1,
  }))
}
