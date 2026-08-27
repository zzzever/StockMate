import type { SubIndicator } from './types';

const registry = new Map<string, SubIndicator>();

export function registerIndicator(indicator: SubIndicator): void {
  registry.set(indicator.id, indicator);
}

export function getIndicator(id: string): SubIndicator | undefined {
  return registry.get(id);
}

export function getAllIndicators(): SubIndicator[] {
  return Array.from(registry.values());
}

export function getIndicatorIds(): string[] {
  return Array.from(registry.keys());
}

export function getIndicatorsByCategory(cat: SubIndicator['category']): SubIndicator[] {
  return getAllIndicators().filter(i => i.category === cat);
}
