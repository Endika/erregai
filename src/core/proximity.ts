export interface ProximityItem { id: string; distanceKm: number }

// Alert-once dedup with hysteresis, shared by radar and fuel proximity alerts.
// An id alerts the first time it enters `alertDistanceKm`; it is forgotten once
// it drifts beyond `alertDistanceKm + hysteresisKm` (or disappears), enabling a
// fresh alert on a later approach.
export function nextProximityAlerts<T extends ProximityItem>(
  prevAlertedIds: ReadonlySet<string>,
  items: readonly T[],
  alertDistanceKm: number,
  hysteresisKm = 0.2,
): { alertedIds: Set<string>; newlyAlerted: T[] } {
  const alertedIds = new Set(prevAlertedIds)
  const byId = new Map(items.map(i => [i.id, i]))
  for (const id of prevAlertedIds) {
    const item = byId.get(id)
    if (!item || item.distanceKm > alertDistanceKm + hysteresisKm) alertedIds.delete(id)
  }
  const newlyAlerted: T[] = []
  for (const item of items) {
    if (item.distanceKm <= alertDistanceKm && !alertedIds.has(item.id)) {
      alertedIds.add(item.id)
      newlyAlerted.push(item)
    }
  }
  return { alertedIds, newlyAlerted }
}
