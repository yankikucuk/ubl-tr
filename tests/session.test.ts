/**
 * Oturum katmanının testleri.
 *
 * `session` üç kardeş katmanı birden kullanır (builders, validators,
 * parsers); bu yüzden testleri de katmanlar arası dizinde durur.
 */
import { describe, expect, it, vi } from 'vitest'

import type { InvoiceInput } from '../src/builders/invoice.js'
import type { CodeTables } from '../src/constants/index.js'
import { InvoiceProfile, InvoiceType } from '../src/constants/index.js'
import { formatAmount } from '../src/documents/index.js'
import {
  allowedProfilesForType,
  allowedTypesForProfile,
  availableExemptions,
  availableWithholdings,
  deriveFieldVisibility,
  deriveLineFieldVisibility,
  filterProfilesByLiability,
  filterTypesByLiability,
  resolveProfileForType,
} from '../src/session/field-visibility.js'
import { InvoiceSession } from '../src/session/invoice-session.js'
import { suggest, SUGGESTION_RULES } from '../src/session/suggestion.js'

const girdi = (over: Partial<InvoiceInput> = {}): InvoiceInput => ({
  id: 'ABC2026000000001',
  uuid: '1a2b3c4d-0001-4000-8001-000000000001',
  issueDate: '2026-09-06',
  profile: InvoiceProfile.TEMEL,
  type: InvoiceType.SATIS,
  supplier: {
    taxNumber: '7857313547',
    name: 'Satıcı A.Ş.',
    taxOffice: 'Üsküdar',
    address: { district: 'Üsküdar', city: 'İstanbul' },
  },
  customer: {
    taxNumber: '0149537825',
    name: 'Alıcı Ltd.',
    address: { district: 'Kadıköy', city: 'İstanbul' },
  },
  lines: [{ name: 'Ürün', quantity: 10, unitPrice: 100, vatRate: 20 }],
  ...over,
})

describe('alan görünürlüğü', () => {
  it('iade atfını yalnızca iade tiplerinde gösterir', () => {
    expect(deriveFieldVisibility({ type: InvoiceType.IADE }).billingReference).toBe(true)
    expect(deriveFieldVisibility({ type: InvoiceType.SATIS }).billingReference).toBe(false)
  })

  it('tevkifat seçicisini şematronun izin verdiği tiplerde açar', () => {
    // TEVKIFATIADE tevkifat TAŞIYAMAZ — GİB'in
    // `GeneralWithholdingTaxTotalCheck` kuralı bu tipi kabul etmez.
    // Sahadaki doğru yapı: tip IADE + kalemlerde tevkifat kodu.
    expect(deriveFieldVisibility({ type: InvoiceType.TEVKIFAT }).withholdingCode).toBe(true)
    expect(deriveFieldVisibility({ type: InvoiceType.IADE }).withholdingCode).toBe(true)
    expect(deriveFieldVisibility({ type: InvoiceType.TEVKIFAT_IADE }).withholdingCode).toBe(false)
  })

  it('döviz kuru alanını para birimine göre açar', () => {
    expect(deriveFieldVisibility({ currencyCode: 'TRY' }).exchangeRate).toBe(false)
    expect(deriveFieldVisibility({ currencyCode: 'EUR' }).exchangeRate).toBe(true)
  })

  it('profile özgü alanları açar', () => {
    expect(deriveFieldVisibility({ profile: InvoiceProfile.KAMU }).buyerCustomer).toBe(true)
    expect(deriveFieldVisibility({ profile: InvoiceProfile.HKS }).itemIdentifications).toBe(true)
    expect(deriveFieldVisibility({ profile: InvoiceProfile.YATIRIM_TESVIK }).itemDetails).toBe(true)
    expect(deriveFieldVisibility({ type: InvoiceType.SARJ }).invoicePeriod).toBe(true)
    expect(deriveFieldVisibility({ profile: InvoiceProfile.YOLCU_BERABER }).taxRepresentative).toBe(
      true,
    )
  })

  it('satır görünürlüğü belge görünürlüğünden türer', () => {
    const satir = deriveLineFieldVisibility({ profile: InvoiceProfile.IHRACAT })
    expect(satir.delivery).toBe(true)
    expect(satir.discount).toBe(true)
  })
})

describe('kullanılabilir değerler', () => {
  it('tipe göre profilleri filtreler', () => {
    // İade temel faturayla düzenlenir; ticari faturada iade yoktur.
    const iade = allowedProfilesForType(InvoiceType.IADE)
    expect(iade).toContain(InvoiceProfile.TEMEL)
    expect(iade).not.toContain(InvoiceProfile.TICARI)
  })

  it('profile göre tipleri filtreler', () => {
    expect(allowedTypesForProfile(InvoiceProfile.IHRACAT)).toEqual([InvoiceType.ISTISNA])
  })

  it('muafiyet kodlarını tipe göre filtreler', () => {
    // Yanlış tipte muafiyet kodu GİB tarafından reddedilir.
    const ihrac = availableExemptions(InvoiceType.IHRAC_KAYITLI)
    expect(ihrac.every((e) => e.documentType === 'IHRACKAYITLI')).toBe(true)
    expect(ihrac.map((e) => e.code)).toContain('702')
    expect(availableExemptions(InvoiceType.ISTISNA).length).toBeGreaterThan(50)
  })

  it('tevkifat taşıyamayan tipte boş liste verir', () => {
    expect(availableWithholdings(InvoiceType.TEVKIFAT)).toHaveLength(52)
    expect(availableWithholdings(InvoiceType.TEVKIFAT_IADE)).toHaveLength(0)
  })
})

describe('öneriler', () => {
  const idler = (input: InvoiceInput): string[] => suggest(input).map((s) => s.id)

  it('yabancı parada kuru hatırlatır', () => {
    expect(idler(girdi({ currencyCode: 'EUR' }))).toContain('doviz/kur-zorunlu')
    expect(idler(girdi())).not.toContain('doviz/kur-zorunlu')
  })

  it('tevkifat kodu varken tipi düzeltmeyi önerir', () => {
    const o = suggest(
      girdi({
        lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: 20, withholdingCode: '603' }],
      }),
    ).find((s) => s.id === 'tevkifat/kod-tip-uyumu')
    expect(o?.value).toBe(InvoiceType.TEVKIFAT)
    expect(o?.severity).toBe('recommended')
  })

  it('tevkifatlı iadede tipi TEVKIFAT önermez', () => {
    // Doğru yapı IADE tipidir; öneri buna saygı gösterir.
    expect(
      idler(
        girdi({
          type: InvoiceType.IADE,
          billingReference: { id: 'ABC2026000000000', issueDate: '2026-08-01' },
          lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: 20, withholdingCode: '603' }],
        }),
      ),
    ).not.toContain('tevkifat/kod-tip-uyumu')
  })

  it('sıfır KDV’de muafiyet kodu hatırlatır ama gerekmeyen tiplerde susar', () => {
    expect(
      idler(girdi({ lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: 0 }] })),
    ).toContain('kdv/sifir-kdv-muafiyet-kodu')
    expect(
      idler(
        girdi({
          type: InvoiceType.SGK,
          lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: 0 }],
        }),
      ),
    ).not.toContain('kdv/sifir-kdv-muafiyet-kodu')
  })

  it('profile özgü eksikleri işaret eder', () => {
    expect(idler(girdi({ profile: InvoiceProfile.KAMU }))).toContain('kamu/araci-alici')
    expect(idler(girdi({ profile: InvoiceProfile.HKS, type: InvoiceType.HKS_SATIS }))).toContain(
      'hks/kunye-numarasi',
    )
    expect(idler(girdi({ profile: InvoiceProfile.YATIRIM_TESVIK }))).toContain(
      'yatirim-tesvik/kalem-ayrintilari',
    )
    expect(idler(girdi({ type: InvoiceType.SARJ, profile: InvoiceProfile.ENERJI }))).toContain(
      'enerji/donem-ve-plaka',
    )
  })

  it('kendi kuralı eklenebilir', () => {
    const oneriler = suggest(girdi(), [
      ...SUGGESTION_RULES,
      {
        id: 'sirket/musteri-no',
        run: () => [
          {
            id: 'sirket/musteri-no',
            path: 'customer.identifications',
            reason: 'Müşteri numarası eklenmeli.',
            severity: 'optional' as const,
          },
        ],
      },
    ])
    expect(oneriler.map((s) => s.id)).toContain('sirket/musteri-no')
  })

  it('geçersiz KDV oranında çökmez, sıfır saymaz', () => {
    // Öneri motoru kullanıcı hâlâ yazarken çalışır; yarım kalmış bir
    // sayı alanı öneriyi değil, yalnızca o kuralı susturur.
    expect(
      idler(girdi({ lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: '%20' }] })),
    ).not.toContain('kdv/sifir-kdv-muafiyet-kodu')
  })

  it('702 muafiyet kodunda gümrük bilgilerini ayrı ayrı ister', () => {
    const eksik = suggest(
      girdi({
        type: InvoiceType.IHRAC_KAYITLI,
        lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: 0, exemptionCode: '702' }],
      }),
    ).filter((s) => s.id === 'ihrackayitli/702-gumruk-bilgisi')
    expect(eksik.map((s) => s.path)).toEqual([
      'lines[0].delivery.customsTariffNumber',
      'lines[0].delivery.customsDeclaration',
    ])
  })

  it('gümrük bilgileri tamsa 702 önerisi susar', () => {
    expect(
      idler(
        girdi({
          type: InvoiceType.IHRAC_KAYITLI,
          lines: [
            {
              name: 'x',
              quantity: 1,
              unitPrice: 100,
              vatRate: 0,
              exemptionCode: '702',
              delivery: {
                customsTariffNumber: '620342000010',
                customsDeclaration: {
                  issuerParty: { taxNumber: '7857313547', name: 'Gümrük Müşavirliği A.Ş.' },
                },
              },
            },
          ],
        }),
      ),
    ).not.toContain('ihrackayitli/702-gumruk-bilgisi')
  })

  it('702 dışındaki muafiyet kodunda gümrük bilgisi istemez', () => {
    expect(
      idler(
        girdi({
          type: InvoiceType.IHRAC_KAYITLI,
          lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: 0, exemptionCode: '701' }],
        }),
      ),
    ).not.toContain('ihrackayitli/702-gumruk-bilgisi')
  })

  it('ihracatta teslim şeklini isteğe bağlı olarak önerir', () => {
    const o = suggest(girdi({ profile: InvoiceProfile.IHRACAT, type: InvoiceType.ISTISNA })).find(
      (s) => s.id === 'ihracat/teslim-sarti',
    )
    expect(o?.severity).toBe('optional')
    expect(
      idler(
        girdi({
          profile: InvoiceProfile.IHRACAT,
          type: InvoiceType.ISTISNA,
          lines: [
            {
              name: 'x',
              quantity: 1,
              unitPrice: 100,
              vatRate: 0,
              delivery: { deliveryTermCode: 'FOB' },
            },
          ],
        }),
      ),
    ).not.toContain('ihracat/teslim-sarti')
  })

  it('şarj faturasında dönem, plaka ve ESU raporunu ayrı ayrı ister', () => {
    const yollar = suggest(girdi({ type: InvoiceType.SARJ, profile: InvoiceProfile.ENERJI }))
      .filter((s) => s.id === 'enerji/donem-ve-plaka')
      .map((s) => s.path)
    expect(yollar).toEqual(['invoicePeriod', 'customer.identifications', 'additionalDocuments'])
  })

  it('anlık şarjda ESU raporu istemez', () => {
    // ESU raporu yalnızca SARJ tipinde zorunlu; SARJIANLIK'ta yoktur.
    const yollar = suggest(girdi({ type: InvoiceType.SARJ_ANLIK, profile: InvoiceProfile.ENERJI }))
      .filter((s) => s.id === 'enerji/donem-ve-plaka')
      .map((s) => s.path)
    expect(yollar).not.toContain('additionalDocuments')
  })

  it('şarj bilgileri tamsa susar', () => {
    expect(
      idler(
        girdi({
          type: InvoiceType.SARJ,
          profile: InvoiceProfile.ENERJI,
          invoicePeriod: { startDate: '2026-09-01', endDate: '2026-09-30' },
          customer: {
            taxNumber: '0149537825',
            name: 'Alıcı Ltd.',
            address: { district: 'Kadıköy', city: 'İstanbul' },
            identifications: [{ schemeId: 'PLAKA', value: '34ABC123' }],
          },
          additionalDocuments: [{ id: 'ESU-2026-1', schemeId: 'ESURaporID' }],
        }),
      ),
    ).not.toContain('enerji/donem-ve-plaka')
  })

  it('yatırım teşvikte makine kaleminde marka ve modeli ister', () => {
    const yollar = suggest(
      girdi({
        profile: InvoiceProfile.YATIRIM_TESVIK,
        type: InvoiceType.YTB_SATIS,
        lines: [
          {
            name: 'Torna tezgâhı',
            quantity: 1,
            unitPrice: 100,
            vatRate: 0,
            classificationCode: '01',
          },
        ],
      }),
    )
      .filter((s) => s.id === 'yatirim-tesvik/kalem-ayrintilari')
      .map((s) => s.path)
    // Belge düzeyinde teşvik belgesi numarası, kalem düzeyinde marka/model.
    expect(yollar).toEqual(['contractDocument', 'lines[0].brandName', 'lines[0].modelName'])
  })

  it('inşaat harcamasında marka model istemez', () => {
    // Harcama tipi 02 inşaattır; markası modeli olmaz. Teşvik belgesi
    // numarası kalem tipinden bağımsız olarak beklenir.
    const yollar = suggest(
      girdi({
        profile: InvoiceProfile.YATIRIM_TESVIK,
        type: InvoiceType.YTB_SATIS,
        contractDocument: { id: 'YTB-2026-0042', schemeId: 'YTBNO' },
        lines: [
          {
            name: 'Beton dökümü',
            quantity: 1,
            unitPrice: 100,
            vatRate: 0,
            classificationCode: '02',
          },
        ],
      }),
    ).map((s) => s.id)
    expect(yollar).not.toContain('yatirim-tesvik/kalem-ayrintilari')
  })

  it('YTB tipinde profil yatırım teşvik olmasa da kural işler', () => {
    // Kapsam profille sınırlı değil: YTB tip grubu da tetikler.
    expect(
      idler(girdi({ profile: InvoiceProfile.TEMEL, type: InvoiceType.YTB_ISTISNA })),
    ).toContain('yatirim-tesvik/kalem-ayrintilari')
  })

  it('künye numarası girilmişse HKS önerisi susar', () => {
    expect(
      idler(
        girdi({
          profile: InvoiceProfile.HKS,
          type: InvoiceType.HKS_SATIS,
          lines: [
            {
              name: 'x',
              quantity: 1,
              unitPrice: 100,
              vatRate: 20,
              additionalIdentifications: [{ schemeId: 'KUNYENO', value: 'KUN-2026-042-DOM001' }],
            },
          ],
        }),
      ),
    ).not.toContain('hks/kunye-numarasi')
  })

  it('iade faturasında asıl faturaya atıf ister', () => {
    expect(idler(girdi({ type: InvoiceType.IADE }))).toContain('iade/asil-fatura-atfi')
    expect(
      idler(
        girdi({
          type: InvoiceType.IADE,
          billingReference: { id: 'ABC2026000000000', issueDate: '2026-08-01' },
        }),
      ),
    ).not.toContain('iade/asil-fatura-atfi')
  })

  it('tevkifat kodunun adını ve oranını bilgi olarak verir', () => {
    const o = suggest(
      girdi({
        type: InvoiceType.TEVKIFAT,
        lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: 20, withholdingCode: '603' }],
      }),
    ).find((s) => s.id === 'tevkifat/oran-bilgisi')
    expect(o?.severity).toBe('optional')
    expect(o?.value).toBe('603')
    expect(o?.reason).toMatch(/%\d/)
  })

  it('tanımsız tevkifat kodunda oran bilgisi uydurmaz', () => {
    // Bilinmeyen kodu geçersiz sayan ayrı bir kural var; bu kural
    // yalnızca susar, yanlış bir oran yazmaz.
    const oneriler = suggest(
      girdi({
        type: InvoiceType.TEVKIFAT,
        lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: 20, withholdingCode: '999' }],
      }),
    ).map((s) => s.id)
    expect(oneriler).not.toContain('tevkifat/oran-bilgisi')
    expect(oneriler).toContain('tevkifat/gecersiz-kod')
  })
})

describe('oturum', () => {
  it('başlangıç durumunu türetir', () => {
    const o = new InvoiceSession(girdi())
    expect(o.state.valid).toBe(true)
    expect(formatAmount(o.state.totals?.payableAmount ?? o.state.totals!.vatTotalAmount)).toBe(
      '1200.00',
    )
    expect(o.state.lineFields).toHaveLength(1)
  })

  it('doğrulamayı GİRDİ üzerinde değil ÜRETİLEN BELGE üzerinde yapar', () => {
    // Girdiyi denetleyen bir tasarım, belgeye dönüşürken ortaya çıkan
    // hataları göremez. Kamu profilinde aracı alıcı eksikliği ancak
    // belgede görülür.
    const o = new InvoiceSession(girdi({ profile: InvoiceProfile.KAMU }))
    expect(o.state.valid).toBe(false)
    expect(o.state.issues.map((i) => i.code)).toContain('KAMU_MISSING_BUYER_CUSTOMER')
  })

  it('kısmi yamayı derin birleştirir', () => {
    const o = new InvoiceSession(girdi())
    o.patch({ supplier: { taxOffice: 'Kadıköy' } })
    expect(o.input.supplier.taxOffice).toBe('Kadıköy')
    // Diğer taraf alanları korunur.
    expect(o.input.supplier.name).toBe('Satıcı A.Ş.')
    expect(o.input.supplier.address?.city).toBe('İstanbul')
  })

  it('tutarları her değişiklikte yeniden hesaplar', () => {
    const o = new InvoiceSession(girdi())
    expect(formatAmount(o.state.totals!.payableAmount)).toBe('1200.00')
    o.patch({ type: InvoiceType.TEVKIFAT })
    o.setLine(0, { withholdingCode: '603' })
    expect(formatAmount(o.state.totals!.payableAmount)).toBe('1060.00')
  })

  it('satır ekler, günceller ve siler', () => {
    const o = new InvoiceSession(girdi())
    o.addLine({ name: 'İkinci', quantity: 2, unitPrice: 50, vatRate: 10 })
    expect(o.state.input.lines).toHaveLength(2)
    expect(o.state.lineFields).toHaveLength(2)
    o.setLine(1, { vatRate: 20 })
    expect(o.state.input.lines[1]?.vatRate).toBe(20)
    expect(o.state.input.lines[1]?.name).toBe('İkinci')
    o.removeLine(0)
    expect(o.state.input.lines).toHaveLength(1)
    expect(o.state.input.lines[0]?.name).toBe('İkinci')
  })

  it('geçersiz satır sırasını reddeder', () => {
    const o = new InvoiceSession(girdi())
    expect(() => o.setLine(5, { vatRate: 1 })).toThrow(RangeError)
    expect(() => o.removeLine(5)).toThrow(RangeError)
  })

  it('değişiklikleri dinletir ve bırakılabilir', () => {
    const o = new InvoiceSession(girdi())
    const dinleyici = vi.fn()
    const birak = o.subscribe(dinleyici)
    o.patch({ currencyCode: 'EUR' })
    o.addLine({ name: 'x', quantity: 1, unitPrice: 1, vatRate: 20 })
    expect(dinleyici).toHaveBeenCalledTimes(2)
    birak()
    o.removeLine(1)
    expect(dinleyici).toHaveBeenCalledTimes(2)
  })

  it('kurulamayan belgeyi bulguya çevirir, çökmez', () => {
    const o = new InvoiceSession(girdi({ lines: [] }))
    expect(o.state.valid).toBe(false)
    expect(o.state.issues[0]?.code).toBe('NO_LINES')
    expect(o.state.issues[0]?.path).toBe('lines')
    expect(o.state.totals).toBeUndefined()
  })

  it('kalem hatasını satır yoluyla birlikte verir', () => {
    const o = new InvoiceSession(
      girdi({
        lines: [
          { name: 'a', quantity: 1, unitPrice: 100, vatRate: 20 },
          { name: 'b', quantity: 1, unitPrice: 100, vatRate: 20, withholdingCode: '999' },
        ],
      }),
    )
    expect(o.state.issues[0]?.code).toBe('UNKNOWN_WITHHOLDING_CODE')
    expect(o.state.issues[0]?.path).toBe('lines[1].withholdingCode')
  })

  it('beklenmeyen hata BUILD_FAILED olarak kalır', () => {
    // Alan yolu bilinmeyen hatalar uydurulmuş bir yola bağlanmaz.
    const o = new InvoiceSession(
      girdi({ lines: [{ name: 'x', quantity: 1, unitPrice: 'yüz lira', vatRate: 20 }] }),
    )
    expect(o.state.issues[0]?.code).toBe('BUILD_FAILED')
    expect(o.state.issues[0]?.path).toBe('input')
  })

  it('XML üretir', () => {
    const o = new InvoiceSession(girdi())
    expect(o.toXml()).toContain('<cbc:ID>ABC2026000000001</cbc:ID>')
    expect(o.build().root.name).toBe('Invoice')
  })

  it('görünürlük ve kullanılabilir değerler durumla birlikte güncellenir', () => {
    const o = new InvoiceSession(girdi())
    expect(o.state.fields.withholdingCode).toBe(false)
    expect(o.state.availableWithholdings).toHaveLength(0)
    o.patch({ type: InvoiceType.TEVKIFAT })
    expect(o.state.fields.withholdingCode).toBe(true)
    expect(o.state.availableWithholdings).toHaveLength(52)
  })
})

describe('mükellefiyet durumu', () => {
  it('e-Arşiv mükellefinde yalnızca e-Arşiv profili kalır', () => {
    // Alıcı GİB mükellef listesinde değilse e-Fatura düzenlenemez.
    const p = allowedProfilesForType(InvoiceType.SATIS, 'earchive')
    expect(p).toEqual([InvoiceProfile.EARSIV])
  })

  it('e-Fatura mükellefinde e-Arşiv profili düşer', () => {
    const p = allowedProfilesForType(InvoiceType.SATIS, 'einvoice')
    expect(p).not.toContain(InvoiceProfile.EARSIV)
    expect(p).toContain(InvoiceProfile.TEMEL)
  })

  it('ihracat profili yalnızca ihracat oturumunda kalır', () => {
    // İhracat faturası e-Fatura mükellefine düzenlenir ama ayrı bir
    // akıştır; oturum ihracat değilse listede görünmemeli.
    expect(allowedProfilesForType(InvoiceType.ISTISNA, 'einvoice')).not.toContain(
      InvoiceProfile.IHRACAT,
    )
    expect(allowedProfilesForType(InvoiceType.ISTISNA, 'einvoice', true)).toContain(
      InvoiceProfile.IHRACAT,
    )
  })

  it('mükellefiyet verilmezse hiçbir şey süzülmez', () => {
    // Kütüphane alıcının mükellef olup olmadığını TAHMİN ETMEZ.
    const hepsi = allowedProfilesForType(InvoiceType.SATIS)
    expect(hepsi).toContain(InvoiceProfile.EARSIV)
    expect(hepsi).toContain(InvoiceProfile.TEMEL)
    expect(filterProfilesByLiability(hepsi)).toEqual(hepsi)
    expect(filterTypesByLiability(allowedTypesForProfile(InvoiceProfile.TEMEL))).toEqual(
      allowedTypesForProfile(InvoiceProfile.TEMEL),
    )
  })

  it('e-Arşiv mükellefinde tipler de e-Arşiv profiline daralır', () => {
    const t = allowedTypesForProfile(InvoiceProfile.TEMEL, 'earchive')
    const earsiv = allowedTypesForProfile(InvoiceProfile.EARSIV)
    expect(t.every((x) => earsiv.includes(x))).toBe(true)
  })

  it('oturum mükellefiyeti seçeneklerden alır ve durumda gösterir', () => {
    const o = new InvoiceSession(girdi(), { liability: 'earchive' })
    expect(o.state.liability).toBe('earchive')
    expect(o.state.allowedProfiles).toEqual([InvoiceProfile.EARSIV])
    expect(new InvoiceSession(girdi()).state.liability).toBeUndefined()
  })

  it('tip değişince uymayan profili çözer', () => {
    // Uyuyorsa dokunulmaz.
    expect(resolveProfileForType(InvoiceProfile.TICARI, InvoiceType.SATIS)).toBe(
      InvoiceProfile.TICARI,
    )
    // Ticari faturada iade yok — Schematron temele düşürür.
    expect(resolveProfileForType(InvoiceProfile.TICARI, InvoiceType.IADE)).toBe(
      InvoiceProfile.TEMEL,
    )
    // Profil yoksa da bir sonuç verir.
    expect(allowedProfilesForType(InvoiceType.ISTISNA)).toContain(
      resolveProfileForType(undefined, InvoiceType.ISTISNA),
    )
  })

  it('mükellefiyet iade çözümünü de kısıtlar', () => {
    // e-Arşivde temel fatura yok; iade kuralı listeyi zorlayamaz.
    expect(resolveProfileForType(InvoiceProfile.TICARI, InvoiceType.IADE, 'earchive')).toBe(
      InvoiceProfile.EARSIV,
    )
  })
})

describe('alan temizleme', () => {
  const atif = { id: 'ABC2026000000000', issueDate: '2026-08-01' }

  it('patch undefined ile alan silemez, clear siler', () => {
    const o = new InvoiceSession(girdi({ type: InvoiceType.IADE, billingReference: atif }))
    // Derin birleştirmede undefined "dokunma" demektir.
    o.patch({ billingReference: undefined })
    expect(o.input.billingReference).toEqual(atif)
    o.clear('billingReference')
    expect(o.input.billingReference).toBeUndefined()
  })

  it('temizlenen alan doğrulamaya alan düzeyinde yansır', () => {
    // Üretim reddedilse bile form hangi alanı işaretleyeceğini bilir:
    // bulgu 'input' değil, eksik alanın kendi yolunu taşır.
    const o = new InvoiceSession(girdi({ type: InvoiceType.IADE, billingReference: atif }))
    expect(o.state.valid).toBe(true)
    o.clear('billingReference')
    expect(o.state.valid).toBe(false)
    expect(o.state.issues).toEqual([
      {
        code: 'MISSING_BILLING_REFERENCE',
        path: 'billingReference',
        severity: 'error',
        message: expect.stringContaining('billingReference'),
      },
    ])
  })

  it('temizlenen alan öneriye de yansır', () => {
    const o = new InvoiceSession(girdi({ currencyCode: 'EUR', exchangeRate: { rate: 36.75 } }))
    expect(o.state.suggestions.map((x) => x.id)).not.toContain('doviz/kur-zorunlu')
    o.clear('exchangeRate')
    expect(o.state.suggestions.map((x) => x.id)).toContain('doviz/kur-zorunlu')
  })

  it('birden çok alanı birlikte temizler', () => {
    const o = new InvoiceSession(
      girdi({ currencyCode: 'EUR', exchangeRate: { rate: 36.75 }, accountingCost: 'MRK-1' }),
    )
    o.clear('exchangeRate', 'accountingCost')
    expect(o.input.exchangeRate).toBeUndefined()
    expect(o.input.accountingCost).toBeUndefined()
  })

  it('olmayan alanı temizlemek dinleyiciyi uyandırmaz', () => {
    const o = new InvoiceSession(girdi())
    const dinleyici = vi.fn()
    o.subscribe(dinleyici)
    o.clear('billingReference')
    o.clearLine(0, 'exemptionCode')
    expect(dinleyici).not.toHaveBeenCalled()
  })

  it('satır alanını temizler', () => {
    const o = new InvoiceSession(
      girdi({
        lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: 0, exemptionCode: '301' }],
      }),
    )
    o.clearLine(0, 'exemptionCode')
    expect(o.input.lines[0]?.exemptionCode).toBeUndefined()
    expect(o.input.lines[0]?.name).toBe('x')
  })

  it('olmayan satırda hata verir', () => {
    expect(() => new InvoiceSession(girdi()).clearLine(5, 'exemptionCode')).toThrow(RangeError)
  })
})

describe('kimlik listesi', () => {
  const kimlikli = (): InvoiceSession =>
    new InvoiceSession(
      girdi({
        customer: {
          taxNumber: '0149537825',
          name: 'Alıcı Ltd.',
          address: { district: 'Kadıköy', city: 'İstanbul' },
          identifications: [
            { schemeId: 'MUSTERINO', value: 'M-1' },
            { schemeId: 'PLAKA', value: '34ABC123' },
          ],
        },
      }),
    )

  it('kaydı siler, sonrakiler kayar', () => {
    const o = kimlikli()
    o.removeIdentification('customer', 0)
    expect(o.input.customer.identifications).toEqual([{ schemeId: 'PLAKA', value: '34ABC123' }])
  })

  it('son kayıt silinince alan tümden kalkar', () => {
    // Boş dizi bırakmak schemeID'siz bir cac:PartyIdentification riski
    // taşır; alanı hiç yazmamak doğru davranıştır.
    const o = kimlikli()
    o.removeIdentification('customer', 1)
    o.removeIdentification('customer', 0)
    expect(o.input.customer.identifications).toBeUndefined()
    expect('identifications' in o.input.customer).toBe(false)
  })

  it('geçersiz sırada bir şey olmaz', () => {
    const o = kimlikli()
    const dinleyici = vi.fn()
    o.subscribe(dinleyici)
    o.removeIdentification('customer', 9)
    o.removeIdentification('customer', -1)
    o.removeIdentification('buyerCustomer', 0)
    expect(dinleyici).not.toHaveBeenCalled()
    expect(o.input.customer.identifications).toHaveLength(2)
  })

  it('listeyi tümüyle değiştirir', () => {
    const o = kimlikli()
    o.setIdentifications('customer', [{ schemeId: 'IDIS', value: 'S-9' }])
    expect(o.input.customer.identifications).toEqual([{ schemeId: 'IDIS', value: 'S-9' }])
    o.setIdentifications('customer', [])
    expect(o.input.customer.identifications).toBeUndefined()
  })

  it('olmayan tarafa yazmaya çalışmak hata verir', () => {
    expect(() => kimlikli().setIdentifications('buyerCustomer', [])).toThrow(RangeError)
  })

  it('kimlik belgeye yazılır', () => {
    const o = kimlikli()
    expect(o.toXml()).toContain('<cbc:ID schemeID="MUSTERINO">M-1</cbc:ID>')
    o.setIdentifications('customer', [])
    expect(o.toXml()).not.toContain('MUSTERINO')
  })
})

describe('kod tablosu geçersiz kılma', () => {
  // GİB yeni bir kod yayımladığında paket sürümü beklemek zorunda
  // kalmamak için; verilen tanımlar gömülü tablonun ÖNÜNE geçer.
  const yeniKod: CodeTables = {
    withholdings: [{ code: '999', name: 'Yeni tevkifat', rate: 50 }],
    exemptions: [{ code: '998', name: 'Yeni istisna', taxType: 'KDV', documentType: 'ISTISNA' }],
  }

  const tevkifatli = (): InvoiceInput =>
    girdi({
      type: InvoiceType.TEVKIFAT,
      lines: [
        { name: 'Hizmet', quantity: 1, unitPrice: 1000, vatRate: 20, withholdingCode: '999' },
      ],
    })

  it('tablosuz belge kurulamaz', () => {
    const o = new InvoiceSession(tevkifatli())
    expect(o.state.valid).toBe(false)
    expect(o.state.issues[0]?.code).toBe('UNKNOWN_WITHHOLDING_CODE')
  })

  it('tabloyla belge kurulur ve oran koddan hesaplanır', () => {
    const o = new InvoiceSession(tevkifatli(), { codeTables: yeniKod })
    expect(o.state.valid).toBe(true)
    // KDV 200; tevkifat %50 → 100. Ödenecek 1200 − 100 = 1100.
    expect(formatAmount(o.state.totals!.withholdingTotalAmount)).toBe('100.00')
    expect(formatAmount(o.state.totals!.payableAmount)).toBe('1100.00')
  })

  it('doğrulama da aynı tabloyu kullanır', () => {
    // Belgeyi bir tabloyla üretip başkasıyla doğrulamak, kendi eklediğin
    // kodu "tanımsız" göstermek demektir. Oturum tabloyu hepsine dağıtır.
    const o = new InvoiceSession(tevkifatli(), { codeTables: yeniKod })
    expect(o.state.issues).toEqual([])
    expect(o.toXml()).toContain('<cbc:TaxTypeCode>999</cbc:TaxTypeCode>')
  })

  it('seçim listelerine de yansır', () => {
    const o = new InvoiceSession(tevkifatli(), { codeTables: yeniKod })
    expect(o.state.availableWithholdings.map((w) => w.code)).toContain('999')
    expect(o.state.availableWithholdings.length).toBe(53)
  })

  it('muafiyet kodu tipe göre süzülmeye devam eder', () => {
    const o = new InvoiceSession(girdi({ type: InvoiceType.ISTISNA }), { codeTables: yeniKod })
    expect(o.state.availableExemptions.map((e) => e.code)).toContain('998')
    // Yanlış tipte görünmez.
    expect(
      new InvoiceSession(girdi({ type: InvoiceType.IHRAC_KAYITLI }), {
        codeTables: yeniKod,
      }).state.availableExemptions.map((e) => e.code),
    ).not.toContain('998')
  })

  it('öneri motoru da tabloyu görür', () => {
    const o = new InvoiceSession(tevkifatli(), { codeTables: yeniKod })
    const oneri = o.state.suggestions.find((x) => x.id === 'tevkifat/oran-bilgisi')
    expect(oneri?.reason).toContain('Yeni tevkifat')
    expect(oneri?.reason).toContain('%50')
  })

  it('gömülü tanımın üzerine yazabilir', () => {
    // Yalnızca ekleme değil, düzeltme de mümkün: 603 gömülü tabloda %70.
    const o = new InvoiceSession(
      girdi({
        type: InvoiceType.TEVKIFAT,
        lines: [{ name: 'x', quantity: 1, unitPrice: 1000, vatRate: 20, withholdingCode: '603' }],
      }),
      { codeTables: { withholdings: [{ code: '603', name: 'Düzeltilmiş', rate: 90 }] } },
    )
    expect(formatAmount(o.state.totals!.withholdingTotalAmount)).toBe('180.00')
  })

  it('tablo verilmezse davranış değişmez', () => {
    const a = new InvoiceSession(girdi()).toXml()
    const b = new InvoiceSession(girdi(), { codeTables: {} }).toXml()
    expect(a).toBe(b)
  })
})

describe('değişiklik ayrıntısı', () => {
  it('her bildirimde önceki girdiyi taşır', () => {
    const o = new InvoiceSession(girdi())
    const gorulen: unknown[] = []
    o.subscribe((state, degisim) => {
      gorulen.push([degisim.kind, degisim.previousInput.type, state.input.type])
    })
    o.patch({ type: InvoiceType.TEVKIFAT })
    expect(gorulen).toEqual([['patch', InvoiceType.SATIS, InvoiceType.TEVKIFAT]])
  })

  it('satır işlemlerinde sırayı ve silinen satırı verir', () => {
    const o = new InvoiceSession(girdi())
    const gorulen: unknown[] = []
    o.subscribe((_s, d) => {
      gorulen.push(d)
    })
    o.addLine({ name: 'İkinci', quantity: 1, unitPrice: 50, vatRate: 10 })
    o.setLine(1, { unitPrice: 60 })
    o.removeLine(1)
    o.setLines([{ name: 'Tek', quantity: 1, unitPrice: 1, vatRate: 20 }])

    expect(gorulen.map((d) => (d as { kind: string }).kind)).toEqual([
      'line-added',
      'line-updated',
      'line-removed',
      'lines-replaced',
    ])
    expect((gorulen[0] as { index: number }).index).toBe(1)
    expect((gorulen[1] as { previousLine: { unitPrice: number } }).previousLine.unitPrice).toBe(50)
    expect((gorulen[2] as { previousLine: { unitPrice: number } }).previousLine.unitPrice).toBe(60)
  })

  it('temizleme ve kimlik değişimini ayırt eder', () => {
    const o = new InvoiceSession(
      girdi({
        currencyCode: 'EUR',
        exchangeRate: { rate: 36.75 },
        customer: {
          taxNumber: '0149537825',
          name: 'Alıcı Ltd.',
          address: { district: 'Kadıköy', city: 'İstanbul' },
          identifications: [{ schemeId: 'MUSTERINO', value: 'M-1' }],
        },
      }),
    )
    const gorulen: unknown[] = []
    o.subscribe((_s, d) => {
      gorulen.push(d)
    })
    o.clear('exchangeRate')
    o.clearLine(0, 'exemptionCode')
    o.removeIdentification('customer', 0)

    // clearLine olmayan alanda çalışmaz, bildirim de göndermez.
    expect(gorulen.map((d) => (d as { kind: string }).kind)).toEqual([
      'cleared',
      'identifications-changed',
    ])
    expect((gorulen[0] as { keys: string[] }).keys).toEqual(['exchangeRate'])
    expect((gorulen[1] as { party: string }).party).toBe('customer')
  })

  it('ayrıntıyı yok sayan dinleyici çalışmayı sürdürür', () => {
    const o = new InvoiceSession(girdi())
    const dinleyici = vi.fn()
    o.subscribe(dinleyici)
    o.patch({ currencyCode: 'EUR' })
    expect(dinleyici).toHaveBeenCalledTimes(1)
  })

  it('ihracat bayrağını durumda gösterir', () => {
    expect(new InvoiceSession(girdi()).state.isExport).toBe(false)
    expect(new InvoiceSession(girdi(), { isExport: true }).state.isExport).toBe(true)
  })
})
