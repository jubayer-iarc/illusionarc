export const AD_SLOTS = [
  { key: 'home_top', label: 'Home — Top Banner' },
  { key: 'home_mid', label: 'Home — Middle Banner' },
  { key: 'home_bottom', label: 'Home — Bottom Banner' },
  { key: 'tournaments_top', label: 'Tournaments — Top Banner' },
  { key: 'arcade_sidebar', label: 'Arcade — Top Banner' }
] as const

export type AdSlotKey = typeof AD_SLOTS[number]['key']
