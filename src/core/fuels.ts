export type FuelId =
  | 'gasoleoA' | 'gasoleoPremium' | 'gasoleoB'
  | 'gasolina95' | 'gasolina98' | 'glp' | 'gnc' | 'gnl'

export interface Fuel { id: FuelId; apiKey: string; i18nKey: string }

export const FUELS: readonly Fuel[] = [
  { id: 'gasoleoA', apiKey: 'Precio Gasoleo A', i18nKey: 'fuel.gasoleoA' },
  { id: 'gasoleoPremium', apiKey: 'Precio Gasoleo Premium', i18nKey: 'fuel.gasoleoPremium' },
  { id: 'gasoleoB', apiKey: 'Precio Gasoleo B', i18nKey: 'fuel.gasoleoB' },
  { id: 'gasolina95', apiKey: 'Precio Gasolina 95 E5', i18nKey: 'fuel.gasolina95' },
  { id: 'gasolina98', apiKey: 'Precio Gasolina 98 E5', i18nKey: 'fuel.gasolina98' },
  { id: 'glp', apiKey: 'Precio Gases licuados del petróleo', i18nKey: 'fuel.glp' },
  { id: 'gnc', apiKey: 'Precio Gas Natural Comprimido', i18nKey: 'fuel.gnc' },
  { id: 'gnl', apiKey: 'Precio Gas Natural Licuado', i18nKey: 'fuel.gnl' },
] as const

export const DEFAULT_FUEL: FuelId = 'gasoleoA'
