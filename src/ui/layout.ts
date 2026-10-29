import type { Insets } from '@mg/core'
import { LANE_COUNT } from '../logic/config'

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface BattleLayout {
  readonly width: number
  readonly height: number
  readonly portrait: boolean
  readonly board: Rect
  readonly laneWidth: number
  readonly railHeight: number
  readonly card: { readonly width: number; readonly height: number; readonly gap: number }
  readonly pause: { readonly x: number; readonly y: number; readonly size: number }
  readonly timer: { readonly x: number; readonly y: number }
  readonly hint: { readonly x: number; readonly y: number }
  readonly rail0Y: number
  readonly rail1Y: number
}

const ZERO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

export function computeBattleLayout(
  width: number,
  height: number,
  insets: Insets = ZERO_INSETS,
): BattleLayout {
  const contentTop = insets.top
  const contentBottom = height - insets.bottom
  const contentHeight = Math.max(1, contentBottom - contentTop)
  const safeWidth = width - insets.left - insets.right
  const railHeight = clamp(contentHeight * 0.21, 96, 240)
  const boardHeight = contentHeight - railHeight * 2
  const portrait = height >= width
  const boardWidth = clamp(
    Math.min(safeWidth - 88, boardHeight * (portrait ? 0.82 : 1.15)),
    240,
    700,
  )
  const board: Rect = {
    x: insets.left + (safeWidth - boardWidth) / 2,
    y: contentTop + railHeight,
    width: boardWidth,
    height: boardHeight,
  }
  const cardWidth = clamp(width * 0.18, 64, 132)
  const cardHeight = clamp(railHeight * 0.62, 64, 150)

  return {
    width,
    height,
    portrait,
    board,
    laneWidth: boardWidth / LANE_COUNT,
    railHeight,
    card: { width: cardWidth, height: cardHeight, gap: clamp(width * 0.012, 4, 12) },
    pause: { x: Math.max(24, board.x - 32), y: board.y + 26, size: 44 },
    timer: { x: board.x + board.width / 2, y: board.y + 26 },
    hint: { x: board.x + board.width / 2, y: board.y + board.height * 0.66 },
    rail0Y: contentBottom - railHeight / 2,
    rail1Y: contentTop + railHeight / 2,
  }
}

/** Screen X for a lane centre. */
export function laneCenterX(layout: BattleLayout, lane: number): number {
  return layout.board.x + layout.laneWidth * (lane + 0.5)
}

/** Screen Y for a normalized field position (0 = blue base, 1 = red base). */
export function fieldY(layout: BattleLayout, y: number): number {
  return layout.board.y + layout.board.height * (1 - y)
}

export function laneAtX(layout: BattleLayout, x: number): number | null {
  const local = x - layout.board.x
  if (local < 0 || local >= layout.board.width) return null
  return clamp(Math.floor(local / layout.laneWidth), 0, LANE_COUNT - 1)
}

/** Team that owns the half of the board under the pointer. */
export function halfAtY(layout: BattleLayout, y: number): 0 | 1 | null {
  if (y < layout.board.y || y > layout.board.y + layout.board.height) return null
  const field = 1 - (y - layout.board.y) / layout.board.height
  return field < 0.5 ? 0 : 1
}
