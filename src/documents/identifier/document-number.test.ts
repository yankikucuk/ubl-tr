import { describe, expect, it } from 'vitest'

import { InvalidDocumentNumberError } from '../errors.js'

import {
  assertValidDocumentNumber,
  isValidDocumentNumber,
  parseDocumentNumber,
} from './document-number.js'

describe('belge numarası ayrıştırma', () => {
  it('parçalarına ayırır', () => {
    expect(parseDocumentNumber('ABC2026000000001')).toEqual({
      prefix: 'ABC',
      year: 2026,
      sequence: '000000001',
    })
  })

  it('sıra numarasının baştaki sıfırlarını korur', () => {
    // Sıra numarası bir sayı değil, dokuz haneli bir dizedir. Sayıya
    // çevirmek `000000001` ile `1` arasındaki farkı yok eder ve belge
    // numarası yeniden kurulamaz hâle gelir.
    const parcalar = parseDocumentNumber('ABC2026000000042')
    expect(parcalar?.sequence).toBe('000000042')
  })

  it('biçim bozuksa undefined döner', () => {
    expect(parseDocumentNumber('OUT')).toBeUndefined()
    expect(parseDocumentNumber('ABC202600000000')).toBeUndefined()
    expect(parseDocumentNumber('abc2026000000001')).toBeUndefined()
  })
})

describe('seri kodu kuralları', () => {
  it('rakam içeren seriyi reddeder', () => {
    // REGRESYON — en yaygın rakip `[A-Z0-9]{3}` deseni kullanıyor ve `123`
    // gibi bir seriyi geçerli sayıyor. GİB seri kodunda rakama izin vermez.
    expect(isValidDocumentNumber('1232026000000001')).toBe(false)
    expect(isValidDocumentNumber('A1B2026000000001')).toBe(false)
  })

  it('Türkçeye özgü harf içeren seriyi reddeder', () => {
    // Ç, Ğ, İ, Ö, Ş, Ü seri kodunda kullanılamaz.
    for (const seri of ['ÇAB', 'AĞB', 'İAB', 'AÖB', 'AŞB', 'AÜB']) {
      expect(isValidDocumentNumber(`${seri}2026000000001`)).toBe(false)
    }
  })

  it('küçük harfi reddeder', () => {
    expect(isValidDocumentNumber('abc2026000000001')).toBe(false)
  })
})

describe('doğrulama hatası', () => {
  const hataAl = (value: string, issueDate?: string): InvalidDocumentNumberError => {
    try {
      assertValidDocumentNumber(value, 'cbc:ID', issueDate === undefined ? {} : { issueDate })
    } catch (error) {
      return error as InvalidDocumentNumberError
    }
    throw new Error('hata beklendi')
  }

  it('Odoo e-İrsaliye hatasını yakalar', () => {
    // REGRESYON — odoo/odoo#270638: kök `cbc:ID` alanına 16 haneli belge
    // numarası yerine üç harflik sıra kodu ("OUT") yazılıyordu. Belge XSD
    // doğrulamasından geçiyor, karşı taraf reddediyordu. Bu kural XSD'de
    // değil, GİB kılavuzunda tanımlı — `xmllint` göremez.
    const hata = hataAl('OUT')
    expect(hata.code).toBe('INVALID_DOCUMENT_NUMBER')
    expect(hata.reason).toBe('length')
  })

  it('nedeni ayırt edilebilir biçimde bildirir', () => {
    expect(hataAl('OUT').reason).toBe('length')
    expect(hataAl('1232026000000001').reason).toBe('prefix')
    expect(hataAl('ABCX026000000001').reason).toBe('year')
    expect(hataAl('ABC1999000000001').reason).toBe('year')
  })

  it('geçerli numarada parçaları döndürür', () => {
    expect(assertValidDocumentNumber('ABC2026000000001', 'cbc:ID')).toEqual({
      prefix: 'ABC',
      year: 2026,
      sequence: '000000001',
    })
  })
})

describe('düzenleme tarihiyle çapraz denetim', () => {
  it('yıl uyuşmazlığını yakalar', () => {
    // Bu denetimi incelenen paketlerin hiçbiri yapmıyor; ikisi yıl
    // segmentine hiç bakmıyor. GİB numaralandırmayı yıla bağlar.
    let hata: unknown
    try {
      assertValidDocumentNumber('ABC2025000000001', 'cbc:ID', { issueDate: '2026-09-06' })
    } catch (error) {
      hata = error
    }
    expect(hata).toBeInstanceOf(InvalidDocumentNumberError)
    const tipli = hata as InvalidDocumentNumberError
    expect(tipli.reason).toBe('year-mismatch')
    expect(tipli.detail).toBe('2026')
  })

  it('yıl uyuşuyorsa geçirir', () => {
    expect(() =>
      assertValidDocumentNumber('ABC2026000000001', 'cbc:ID', { issueDate: '2026-01-01' }),
    ).not.toThrow()
  })

  it('tarih verilmezse yıl denetimi yapmaz', () => {
    expect(() => assertValidDocumentNumber('ABC2025000000001', 'cbc:ID')).not.toThrow()
  })
})

describe('sıra numarası ve yıl sınırları', () => {
  it('sıra numarasında rakam dışı karakteri reddeder', () => {
    let hata: unknown
    try {
      assertValidDocumentNumber('ABC202600000000X', 'cbc:ID')
    } catch (error) {
      hata = error
    }
    expect((hata as InvalidDocumentNumberError).reason).toBe('sequence')
  })

  it('UBL-TR yürürlük yılından önceki yılı reddeder', () => {
    expect(isValidDocumentNumber('ABC2009000000001')).toBe(false)
    expect(isValidDocumentNumber('ABC2010000000001')).toBe(true)
  })

  it('geçersiz tarih dizesinde yıl denetimini atlar', () => {
    // Tarih ayrıştırılamıyorsa belge numarası hakkında bir şey söylenemez;
    // uydurma bir yıl üretip yanlış hata vermek, hiç denetlememekten kötüdür.
    expect(() =>
      assertValidDocumentNumber('ABC2026000000001', 'cbc:ID', { issueDate: 'gecersiz' }),
    ).not.toThrow()
  })
})
