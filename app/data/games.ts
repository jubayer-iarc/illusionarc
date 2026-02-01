import { PLACEHOLDER_IMG } from '@/utils/media'

export type GameBuildType = 'html' | 'webgl' | 'iframe'

export type ArcadeGame = {
  name: string
  slug: string
  thumbnail: string
  shortPitch: string
  description?: string
  controls: string[]
  buildType: GameBuildType
  sourceUrl: string
  embedAllowed: boolean
  embed: {
    aspectRatio?: string
    minHeight?: number
    orientation?: 'any' | 'portrait' | 'landscape'
  }
  leaderboard: boolean
  rating?: { value: number; count: number }
  genre?: 'Arcade' | 'Puzzle' | 'Runner' | 'Shooter' | 'Casual'
  difficulty?: 'Easy' | 'Medium' | 'Hard'
  featured?: boolean
  estTime?: string
}

export const GAMES: ArcadeGame[] = [
  {
    name: 'Boss Rush',
    slug: 'boss-rush',
    thumbnail: '/img/boss-rush/boss-rush-thumbnail.png',
    shortPitch: 'Neon reflex boss fights. Tap fast, survive longer, post score.',
    description:
      'Face fast-paced neon bosses with simple tap controls. Survive longer to increase score, dodge patterns, and climb the global leaderboard. Best experienced in landscape on mobile.',
    controls: ['Tap / click to dodge', 'Survive as long as possible'],
    buildType: 'iframe',
    sourceUrl: '/games/boss-rush/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'landscape' },
    leaderboard: true,
    rating: { value: 4.6, count: 1280 },
    featured: false,
    genre: 'Shooter',
    difficulty: 'Medium',
    estTime: '60s'
  },
  {
    name: 'Blink Maze',
    slug: 'blink-maze',
    thumbnail: '/img/blink-maze/blink-maze-thumbnail.jpeg',
    shortPitch: 'Neon reflex boss fights. Tap fast, survive longer, post score.',
    description:
      'Face fast-paced neon bosses with simple tap controls. Survive longer to increase score, dodge patterns, and climb the global leaderboard. Best experienced in landscape on mobile.',
    controls: ['Tap to blink', 'Navigate the maze quickly'],
    buildType: 'iframe',
    sourceUrl: '/games/blink-maze/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'landscape' },
    leaderboard: true,
    rating: { value: 3.6, count: 55 },
    featured: false,
    genre: 'Puzzle',
    difficulty: 'Medium',
    estTime: '60s'
  },
  {
    name: 'Neon Polarity',
    slug: 'neon-polarity',
    thumbnail: '/img/neon-polarity/neon-polarity-thumbnail-2.png',
    shortPitch: 'Neon reflex boss fights. Tap fast, survive longer, post score.',
    description:
      'Face fast-paced neon bosses with simple tap controls. Survive longer to increase score, dodge patterns, and climb the global leaderboard. Best experienced in landscape on mobile.',
    controls: ['W / A / S / D or Arrow Keys — Move', 'Space — Fire', 'Q — Pull (Attract objects & energy)', 'E — Push (Repel enemies & hazards)', 'R — Reload'],
    buildType: 'iframe',
    sourceUrl: '/games/neon-polarity/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'landscape' },
    leaderboard: true,
    rating: { value: 4.4, count: 1050 },
    featured: false,
    genre: 'Shooter',
    difficulty: 'Medium',
    estTime: '60s'
  },
  {
    name: 'Block Smash',
    slug: 'block-smash',
    thumbnail: '/img/block-smash/block-smash-thumbnail.jpg',
    shortPitch: 'Neon reflex boss fights. Tap fast, survive longer, post score.',
    description:
      'Face fast-paced neon bosses with simple tap controls. Survive longer to increase score, dodge patterns, and climb the global leaderboard. Best experienced in landscape on mobile.',
    controls: ['Tap / click to dodge', 'Survive as long as possible'],
    buildType: 'iframe',
    sourceUrl: '/games/block-smash/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'portrait' },
    leaderboard: true,
    rating: { value: 4.5, count: 1050 },
    featured: false,
    genre: 'Puzzle',
    difficulty: 'Medium',
    estTime: '60s'
  }
]
