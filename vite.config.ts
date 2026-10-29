import { defineConfig } from 'vite'
import { gameConfig } from './platform/tooling/vite.game.ts'

export default defineConfig(gameConfig({ port: 5175 }))
