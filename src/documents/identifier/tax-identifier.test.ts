import { describe, expect, it } from 'vitest'

import type { InvalidTaxIdentifierError } from '../errors.js'

import {
  assertValidTaxIdentifier,
  detectTaxIdentifierKind,
  isValidTckn,
  isValidVkn,
} from './tax-identifier.js'

/**
 * Uydurulmuş ama kontrol basamakları tutan numaralar. Gerçek bir mükellefe
 * ait değildir; algoritmayla üretilmiştir.
 */
const GECERLI_TCKN = ['52040077498', '59964871010', '63013434958', '31957877872']
const GECERLI_VKN = ['7857313547', '0149537825', '0580438389', '1357460760']

/** Bir numaranın tek bir hanesini değiştirir. */
const haneyiBoz = (value: string, index: number): string => {
  const eski = Number(value[index])
  return `${value.slice(0, index)}${String((eski + 1) % 10)}${value.slice(index + 1)}`
}

describe('TCKN kontrol basamakları', () => {
  it('geçerli numaraları kabul eder', () => {
    for (const tckn of GECERLI_TCKN) expect(isValidTckn(tckn)).toBe(true)
  })

  it('tek hane hatasının tamamını yakalar', () => {
    // Kontrol basamağı algoritmasının varlık sebebi bu. İncelenen üç UBL-TR
    // paketinin hiçbiri bunu yapmıyor; yalnızca hane sayısına bakıyorlar.
    for (const tckn of GECERLI_TCKN) {
      for (let i = 0; i < tckn.length; i += 1) {
        expect(isValidTckn(haneyiBoz(tckn, i))).toBe(false)
      }
    }
  })

  it('bitişik transpozisyonda ölçülmüş sınırı korur', () => {
    // Bu, algoritmanın SINIRIDIR ve burada sabitlenir. Üç ayrı davranış var
    // ve üçünün de cebirsel açıklaması net:
    //
    // 1. Veri haneleri arasında (2.–9. hane): transpozisyon 11. haneyi hiç
    //    etkilemez (hane toplamı değişmez) ve 10. haneyi `8 × (a − b)` kadar
    //    kaydırır. `a − b` beşin katıysa bu mod 10'da sıfırdır — hata
    //    görünmez olur. Diğer her fark yakalanır.
    // 2. 1.–2. hane: aynı kural geçerli, ama takas sonucu numara sıfırla
    //    başlıyorsa ayrı bir kural onu zaten reddeder.
    // 3. 10.–11. hane: bunlar kontrol basamaklarının kendisidir, veri
    //    değildir; takasları her zaman yakalanır.
    let veriKacan = 0
    let veriYakalanan = 0
    for (const tckn of GECERLI_TCKN) {
      for (let i = 0; i < tckn.length - 1; i += 1) {
        const a = Number(tckn[i])
        const b = Number(tckn[i + 1])
        if (a === b) continue
        const takas = `${tckn.slice(0, i)}${String(b)}${String(a)}${tckn.slice(i + 2)}`
        const gecerli = isValidTckn(takas)

        if (i === 9) {
          expect(gecerli).toBe(false)
        } else if (i === 0 && b === 0) {
          // Takas numarayı sıfırla başlatır; baştaki sıfır kuralı yakalar.
          expect(gecerli).toBe(false)
        } else if (Math.abs(a - b) === 5) {
          expect(gecerli).toBe(true)
          veriKacan += 1
        } else {
          expect(gecerli).toBe(false)
          veriYakalanan += 1
        }
      }
    }
    expect(veriYakalanan).toBeGreaterThan(20)
    expect(veriKacan).toBeGreaterThan(0)
  })

  it('sıfırla başlayanı reddeder', () => {
    expect(isValidTckn(`0${GECERLI_TCKN[0]?.slice(1) ?? ''}`)).toBe(false)
  })

  it('yanlış uzunluğu ve rakam dışı karakteri reddeder', () => {
    expect(isValidTckn('5204007749')).toBe(false)
    expect(isValidTckn('520400774980')).toBe(false)
    expect(isValidTckn('5204007749A')).toBe(false)
    expect(isValidTckn('')).toBe(false)
  })

  it('ASCII olmayan rakamları reddeder', () => {
    // "٥٢٠٤٠٠٧٧٤٩٨" görsel olarak rakam ama farklı kod noktaları.
    expect(isValidTckn('٥٢٠٤٠٠٧٧٤٩٨')).toBe(false)
  })
})

describe('VKN kontrol basamağı', () => {
  it('geçerli numaraları kabul eder', () => {
    for (const vkn of GECERLI_VKN) expect(isValidVkn(vkn)).toBe(true)
  })

  it('sıfırla başlayan VKN geçerlidir', () => {
    // TCKN'den ayrıldığı nokta. Bu yüzden vergi numarası hiçbir zaman sayıya
    // çevrilmemelidir — incelenen bir pakette ayrıştırıcı tam olarak bunu
    // yapıyor ve "0149537825" ile "149537825" ayırt edilemez hâle geliyordu.
    expect(isValidVkn('0843118681')).toBe(true)
  })

  it('tek hane hatasının tamamını yakalar', () => {
    for (const vkn of GECERLI_VKN) {
      for (let i = 0; i < vkn.length; i += 1) {
        expect(isValidVkn(haneyiBoz(vkn, i))).toBe(false)
      }
    }
  })

  it('yanlış uzunluğu ve rakam dışı karakteri reddeder', () => {
    expect(isValidVkn('785731354')).toBe(false)
    expect(isValidVkn('78573135470')).toBe(false)
    expect(isValidVkn('785731354A')).toBe(false)
  })
})

describe('tür belirleme', () => {
  it('geçerli numaraların türünü söyler', () => {
    expect(detectTaxIdentifierKind(GECERLI_VKN[0] ?? '')).toBe('VKN')
    expect(detectTaxIdentifierKind(GECERLI_TCKN[0] ?? '')).toBe('TCKN')
  })

  it('geçersiz numarada undefined döner', () => {
    expect(detectTaxIdentifierKind('1234567891')).toBeUndefined()
    expect(detectTaxIdentifierKind('123')).toBeUndefined()
  })

  it('"1234567890" geçerli bir VKN\'dir — sahte örnek seçerken dikkat', () => {
    // Test verisi olarak her yerde kullanılan bu numara kontrol basamağından
    // GEÇER. "Açıkça sahte" görünen bir numara geçersiz olmak zorunda değil;
    // geçersiz örnek seçerken algoritmayla doğrulamak gerekir.
    expect(isValidVkn('1234567890')).toBe(true)
  })
})

describe('doğrulama hatası', () => {
  const hataAl = (value: string): InvalidTaxIdentifierError => {
    try {
      assertValidTaxIdentifier(value, 'supplier.vkn')
    } catch (error) {
      return error as InvalidTaxIdentifierError
    }
    throw new Error('hata beklendi')
  }

  it('nedeni ayırt edilebilir biçimde bildirir', () => {
    expect(hataAl('123').reason).toBe('length')
    expect(hataAl('123456789A').reason).toBe('digits')
    expect(hataAl('01234567890').reason).toBe('leading-zero')
    expect(hataAl('1234567891').reason).toBe('checksum')
  })

  it('checksum hatasında türü ve konumu taşır', () => {
    const hata = hataAl('1234567891')
    expect(hata.code).toBe('INVALID_TAX_IDENTIFIER')
    expect(hata.kind).toBe('VKN')
    expect(hata.location).toBe('supplier.vkn')
    expect(hata.value).toBe('1234567891')
  })

  it('geçerli numarada türü döndürür', () => {
    expect(assertValidTaxIdentifier(GECERLI_VKN[0] ?? '', 'x')).toBe('VKN')
    expect(assertValidTaxIdentifier(GECERLI_TCKN[0] ?? '', 'x')).toBe('TCKN')
  })
})
