import type { LatLon } from '../core/geo'

export function watchPosition(cb: (p: LatLon) => void, onErr: (e: unknown) => void): () => void {
  const id = navigator.geolocation.watchPosition(
    p => cb({ lat: p.coords.latitude, lon: p.coords.longitude }),
    e => onErr(e), { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 })
  return () => navigator.geolocation.clearWatch(id)
}

export function getOnce(): Promise<LatLon> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }), reject,
      { enableHighAccuracy: true, timeout: 15000 }))
}
