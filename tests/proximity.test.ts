import { nextProximityAlerts } from '../src/core/proximity'

const item = (id: string, km: number): { id: string; distanceKm: number } => ({ id, distanceKm: km })

describe('nextProximityAlerts', () => {
  it('alerts once when an item enters the alert distance', () => {
    const res = nextProximityAlerts(new Set(), [item('x', 0.5)], 0.8)
    expect(res.newlyAlerted.map(i => i.id)).toEqual(['x'])
    expect(res.alertedIds.has('x')).toBe(true)
  })

  it('does not re-alert while still within range', () => {
    const res = nextProximityAlerts(new Set(['x']), [item('x', 0.4)], 0.8)
    expect(res.newlyAlerted).toHaveLength(0)
    expect(res.alertedIds.has('x')).toBe(true)
  })

  it('forgets the id after leaving range + hysteresis, enabling re-alert', () => {
    const res = nextProximityAlerts(new Set(['x']), [item('x', 1.1)], 0.8, 0.2)
    expect(res.alertedIds.has('x')).toBe(false)
  })

  it('does not alert for items beyond the alert distance', () => {
    const res = nextProximityAlerts(new Set(), [item('x', 2.0)], 0.8)
    expect(res.newlyAlerted).toHaveLength(0)
  })
})
