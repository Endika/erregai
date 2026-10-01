import { aheadOffset } from '../src/ui/map-ahead'

const SIZE = { x: 400, y: 300 }
const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6)
  expect(a.y).toBeCloseTo(b.y, 6)
}

describe('aheadOffset', () => {
  it('moves the centre up by 30% of the height when heading north', () => {
    close(aheadOffset(0, SIZE), { x: 0, y: -90 })
  })

  it('moves it down when heading south and sideways when heading east or west', () => {
    close(aheadOffset(180, SIZE), { x: 0, y: 90 })
    close(aheadOffset(90, SIZE), { x: 120, y: 0 })
    close(aheadOffset(270, SIZE), { x: -120, y: 0 })
  })

  it('splits a diagonal heading across both axes', () => {
    const s = Math.SQRT1_2
    close(aheadOffset(45, SIZE), { x: 120 * s, y: -90 * s })
  })

  it('takes the fraction as an option', () => {
    close(aheadOffset(0, SIZE, 0.5), { x: 0, y: -150 })
  })
})
