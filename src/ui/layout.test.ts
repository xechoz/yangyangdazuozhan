import { describe, expect, it } from 'vitest'
import { computeBattleLayout, fieldY, halfAtY, laneAtX, laneCenterX } from './layout'

describe('battle layout', () => {
  it('fits the board between the two HUD rails in portrait', () => {
    const layout = computeBattleLayout(720, 1280)
    expect(layout.board.width).toBeLessThanOrEqual(720)
    expect(layout.board.height).toBeGreaterThan(layout.board.width)
    expect(layout.board.y).toBeGreaterThanOrEqual(layout.railHeight)
    expect(layout.board.y + layout.board.height).toBeLessThanOrEqual(1280 - layout.railHeight + 1)
    expect(layout.laneWidth).toBeGreaterThan(40)
  })

  it('stays playable in landscape without rotating the game', () => {
    const layout = computeBattleLayout(1280, 720)
    expect(layout.portrait).toBe(false)
    expect(layout.board.height).toBeGreaterThan(300)
    expect(layout.board.width).toBeLessThanOrEqual(1280)
    expect(layout.laneWidth).toBeGreaterThan(30)
  })

  it('maps lanes and field halves consistently', () => {
    const layout = computeBattleLayout(720, 1280)
    const lane = 3
    expect(laneAtX(layout, laneCenterX(layout, lane))).toBe(lane)
    expect(fieldY(layout, 0)).toBeGreaterThan(fieldY(layout, 1))
    expect(halfAtY(layout, layout.board.y + layout.board.height * 0.9)).toBe(0)
    expect(halfAtY(layout, layout.board.y + layout.board.height * 0.1)).toBe(1)
    expect(halfAtY(layout, 0)).toBeNull()
  })
})
