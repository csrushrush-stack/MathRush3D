export type SkinRarity = 'Starter' | 'Common' | 'Rare' | 'Epic' | 'Legendary'

export interface SkinDefinition {
  id: string
  name: string
  primary: string
  secondary: string
  accent: string
  head: string
  glow: string
  price: number
  rarity: SkinRarity
}

export const SKINS: readonly SkinDefinition[] = [
  { id: 'default', name: 'Rush', primary: '#8b5cf6', secondary: '#4f46e5', accent: '#c4b5fd', head: '#f5d0fe', glow: '#a78bfa', price: 0, rarity: 'Starter' },
  { id: 'ocean', name: 'Tidal', primary: '#0ea5e9', secondary: '#0369a1', accent: '#67e8f9', head: '#bae6fd', glow: '#22d3ee', price: 500, rarity: 'Common' },
  { id: 'forest', name: 'Ranger', primary: '#22c55e', secondary: '#166534', accent: '#bbf7d0', head: '#fde68a', glow: '#4ade80', price: 800, rarity: 'Common' },
  { id: 'flame', name: 'Inferno', primary: '#ef4444', secondary: '#9a3412', accent: '#fbbf24', head: '#fed7aa', glow: '#f97316', price: 1000, rarity: 'Rare' },
  { id: 'night', name: 'Phantom', primary: '#312e81', secondary: '#111827', accent: '#a78bfa', head: '#c4b5fd', glow: '#7c3aed', price: 1500, rarity: 'Rare' },
  { id: 'gold', name: 'Champion', primary: '#f59e0b', secondary: '#92400e', accent: '#fef3c7', head: '#fde68a', glow: '#fbbf24', price: 2000, rarity: 'Epic' },
  { id: 'cyber', name: 'Neon Byte', primary: '#22d3ee', secondary: '#d946ef', accent: '#f8fafc', head: '#c4b5fd', glow: '#06b6d4', price: 2600, rarity: 'Epic' },
  { id: 'frost', name: 'Frost King', primary: '#38bdf8', secondary: '#e0f2fe', accent: '#ffffff', head: '#dbeafe', glow: '#7dd3fc', price: 3200, rarity: 'Epic' },
  { id: 'toxic', name: 'Toxic Nova', primary: '#84cc16', secondary: '#18181b', accent: '#d9f99d', head: '#a3e635', glow: '#bef264', price: 3800, rarity: 'Legendary' },
  { id: 'royal', name: 'Royal Rush', primary: '#f59e0b', secondary: '#7c3aed', accent: '#fff7d6', head: '#fde68a', glow: '#fbbf24', price: 5000, rarity: 'Legendary' },
]

export function getSkinDefinition(id: string) {
  return SKINS.find((skin) => skin.id === id) ?? SKINS[0]
}
