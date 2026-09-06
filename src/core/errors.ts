/**
 * Çekirdek katmanın fırlattığı hataların ortak atası.
 *
 * Her hata bir `code` taşır. Mesaj metni sürümler arasında değişebilir ve
 * insan içindir; makine kararları **daima** `code` üzerinden verilmelidir.
 *
 * @example
 * ```ts
 * try {
 *   serializeDocument(belge, { prefixes })
 * } catch (hata) {
 *   if (hata instanceof UblTrError && hata.code === 'INVALID_XML_CHARACTER') {
 *     // Metin alanını temizleyip yeniden dene
 *   }
 * }
 * ```
 */
export abstract class UblTrError extends Error {
  /**
   * @param code - Makine tarafından okunacak, sürümler arası kararlı hata kodu
   * @param message - İnsan için açıklama; sürümler arası kararlı değildir
   */
  protected constructor(
    /** Makine tarafından okunacak, sürümler arası kararlı hata kodu. */
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = new.target.name
  }
}

/**
 * Bir metin ya da öznitelik değeri, XML 1.0'ın izin vermediği bir karakter
 * içeriyor.
 *
 * XML 1.0 §2.2 karakter kümesi, kontrol karakterlerinin neredeyse tamamını
 * (U+0000–U+0008, U+000B, U+000C, U+000E–U+001F) **hiçbir biçimde** kabul
 * etmez: sayısal karakter başvurusuyla bile yazılamazlar. Bu yüzden durum
 * bir kaçış sorunu değil, girdi hatasıdır ve sessizce düzeltilmez — hangi
 * düzeltmenin doğru olduğunu yalnızca çağıran bilir: karakteri silmek mi,
 * boşlukla değiştirmek mi, kaydı tümden reddetmek mi.
 *
 * @example
 * ```ts
 * // Bir ERP'den gelen ünvan alanında U+0001 varsa:
 * leaf(Namespace.COMMON_BASIC, 'Name', unvan)
 * // → InvalidXmlCharacterError { location: 'Name', offset: 4, codePoint: 1 }
 * ```
 */
export class InvalidXmlCharacterError extends UblTrError {
  /**
   * @param location - Hatanın bulunduğu öğe ya da öznitelik adı
   * @param offset - Değer içindeki sıfır tabanlı karakter konumu
   * @param codePoint - Kabul edilmeyen karakterin Unicode kod noktası
   */
  constructor(
    /** Hatanın bulunduğu öğe ya da öznitelik adı. */
    public readonly location: string,
    /** Değer içindeki sıfır tabanlı karakter konumu. */
    public readonly offset: number,
    /** Kabul edilmeyen karakterin Unicode kod noktası. */
    public readonly codePoint: number,
  ) {
    super(
      'INVALID_XML_CHARACTER',
      `"${location}" değerinde XML 1.0'ın kabul etmediği bir karakter var: ` +
        `ofset ${String(offset)}, kod noktası ` +
        `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}. ` +
        'Bu karakter sayısal başvuruyla da yazılamaz; değerin temizlenmesi gerekir.',
    )
  }
}

/**
 * Bir öğe ya da öznitelik adı, XML'in ad kurallarına uymuyor.
 *
 * Ad doğrulaması bilerek katıdır: geçersiz bir ad üretilen belgeyi
 * iyi-biçimli olmaktan çıkarır ve hata çalışma zamanında değil karşı
 * tarafın doğrulayıcısında ortaya çıkar.
 *
 * @example
 * ```ts
 * leaf(Namespace.COMMON_BASIC, 'Invoice Line', '1')
 * // → InvalidXmlNameError: "Invoice Line" geçerli bir XML adı değil
 * ```
 */
export class InvalidXmlNameError extends UblTrError {
  /**
   * @param xmlName - Reddedilen ad
   */
  constructor(
    /**
     * Reddedilen ad.
     *
     * `name` DEĞİL: `Error.name` hata sınıfının adını taşır ve gölgelenmesi
     * `instanceof` dışındaki her teşhis yolunu bozar.
     */
    public readonly xmlName: string,
  ) {
    super(
      'INVALID_XML_NAME',
      `"${xmlName}" geçerli bir XML adı değil. Ad bir harf veya alt çizgiyle ` +
        'başlamalı; harf, rakam, nokta, tire ve alt çizgiyle devam edebilir. ' +
        'Ön ek ayrı verildiği için iki nokta üst üste kabul edilmez.',
    )
  }
}

/**
 * Serileştirilen ağaçta, kök öğede bildirilmemiş bir ad alanı kullanılmış.
 *
 * Bu kütüphane ad alanı bildirimlerini yalnızca kök öğede toplar; böylece
 * çıktı deterministik olur ve aynı ağaç her zaman bayt bayt aynı XML'i
 * üretir. Bildirilmemiş bir ad alanı **sessizce varsayılana düşürülmez** —
 * çünkü tam olarak bu sessiz düşüş, öğelerin yanlış ad alanına yazılmasına
 * ve belgenin şema doğrulamasında reddedilmesine yol açar.
 *
 * @example
 * ```ts
 * serializeDocument(kok, { prefixes: { cbc: Namespace.COMMON_BASIC } })
 * // Ağaçta cac: ad alanından bir öğe varsa:
 * // → UndeclaredNamespaceError { namespace: '...CommonAggregateComponents-2' }
 * ```
 */
export class UndeclaredNamespaceError extends UblTrError {
  /**
   * @param namespace - Ağaçta kullanılan ama bildirilmemiş ad alanı URI'si
   * @param elementName - Bu ad alanını kullanan öğenin ya da özniteliğin adı
   */
  constructor(
    /** Ağaçta kullanılan ama bildirilmemiş ad alanı URI'si. */
    public readonly namespace: string,
    /** Bu ad alanını kullanan öğenin ya da özniteliğin adı. */
    public readonly elementName: string,
  ) {
    super(
      'UNDECLARED_NAMESPACE',
      `"${elementName}" öğesi "${namespace}" ad alanında, ama bu ad alanı ` +
        'kök öğede bildirilmemiş. Bildirimi `serializeDocument` ' +
        'seçeneklerindeki `prefixes` haritasına ekleyin.',
    )
  }
}

/**
 * Ayrıştırılan XML iyi-biçimli değil.
 *
 * Konum bilgisi (satır, sütun, ofset) her zaman doldurulur: bir e-belge
 * onlarca kilobayt olabilir ve "beklenmeyen karakter" mesajı konum olmadan
 * kullanışsızdır.
 *
 * @example
 * ```ts
 * parseDocument('<Invoice><cbc:ID>1</cbc:Name></Invoice>')
 * // → XmlSyntaxError { line: 1, column: 26, message: '… kapanış etiketi …' }
 * ```
 */
export class XmlSyntaxError extends UblTrError {
  /**
   * @param detail - Neyin beklendiğini anlatan açıklama
   * @param offset - Girdideki sıfır tabanlı karakter konumu
   * @param line - Bir tabanlı satır numarası
   * @param column - Bir tabanlı sütun numarası
   */
  constructor(
    /** Neyin beklendiğini anlatan açıklama. */
    public readonly detail: string,
    /** Girdideki sıfır tabanlı karakter konumu. */
    public readonly offset: number,
    /** Bir tabanlı satır numarası. */
    public readonly line: number,
    /** Bir tabanlı sütun numarası. */
    public readonly column: number,
  ) {
    super(
      'XML_SYNTAX',
      `XML ayrıştırma hatası (satır ${String(line)}, sütun ${String(column)}): ${detail}`,
    )
  }
}

/**
 * Belgede `<!DOCTYPE …>` bildirimi var.
 *
 * Bu ayrıştırıcı DTD'yi **hiç desteklemez** ve bunu bir eksiklik değil,
 * güvenlik kararı olarak yapar. DTD, XML'in bilinen saldırı yüzeylerinin
 * neredeyse tamamının girişidir: harici varlıklar (XXE) ile yerel dosya
 * okuma ve SSRF, iç içe varlık bildirimleriyle üstel bellek tüketimi
 * (billion laughs), karesel şişme.
 *
 * Varlıkları "sınırlı biçimde" desteklemek yerine bildirimi tümden
 * reddetmek, bu sınıfın tamamını ortadan kaldırır. Geçerli bir UBL-TR
 * e-belgesinde DTD bulunmaz.
 *
 * @example
 * ```ts
 * parseDocument('<!DOCTYPE Invoice [<!ENTITY a "x">]><Invoice/>')
 * // → DoctypeNotAllowedError
 * ```
 */
export class DoctypeNotAllowedError extends UblTrError {
  /**
   * @param offset - Bildirimin girdideki konumu
   */
  constructor(
    /** Bildirimin girdideki konumu. */
    public readonly offset: number,
  ) {
    super(
      'DOCTYPE_NOT_ALLOWED',
      'Belgede DOCTYPE bildirimi var. Bu ayrıştırıcı DTD desteklemez: ' +
        'harici varlık (XXE), varlık genişletme ve karesel şişme saldırılarının ' +
        'tamamı DTD üzerinden gelir. Geçerli bir UBL-TR belgesinde DTD bulunmaz.',
    )
  }
}

/**
 * Belge, yapılandırılan sınırlardan birini aştı.
 *
 * Sınırlar varsayılan olarak açıktır. Bir e-belge ticari partnerden gelir;
 * boyutunu ve derinliğini gönderen belirler. Sınırsız özyineleme yığın
 * taşmasına, sınırsız boyut bellek tükenmesine yol açar — ikisi de hizmet
 * dışı bırakma yüzeyidir.
 *
 * @example
 * ```ts
 * parseDocument(cokDerinXml, { maxDepth: 50 })
 * // → XmlLimitExceededError { limit: 'depth', value: 51, maximum: 50 }
 * ```
 */
export class XmlLimitExceededError extends UblTrError {
  /**
   * @param limit - Aşılan sınırın türü
   * @param value - Ulaşılan değer
   * @param maximum - İzin verilen üst sınır
   */
  constructor(
    /** Aşılan sınırın türü. */
    public readonly limit: 'depth' | 'size',
    /** Ulaşılan değer. */
    public readonly value: number,
    /** İzin verilen üst sınır. */
    public readonly maximum: number,
  ) {
    super(
      'XML_LIMIT_EXCEEDED',
      `${limit === 'depth' ? 'İç içe geçme derinliği' : 'Belge boyutu'} sınırı aşıldı: ` +
        `${String(value)} > ${String(maximum)}.`,
    )
  }
}

/**
 * Bir öğe ya da öznitelik, bildirilmemiş bir ad alanı ön eki kullanıyor.
 *
 * Ön ek sessizce yok sayılmaz. Sessiz yok sayma, `cbc:ID` ile `cac:ID`
 * öğelerinin aynı şeye dönüşmesi demektir — incelenen ayrıştırıcıların
 * ikisi de `removeNSPrefix` ile tam olarak bunu yapıyor.
 *
 * @example
 * ```ts
 * parseDocument('<Invoice xmlns="urn:x"><cbc:ID>1</cbc:ID></Invoice>')
 * // → UnboundPrefixError { prefix: 'cbc' }
 * ```
 */
export class UnboundPrefixError extends UblTrError {
  /**
   * @param prefix - Bağlanmamış ön ek
   * @param qualifiedName - Ön eki kullanan nitelikli ad
   */
  constructor(
    /** Bağlanmamış ön ek. */
    public readonly prefix: string,
    /** Ön eki kullanan nitelikli ad. */
    public readonly qualifiedName: string,
  ) {
    super(
      'UNBOUND_PREFIX',
      `"${qualifiedName}" adındaki "${prefix}" ön eki hiçbir ad alanına bağlı değil. ` +
        'Ön ek, öğenin kendisinde ya da atalarından birinde `xmlns:' +
        `${prefix}="…"` +
        '` ile bildirilmelidir.',
    )
  }
}

/**
 * Bir öğe hem metin hem alt öğe içeriyor (karışık içerik).
 *
 * UBL-TR'de karışık içerik kullanılmaz ve bu kütüphanenin öğe modeli buna
 * izin vermez: bir öğe ya metin taşır ya alt öğe. Girintili bir belgedeki
 * boşluk-metin düğümleri karışık içerik sayılmaz, sessizce atılır.
 *
 * @example
 * ```ts
 * parseDocument('<Invoice>metin<cbc:ID>1</cbc:ID></Invoice>')
 * // → MixedContentError { elementName: 'Invoice' }
 * ```
 */
export class MixedContentError extends UblTrError {
  /**
   * @param elementName - Karışık içerik taşıyan öğenin nitelikli adı
   * @param offset - Sorunlu metnin girdideki konumu
   */
  constructor(
    /** Karışık içerik taşıyan öğenin nitelikli adı. */
    public readonly elementName: string,
    /** Sorunlu metnin girdideki konumu. */
    public readonly offset: number,
  ) {
    super(
      'MIXED_CONTENT',
      `"${elementName}" öğesi hem metin hem alt öğe içeriyor. UBL-TR'de karışık ` +
        'içerik kullanılmaz; bu belge beklenen yapıda değil.',
    )
  }
}
