import { readableAddress, readableSchedule } from '../src/core/address'

describe('readableAddress', () => {
  it.each([
    ['POLIGONO GRANADA, S/N', 'Poligono Granada, S/N'],
    ['AVENIDA DE LA LIBERTAD, 15', 'Avenida de la Libertad, 15'],
    ['CALLE MARQUES DE LA CADENA, 68', 'Calle Marques de la Cadena, 68'],
    ['CARRETERA N-634 KM. 112', 'Carretera N-634 km. 112'],
    ['CR GI-632, 1', 'Cr GI-632, 1'],
    ['BARRIO ARTEAGA BI-30, S/N', 'Barrio Arteaga BI-30, S/N'],
    ['CARRETERA E-5/A-4 KM. 262', 'Carretera E-5/A-4 km. 262'],
    ['CARRETERA N-II KM. 674,2', 'Carretera N-II km. 674,2'],
    ['CARLOS V (INGENIO KM 1)', 'Carlos V (Ingenio km 1)'],
    ['POLIGONO SECTOR III, PARCELA 4', 'Poligono Sector III, Parcela 4'],
    ['CTRA. SEVILLA-HUELVA KM 626', 'Ctra. Sevilla-Huelva km 626'],
    [
      'CARRETERA ALCORCON-S.M.VALDEIGLESIAS KM. 1,5',
      'Carretera Alcorcon-S.M.Valdeiglesias km. 1,5',
    ],
    [
      'CARRETERA CADIZ MALAGA (C.C. EROSKI) KM. 106,25',
      'Carretera Cadiz Malaga (C.C. Eroski) km. 106,25',
    ],
    ['AVENIDA PADRE CLARET (DEL), 8', 'Avenida Padre Claret (del), 8'],
    ['CARRETERA N-240, KM:6,05', 'Carretera N-240, km:6,05'],
    ['KALEA ZUBIETA ETORBIDEA, 2', 'Kalea Zubieta Etorbidea, 2'],
    ["AVINGUDA DE L'HOSPITALET, 3", "Avinguda de l'Hospitalet, 3"],
    ["L'HOSPITALET DE LLOBREGAT", "L'Hospitalet de Llobregat"],
    ['RUA DO SOL, 4', 'Rua do Sol, 4'],
    ['CALLE ÑANDU Y ÁLAMO, 1', 'Calle Ñandu y Álamo, 1'],
    ['CARRETERA A7 KM. 406', 'Carretera A7 km. 406'],
    ['LOS LLANOS, CALLE MAYOR', 'Los Llanos, Calle Mayor'],
    ['AVENIDA GESTO POR LA PAZ, 7', 'Avenida Gesto por la Paz, 7'],
    ['AUTOVIA AP - 7 KM. 70,5', 'Autovia AP - 7 km. 70,5'],
    ['AUTOVIA VALENCIA/ ALCOY CV 40 KM. 14', 'Autovia Valencia/ Alcoy CV 40 km. 14'],
    ['CL 5 DE MAYO, 2', 'Cl 5 de Mayo, 2'],
    ['ZIOBI,6. POL. INDUSTRIAL ALKAIAGA', 'Ziobi,6. Pol. Industrial Alkaiaga'],
  ])('%s → %s', (raw, readable) => {
    expect(readableAddress(raw)).toBe(readable)
  })

  // Some stations publish their own casing; a word already in mixed case is theirs.
  it('leaves words the source already cased alone', () => {
    expect(readableAddress('CARRER Ignasi Buxó i Gou, 11')).toBe('Carrer Ignasi Buxó i Gou, 11')
    expect(readableAddress('N-432 km 314,8')).toBe('N-432 km 314,8')
  })

  it('keeps the spacing the source had', () => {
    expect(readableAddress('CL RONDA SANTA MARIA ,202-210 (ESQ.')).toBe(
      'Cl Ronda Santa Maria ,202-210 (Esq.',
    )
    expect(readableAddress('')).toBe('')
  })
})

describe('readableSchedule', () => {
  it('spells a full day as hours, not a capital H', () => {
    expect(readableSchedule('L-D: 24H')).toBe('L-D: 24 h')
    expect(readableSchedule('L: 24H')).toBe('L: 24 h')
  })

  it('leaves opening times as published', () => {
    expect(readableSchedule('L-V: 06:00-22:00; S-D: 07:00-22:00')).toBe(
      'L-V: 06:00-22:00; S-D: 07:00-22:00',
    )
  })
})
