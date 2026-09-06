import { describe, expect, it } from 'vitest'

import { InvalidXmlCharacterError, InvalidXmlNameError } from '../errors.js'

import {
  assertValidXmlName,
  assertValidXmlText,
  escapeAttribute,
  escapeText,
  isForbiddenXmlCharacter,
} from './escape.js'

/** Kaynakta düz yazılamayan kontrol karakterlerini üretir. */
const ctrl = (code: number): string => String.fromCharCode(code)

describe('XML 1.0 karakter kümesi', () => {
  it('izinli boşluk karakterlerini kabul eder', () => {
    for (const code of [0x09, 0x0a, 0x0d, 0x20]) {
      expect(isForbiddenXmlCharacter(code)).toBe(false)
    }
  })

  it('kontrol karakterlerini reddeder', () => {
    for (const code of [0x00, 0x01, 0x08, 0x0b, 0x0c, 0x0e, 0x1f]) {
      expect(isForbiddenXmlCharacter(code)).toBe(true)
    }
  })

  it('tek başına vekil kod noktalarını ve U+FFFE/U+FFFF reddeder', () => {
    for (const code of [0xd800, 0xdc00, 0xdfff, 0xfffe, 0xffff]) {
      expect(isForbiddenXmlCharacter(code)).toBe(true)
    }
  })

  it('vekil çiftinden oluşan gerçek kod noktasını kabul eder', () => {
    // "😀" U+1F600 — UTF-16'da vekil çifti, ama kod noktası olarak geçerli.
    expect(isForbiddenXmlCharacter(0x1f600)).toBe(false)
  })
})

describe('metin doğrulama', () => {
  it('temiz metni geçirir', () => {
    expect(() => {
      assertValidXmlText('Acme Ltd. Şti. — ödeme #1', 'cbc:Name')
    }).not.toThrow()
  })

  it('kontrol karakterini reddeder ve konumu bildirir', () => {
    // REGRESYON: incelenen üç rakip kütüphanenin ikisi bu karakteri sessizce
    // çıktıya geçiriyordu. Sonuç, yerelde ayrıştırılabilen ama katı bir
    // doğrulayıcının reddettiği bir belge — yani hata vergi dairesinde çıkar.
    let hata: unknown
    try {
      assertValidXmlText(`Acme${ctrl(1)} Ltd.`, 'cbc:Name')
    } catch (error) {
      hata = error
    }
    expect(hata).toBeInstanceOf(InvalidXmlCharacterError)
    const tipli = hata as InvalidXmlCharacterError
    expect(tipli.code).toBe('INVALID_XML_CHARACTER')
    expect(tipli.location).toBe('cbc:Name')
    expect(tipli.offset).toBe(4)
    expect(tipli.codePoint).toBe(1)
  })

  it('vekil çiftinden sonraki ofseti UTF-16 birimiyle sayar', () => {
    // "😀" iki UTF-16 birimi kaplar; ofset 2 olmalı, 1 değil. Yanlış ofset,
    // uzun bir alanda hatayı bulmayı imkânsız kılar.
    let hata: unknown
    try {
      assertValidXmlText(`😀${ctrl(11)}`, 'cbc:Note')
    } catch (error) {
      hata = error
    }
    expect((hata as InvalidXmlCharacterError).offset).toBe(2)
  })
})

describe('ad doğrulama', () => {
  it('UBL adlarını kabul eder', () => {
    for (const ad of ['UBLVersionID', 'ID', 'AccountingSupplierParty', '_x', 'A-1.b']) {
      expect(() => {
        assertValidXmlName(ad)
      }).not.toThrow()
    }
  })

  it('geçersiz adları reddeder', () => {
    for (const ad of ['Invoice Line', '2ID', '-ID', '', 'a<b']) {
      expect(() => {
        assertValidXmlName(ad)
      }).toThrow(InvalidXmlNameError)
    }
  })

  it('ön ekli adı reddeder — ön ek ayrı verilir', () => {
    // `cbc:ID` bir NCName değildir. Ön eki adın içine yazmak, serileştiricinin
    // ad alanı çözümlemesini atlatmanın yolu olurdu.
    expect(() => {
      assertValidXmlName('cbc:ID')
    }).toThrow(InvalidXmlNameError)
  })
})

describe('metin kaçışı (C14N 1.0 §2.3)', () => {
  it('&, < ve > kaçırır', () => {
    expect(escapeText('A & B <Ltd> "Şti"')).toBe('A &amp; B &lt;Ltd&gt; "Şti"')
  })

  it('& karakterini bir kez kaçırır', () => {
    // Sıra önemli: `&` ilk sırada değilse `&lt;` çıktısı `&amp;lt;` olur.
    expect(escapeText('<')).toBe('&lt;')
    expect(escapeText('&amp;')).toBe('&amp;amp;')
  })

  it('satır başını sayısal başvuruya çevirir', () => {
    // Ham CR, XML satır sonu normalizasyonunda (XML 1.0 §2.11) LF'e dönüşür
    // ve gidiş-dönüşte sessizce kaybolur.
    expect(escapeText('a\r\nb')).toBe('a&#xD;\nb')
  })

  it('tırnakları kaçırmaz', () => {
    expect(escapeText(`O'Reilly "x"`)).toBe(`O'Reilly "x"`)
  })
})

describe('öznitelik kaçışı (C14N 1.0 §2.3)', () => {
  it('&, < ve çift tırnak kaçırır, > kaçırmaz', () => {
    // `>` bilinçli olarak kaçırılmaz: C14N öznitelik değerinde yalnızca
    // `&`, `<`, `"` ve boşluk karakterlerini kaçırır. Değer çift tırnak
    // içinde olduğu için `>` belirsizlik yaratmaz. Metin düğümünde ise
    // kaçırılır — iki bağlamın kuralı aynı değildir.
    expect(escapeAttribute('A & B <x> "y"')).toBe('A &amp; B &lt;x> &quot;y&quot;')
    expect(escapeText('<x>')).toBe('&lt;x&gt;')
  })

  it('sekme, satır sonu ve satır başını sayısal başvuruya çevirir', () => {
    // REGRESYON: kaçırılmazsa öznitelik değeri normalizasyonu (XML 1.0
    // §3.3.3) bunları tek boşluğa çevirir ve değer gidiş-dönüşte değişir.
    // Bu, incelenen rakiplerde canlı olarak doğrulandı.
    expect(escapeAttribute('a\tb\nc\rd')).toBe('a&#x9;b&#xA;c&#xD;d')
  })

  it('tek tırnağı kaçırmaz — değer çift tırnak içinde', () => {
    expect(escapeAttribute("O'Reilly")).toBe("O'Reilly")
  })
})
