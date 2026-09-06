import {
  DoctypeNotAllowedError,
  MixedContentError,
  UnboundPrefixError,
  XmlLimitExceededError,
  XmlSyntaxError,
} from '../errors.js'

import { container, leaf, type XmlAttribute, type XmlElement } from './node.js'

/** {@link parseDocument} seçenekleri. */
export interface ParseOptions {
  /**
   * İzin verilen en fazla iç içe geçme derinliği. Varsayılan 100.
   *
   * Sınırsız derinlik, özyinelemeli ayrıştırmada yığın taşmasıdır. Gelen bir
   * e-belge ticari partnerden gelir; derinliğini gönderen belirler. Gerçek
   * bir UBL faturası 10 seviyeyi geçmez.
   */
  readonly maxDepth?: number

  /**
   * İzin verilen en fazla girdi uzunluğu (karakter). Varsayılan 16.777.216
   * (16 MiB).
   *
   * Sınır ayrıştırmadan **önce** uygulanır: hiçbir işlem yapmadan reddetmek,
   * yarı yolda bellek tüketmekten iyidir.
   */
  readonly maxSize?: number
}

/** {@link parseDocument} sonucu. */
export interface ParsedDocument {
  /** Belgenin kök öğesi. */
  readonly root: XmlElement

  /**
   * Belgede karşılaşılan ön ek → ad alanı eşlemesi.
   *
   * Doğrudan {@link serializeDocument} seçeneklerine verilebilir; gidiş-dönüş
   * bu şekilde kurulur.
   */
  readonly prefixes: Readonly<Record<string, string>>

  /** Varsayılan ad alanı (`xmlns="…"`); bildirilmemişse `undefined`. */
  readonly defaultNamespace?: string
}

const DEFAULT_MAX_DEPTH = 100
const DEFAULT_MAX_SIZE = 16 * 1024 * 1024

/** XML'in beş önceden tanımlı varlığı. DTD reddedildiği için başkası yoktur. */
const PREDEFINED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

/** Boşluk sayılan karakterler (XML 1.0 §2.3 `S`). */
const isSpace = (code: number): boolean =>
  code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d

/**
 * UBL-TR XML belgesini öğe ağacına ayrıştırır.
 *
 * Bu ayrıştırıcının **çalışma zamanı bağımlılığı yoktur** ve tasarımı üç
 * noktada yaygın kütüphanelerden ayrılır — üçü de incelenen paketlerde
 * gözlenen gerçek sorunlara karşılık gelir:
 *
 * 1. **DTD tümden reddedilir.** Varlık genişletme, harici varlık (XXE) ve
 *    karesel şişme saldırılarının tamamı DTD üzerinden gelir. "Sınırlı
 *    destek" yerine bildirimi reddetmek bu sınıfı ortadan kaldırır.
 * 2. **Ad alanları çözümlenir, silinmez.** Yaygın ayrıştırıcı seçeneği
 *    `removeNSPrefix` ön ekleri atar; o anda `cbc:ID` ile `cac:ID` ayırt
 *    edilemez hâle gelir. Burada her öğe kendi ad alanı URI'siyle taşınır.
 * 3. **Hiçbir değer türü tahmin edilmez.** Metin her zaman `string` kalır.
 *    Sayı tahmini yapan ayrıştırıcılarda `1234567890` VKN'si `number`,
 *    `0123456789` VKN'si `string` oluyor — aynı alanın tipi değere göre
 *    değişiyor ve tüketici kodu değere göre patlıyor.
 *
 * @param xml - Ayrıştırılacak XML belgesi
 * @param options - Derinlik ve boyut sınırları
 * @returns Kök öğe ve ad alanı bildirimleri
 * @throws {XmlSyntaxError} Belge iyi-biçimli değilse
 * @throws {DoctypeNotAllowedError} Belgede DOCTYPE bildirimi varsa
 * @throws {XmlLimitExceededError} Boyut ya da derinlik sınırı aşılırsa
 * @throws {UnboundPrefixError} Bildirilmemiş bir ön ek kullanılmışsa
 * @throws {MixedContentError} Bir öğe hem metin hem alt öğe içeriyorsa
 * @throws {InvalidXmlCharacterError} Belge XML dışı bir karakter içeriyorsa
 *
 * @example Okuma
 * ```ts
 * const { root, prefixes, defaultNamespace } = parseDocument(faturaXml)
 * root.name // 'Invoice'
 * root.namespace // 'urn:oasis:…:Invoice-2'
 * ```
 *
 * @example Kayıpsız gidiş-dönüş
 * ```ts
 * const parsed = parseDocument(xml)
 * const geri = serializeDocument(parsed.root, {
 *   defaultNamespace: parsed.defaultNamespace,
 *   prefixes: parsed.prefixes,
 * })
 * geri === xml // sıkışık biçimde yazılmış bir belgede her zaman true
 * ```
 *
 * @example Kaynak tüketimini sınırlama
 * ```ts
 * parseDocument(gelenBelge, { maxSize: 2 * 1024 * 1024, maxDepth: 40 })
 * ```
 */
export const parseDocument = (xml: string, options: ParseOptions = {}): ParsedDocument => {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE
  if (xml.length > maxSize) {
    throw new XmlLimitExceededError('size', xml.length, maxSize)
  }

  let i = 0
  /** Kökte toplanacak ön ek bildirimleri. */
  const prefixes: Record<string, string> = {}
  let defaultNamespace: string | undefined

  /** Ofsetten satır/sütun hesaplar. Yalnızca hata anında çağrılır. */
  const konum = (offset: number): { line: number; column: number } => {
    let line = 1
    let son = -1
    for (let k = 0; k < offset; k += 1) {
      if (xml.charCodeAt(k) === 0x0a) {
        line += 1
        son = k
      }
    }
    return { line, column: offset - son }
  }

  // Tip açıklaması ZORUNLU: TypeScript, `never` döndüren bir `const` ok
  // fonksiyonunu ancak açık tip açıklaması varsa akış analizinde kullanır.
  // Açıklama olmadan `hata()` çağrısından sonraki kod erişilebilir sayılır
  // ve daraltma yapılmaz.
  const hata: (detail: string, offset?: number) => never = (detail, offset = i) => {
    const { line, column } = konum(offset)
    throw new XmlSyntaxError(detail, offset, line, column)
  }

  const skipSpace = (): void => {
    while (i < xml.length && isSpace(xml.charCodeAt(i))) i += 1
  }

  /** `NCName` ya da `prefix:local` biçiminde nitelikli ad okur. */
  const readName = (): string => {
    const bas = i
    while (i < xml.length) {
      const c = xml.charCodeAt(i)
      if (isSpace(c) || c === 0x3e || c === 0x2f || c === 0x3d) break // > / =
      i += 1
    }
    if (i === bas) hata('ad bekleniyordu')
    return xml.slice(bas, i)
  }

  /** Metin ve öznitelik değerlerindeki başvuruları çözer. */
  const decode = (raw: string, offset: number): string => {
    if (!raw.includes('&')) return raw
    let sonuc = ''
    let p = 0
    for (;;) {
      const amp = raw.indexOf('&', p)
      if (amp === -1) {
        sonuc += raw.slice(p)
        return sonuc
      }
      sonuc += raw.slice(p, amp)
      const noktali = raw.indexOf(';', amp)
      if (noktali === -1) hata('kapanmamış varlık başvurusu', offset + amp)
      const ad = raw.slice(amp + 1, noktali)
      if (ad.startsWith('#')) {
        const onaltilik = ad.startsWith('#x') || ad.startsWith('#X')
        const basamaklar = ad.slice(onaltilik ? 2 : 1)
        const gecerli = onaltilik ? /^[0-9a-fA-F]+$/.test(basamaklar) : /^[0-9]+$/.test(basamaklar)
        if (!gecerli) hata(`geçersiz sayısal başvuru "&${ad};"`, offset + amp)
        const kod = Number.parseInt(basamaklar, onaltilik ? 16 : 10)
        if (!Number.isFinite(kod) || kod > 0x10ffff) {
          hata(`aralık dışı sayısal başvuru "&${ad};"`, offset + amp)
        }
        sonuc += String.fromCodePoint(kod)
      } else {
        const deger = PREDEFINED_ENTITIES[ad]
        if (deger === undefined) {
          // DTD reddedildiği için özel varlık tanımlanmış olamaz; bilinmeyen
          // bir ad her zaman hatadır. Sessizce geçirmek, `&sirket;` gibi bir
          // dizeyi belgede bırakır ve hatayı karşı tarafa taşır.
          hata(`bilinmeyen varlık başvurusu "&${ad};"`, offset + amp)
        }
        sonuc += deger
      }
      p = noktali + 1
    }
  }

  /** Prolog ve son ek: boşluk, yorum, işlem talimatı; DOCTYPE reddedilir. */
  const skipMisc = (): void => {
    for (;;) {
      skipSpace()
      if (xml.startsWith('<!--', i)) {
        const son = xml.indexOf('-->', i + 4)
        if (son === -1) hata('kapanmamış yorum')
        i = son + 3
        continue
      }
      if (xml.startsWith('<?', i)) {
        const son = xml.indexOf('?>', i + 2)
        if (son === -1) hata('kapanmamış işlem talimatı')
        i = son + 2
        continue
      }
      if (xml.startsWith('<!DOCTYPE', i)) throw new DoctypeNotAllowedError(i)
      return
    }
  }

  /**
   * Bir öğeyi ve altındakileri okur.
   *
   * @param scope - Kalıtılan ön ek → ad alanı eşlemesi
   * @param depth - Bulunulan derinlik
   */
  const parseElement = (scope: ReadonlyMap<string, string>, depth: number): XmlElement => {
    if (depth > maxDepth) throw new XmlLimitExceededError('depth', depth, maxDepth)

    const etiketBasi = i
    i += 1 // '<'
    const qname = readName()

    // Ad alanı bildirimlerini topla; bunlar öznitelik olarak saklanmaz.
    let yerelScope: Map<string, string> | undefined
    const hamOznitelikler: { qname: string; value: string; offset: number }[] = []

    for (;;) {
      skipSpace()
      if (i >= xml.length) hata('kapanmamış etiket', etiketBasi)
      if (xml.startsWith('/>', i) || xml.charCodeAt(i) === 0x3e) break

      const adOfseti = i
      const attrQname = readName()
      skipSpace()
      if (xml.charCodeAt(i) !== 0x3d) hata(`"${attrQname}" özniteliğinde "=" bekleniyordu`)
      i += 1
      skipSpace()
      const tirnak = xml.charCodeAt(i)
      if (tirnak !== 0x22 && tirnak !== 0x27) hata('öznitelik değeri tırnak içinde olmalı')
      i += 1
      const degerBasi = i
      const degerSonu = xml.indexOf(tirnak === 0x22 ? '"' : "'", i)
      if (degerSonu === -1) hata('kapanmamış öznitelik değeri', degerBasi)
      // XML 1.0 §3.3.3 öznitelik değeri normalizasyonu: ham boşluk
      // karakterleri tek boşluğa dönüşür. Sayısal başvurular (`&#xA;`)
      // normalizasyondan MUAFTIR, bu yüzden önce normalize edip sonra
      // çözüyoruz — sıranın tersi, kaçırılmış satır sonlarını da yok ederdi.
      const ham = xml.slice(degerBasi, degerSonu).replace(/[\t\n\r]/g, ' ')
      i = degerSonu + 1

      if (attrQname === 'xmlns') {
        defaultNamespace ??= decode(ham, degerBasi)
        yerelScope ??= new Map(scope)
        yerelScope.set('', decode(ham, degerBasi))
      } else if (attrQname.startsWith('xmlns:')) {
        const onEk = attrQname.slice(6)
        const uri = decode(ham, degerBasi)
        const oncekiKok = prefixes[onEk]
        if (oncekiKok !== undefined && oncekiKok !== uri) {
          hata(
            `"${onEk}" ön eki belgede iki farklı ad alanına bağlanmış ` +
              `("${oncekiKok}" ve "${uri}"). Bu belge kayıpsız yeniden yazılamaz.`,
            adOfseti,
          )
        }
        prefixes[onEk] = uri
        yerelScope ??= new Map(scope)
        yerelScope.set(onEk, uri)
      } else {
        hamOznitelikler.push({ qname: attrQname, value: ham, offset: degerBasi })
      }
    }

    const gecerliScope: ReadonlyMap<string, string> = yerelScope ?? scope

    /** Nitelikli adı ad alanı ve yerel ada ayırır. */
    const coz = (ad: string, oznitelikMi: boolean): { ns: string | undefined; local: string } => {
      const ikiNokta = ad.indexOf(':')
      if (ikiNokta === -1) {
        // Varsayılan ad alanı ÖĞELERE uygulanır, ÖZNİTELİKLERE uygulanmaz
        // (Namespaces in XML 1.0 §6.2). Ön eksiz bir özniteliğin ad alanı yoktur.
        return { ns: oznitelikMi ? undefined : gecerliScope.get(''), local: ad }
      }
      const onEk = ad.slice(0, ikiNokta)
      const uri = gecerliScope.get(onEk)
      if (uri === undefined) throw new UnboundPrefixError(onEk, ad)
      return { ns: uri, local: ad.slice(ikiNokta + 1) }
    }

    const { ns: elementNs, local: elementLocal } = coz(qname, false)
    const oznitelikler: XmlAttribute[] = hamOznitelikler.map((a) => {
      const { ns, local } = coz(a.qname, true)
      const value = decode(a.value, a.offset)
      return ns === undefined ? { name: local, value } : { name: local, value, namespace: ns }
    })

    if (xml.startsWith('/>', i)) {
      i += 2
      return leaf(elementNs ?? '', elementLocal, '', oznitelikler)
    }
    i += 1 // '>'

    // İçerik: metin, alt öğe, CDATA, yorum karışımı.
    let metin = ''
    let metinOfseti = i
    let bosluksuzMetinVar = false
    const cocuklar: XmlElement[] = []

    for (;;) {
      if (i >= xml.length) hata(`"${qname}" için kapanış etiketi bulunamadı`, etiketBasi)

      if (xml.charCodeAt(i) !== 0x3c) {
        const sonraki = xml.indexOf('<', i)
        const parca = xml.slice(i, sonraki === -1 ? xml.length : sonraki)
        if (metin === '') metinOfseti = i
        metin += decode(parca, i)
        if (parca.trim() !== '') bosluksuzMetinVar = true
        i = sonraki === -1 ? xml.length : sonraki
        continue
      }

      if (xml.startsWith('</', i)) {
        const kapanisBasi = i
        i += 2
        const kapanisAdi = readName()
        skipSpace()
        if (xml.charCodeAt(i) !== 0x3e) hata('kapanış etiketinde ">" bekleniyordu')
        i += 1
        if (kapanisAdi !== qname) {
          hata(`"${qname}" bekleniyordu, "${kapanisAdi}" kapanış etiketi bulundu`, kapanisBasi)
        }
        break
      }

      if (xml.startsWith('<![CDATA[', i)) {
        const son = xml.indexOf(']]>', i + 9)
        if (son === -1) hata('kapanmamış CDATA bölümü')
        const parca = xml.slice(i + 9, son)
        if (metin === '') metinOfseti = i
        metin += parca
        if (parca.trim() !== '') bosluksuzMetinVar = true
        i = son + 3
        continue
      }

      if (xml.startsWith('<!--', i)) {
        const son = xml.indexOf('-->', i + 4)
        if (son === -1) hata('kapanmamış yorum')
        i = son + 3
        continue
      }

      if (xml.startsWith('<?', i)) {
        const son = xml.indexOf('?>', i + 2)
        if (son === -1) hata('kapanmamış işlem talimatı')
        i = son + 2
        continue
      }

      if (xml.startsWith('<!DOCTYPE', i)) throw new DoctypeNotAllowedError(i)

      cocuklar.push(parseElement(gecerliScope, depth + 1))
    }

    if (cocuklar.length > 0) {
      // Girintili belgelerdeki boşluk-metin düğümleri karışık içerik değildir
      // ve atılır. Gerçek karışık içerik ise UBL-TR'de kullanılmaz; sessizce
      // atmak veriyi kaybetmek olurdu.
      if (bosluksuzMetinVar) throw new MixedContentError(qname, metinOfseti)
      return container(elementNs ?? '', elementLocal, cocuklar, oznitelikler)
    }
    return leaf(elementNs ?? '', elementLocal, metin, oznitelikler)
  }

  skipMisc()
  if (i >= xml.length || xml.charCodeAt(i) !== 0x3c) hata('kök öğe bulunamadı')
  const root = parseElement(new Map<string, string>(), 1)
  skipMisc()
  if (i < xml.length) hata('kök öğeden sonra fazladan içerik var')

  return defaultNamespace === undefined ? { root, prefixes } : { root, prefixes, defaultNamespace }
}
