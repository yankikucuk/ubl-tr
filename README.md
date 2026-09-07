# @yankikucuk/ubl-tr

> **Durum: 1.0.0 — kararlı.** e-Fatura ve e-İrsaliye üretimi, okuma,
> doğrulama, XML katmanı (her iki yön), tutar aritmetiği, kimlik doğrulama
> ve etkileşimli oturum hazır. Public API kararlıdır; kırıcı değişiklik
> ana sürüm yükseltir. Kapsam dışı belge türleri (`CreditNote`,
> `ReceiptAdvice`, `ApplicationResponse`) henüz üretilmiyor.

Gelir İdaresi Başkanlığı'nın **UBL-TR 1.2.1** e-belge standardı için sıfır
bağımlılıklı bir TypeScript kütüphanesi: belge üretimi, ayrıştırma ve
doğrulama.

Her iki yön: **XML → JSON** ve **JSON → XML**, kayıpsız gidiş-dönüş
garantisiyle.

Bu kütüphane bir portal istemcisi ya da entegratör SDK'sı **değildir**.
Belgeyi üretir ve okur; nereye göndereceğinize siz karar verirsiniz —
doğrudan entegrasyon, özel entegratör ya da arşiv.

**İmzalamak için** kardeş paket [`@yankikucuk/e-imza`](https://github.com/yankikucuk/e-imza)
var: mali mühürle XAdES imzası atar ve doğrular, yine sıfır bağımlılıkla.
İki paket birbirini import etmez; ayrıntı [aşağıda](#xades-imzalama).

## Neden

UBL-TR, GİB'in UBL 2.1 üzerine tanımladığı Türkiye profilidir ve
e-Fatura'dan e-İrsaliye'ye kadar bütün e-belgelerin ortak dilidir. Şemalar
ve kılavuzlar herkese açık yayımlanıyor; mali mühür yalnızca belgeyi
**imzalamak ve göndermek** için gerekli, **üretmek** için değil.

C# tarafında bu katmanın olgun karşılıkları var. TypeScript tarafında ise
iş üç ayrı, birbirinden habersiz pakete bölünmüş durumda. Bu proje o
parçaları tek bir tutarlı katmanda toplamayı hedefliyor.

## Kapsam

Hedeflenen belge tipleri:

| Belge                     | UBL kök öğesi         |
| ------------------------- | --------------------- |
| e-Fatura / e-Arşiv Fatura | `Invoice`             |
| e-İrsaliye                | `DespatchAdvice`      |
| e-İrsaliye yanıtı         | `ReceiptAdvice`       |
| e-Serbest Meslek Makbuzu  | `Invoice` (profil)    |
| e-Müstahsil Makbuzu       | `Invoice` (profil)    |
| Uygulama yanıtı           | `ApplicationResponse` |

Her belge için üç yön:

- **Üretim** — tipli bir nesneden şemaya uygun, deterministik XML
- **Ayrıştırma** — gelen XML'den tipli nesne
- **Doğrulama** — şema uyumu ve UBL-TR iş kuralları

## Bugün kullanılabilir

### Fatura üretimi

```ts
import { buildInvoiceXml, InvoiceProfile, InvoiceType } from '@yankikucuk/ubl-tr'

const xml = buildInvoiceXml({
  id: 'ABC2026000000001',
  uuid: '1a2b3c4d-0001-4000-8001-000000000001',
  issueDate: '2026-09-06',
  profile: InvoiceProfile.TEMEL,
  type: InvoiceType.TEVKIFAT,
  supplier: {
    taxNumber: '1234567890',
    name: 'Satıcı A.Ş.',
    taxOffice: 'Üsküdar',
    address: { district: 'Üsküdar', city: 'İstanbul' },
  },
  customer: {
    taxNumber: '9876543210',
    name: 'Alıcı Ltd. Şti.',
    address: { district: 'Kadıköy', city: 'İstanbul' },
  },
  lines: [
    { name: 'Bakım-onarım', quantity: 10, unitPrice: 100, vatRate: 20, withholdingCode: '603' },
  ],
})
// KDV 200,00 · tevkifat 140,00 (7/10) · ödenecek 1.060,00
```

**Toplamları çağıran vermez, kütüphane hesaplar.** Toplamların satırlarla
tutarlı olması böylece yapısal bir garantidir; çağıranın verdiği toplama
güvenen bir tasarımda girdi tutarsızsa hata GİB'de ortaya çıkar.

Öğe sırası UBL'nin `xsd:sequence` tanımına uyar ve testlerle sabitlenmiştir
— doğru öğeleri yanlış sırada yazmak belgeyi geçersiz kılar.

Profil ve fatura tipi uyumu denetlenir. GİB bu eşleşmeyi yalnızca Schematron
düzeyinde denetler; XSD denetlemez, yani uyumsuz bir belge `xmllint` ile şema
doğrulamasından geçer ve karşı tarafta reddedilir.

```ts
buildInvoiceXml({ ...girdi, profile: InvoiceProfile.TICARI, type: InvoiceType.IADE })
// → RangeError: "TICARIFATURA" profilinde "IADE" fatura tipi kullanılamaz.
```

#### Belge alanları

Kurucu, UBL-TR faturasının şu bloklarını üretir — hepsi isteğe bağlıdır ve
verilmediğinde öğe hiç yazılmaz:

| Alan                                                              | UBL karşılığı                                      |
| ----------------------------------------------------------------- | -------------------------------------------------- |
| `billingReference` / `billingReferences`                          | `cac:BillingReference` (tekrarlı)                  |
| `despatchDocumentReferences`                                      | `cac:DespatchDocumentReference`                    |
| `receiptDocumentReferences`                                       | `cac:ReceiptDocumentReference`                     |
| `originatorDocumentReferences`                                    | `cac:OriginatorDocumentReference`                  |
| `contractDocument`                                                | `cac:ContractDocumentReference`                    |
| `additionalDocuments[].attachment`                                | `cac:Attachment` — gömülü base64 ve/veya dış adres |
| `paymentMeans` / `paymentTerms`                                   | `cac:PaymentMeans` / `cac:PaymentTerms`            |
| `allowanceCharges`                                                | `cac:AllowanceCharge` — belge düzeyi               |
| `lines[].allowanceCharges`                                        | `cac:AllowanceCharge` — satır düzeyi               |
| `taxCurrencyCode` / `pricingCurrencyCode` / `paymentCurrencyCode` | ilgili `cbc:` kodları                              |
| `exchangeRate` / `taxExchangeRate` / `paymentExchangeRate`        | `cac:*ExchangeRate`                                |
| `signature`                                                       | `cac:Signature` — imzalayan taraf ve imza adresi   |
| `eArchive`                                                        | e-Arşiv ek belgeleri (aşağıda)                     |

##### İskonto ve ek yük

`AllowanceChargeInput` hem indirimi hem masrafı taşır (`isCharge`), ama
etkisi düzeye göre **farklıdır** ve bu bilinçli:

```ts
buildInvoiceXml({
  ...girdi,
  // Satır düzeyi: tutar cbc:LineExtensionAmount'a girer, KDV matrahını
  // da değiştirir. Satırın tek oranı olduğu için iyi tanımlıdır.
  lines: [{ ...satir, allowanceCharges: [{ isCharge: true, amount: 30, reason: 'Montaj' }] }],
  // Belge düzeyi: tutar vergiden SONRA cbc:PayableAmount'a uygulanır.
  // KDV yeniden hesaplanmaz — satırlar farklı oran taşıyabildiğinden
  // hangi oranın azalacağı tanımsızdır.
  allowanceCharges: [{ isCharge: false, amount: 100, reason: 'Yıl sonu primi' }],
})
```

KDV matrahını da düşürmesi gereken bir iskonto **satıra** yazılmalıdır.

##### Özel matrah

KDV, satılan malın bedeli üzerinden değil ayrı bir matrah üzerinden
hesaplanıyorsa (telefon kartı, piyango bileti, ikinci el araç):

```ts
lines: [{ name: 'Kontör', quantity: 1, unitPrice: 100, vatRate: 20, vatBaseAmount: 20 }]
// Satır tutarı 100,00 · KDV matrahı 20,00 · KDV 4,00 · ödenecek 104,00
```

Matrah açıkça verildiğinde ek vergilerin artırıcı/azaltıcı etkisi
**uygulanmaz**: kullanıcı matrahı nihai hâliyle bildirmiştir.

##### e-Arşiv bilgileri

GİB bunları ayrı UBL öğeleriyle değil, belirli `documentTypeCode`
değerleri taşıyan ek belge atıflarıyla ister. Kodları ezberlemek gerekmez:

```ts
buildInvoiceXml({
  ...girdi,
  profile: InvoiceProfile.EARSIV,
  eArchive: {
    sendType: 'ELEKTRONIK',
    onlineSale: {
      storeUrl: 'https://magaza.example',
      paymentMethod: 'KREDIKARTI/BANKAKARTI',
      paymentDate: '2026-09-05',
      deliveryDate: '2026-09-07',
      carrier: { taxNumber: '5555555555', name: 'Kargo A.Ş.' },
    },
    xsltTemplate: base64Xslt,
  },
})
```

`sendType: 'KAGIT'` için öğe **yazılmaz** — GİB kâğıt gönderimi varsayılan
sayar. Eşlemenin ne ürettiğini görmek için `eArchiveDocuments` ve
`onlineSaleDelivery` ayrıca dışa aktarılır.

SGK faturalarında `eArchive.sgk` üç ek belge üretir; açıklamalarda fatura
türünün Türkçe adı geçer (`SAGLIK_ECZ` → "Eczane Adı").

#### Senaryo kapsamı

Kapsam, yaygın bir referans uygulamanın senaryo takımına karşı ölçülüyor:
**37 senaryonun 37'sinde** — 33 fatura, 4 e-İrsaliye — hem tutarlar hem
belge yapısı birebir örtüşüyor.

Kapsanan senaryolar: temel, ticari, kamu, e-Arşiv, HKS, İDİS, ilaç ve
tıbbi cihaz, enerji, yatırım teşvik, ihracat ve yolcu beraberi eşya
profilleri; satış, iade, KDV tevkifatı (52 kod), gelir ve kurumlar
stopajı, istisna (103 kod), ihraç kayıtlı, özel matrah, SGK ve konaklama
vergisi tipleri; çoklu KDV oranı, satır iskontosu, ÖTV ve diğer KDV dışı
vergiler, yabancı para ve döviz kuru, sipariş ve sözleşme atıfları, ödeme
bilgisi, teslim ve gümrük alanları, fatura dönemi, KDV iade aracısı.

### e-İrsaliye üretimi

```ts
import { buildDespatchAdviceXml } from '@yankikucuk/ubl-tr'

const xml = buildDespatchAdviceXml({
  id: 'IRS2026000000001',
  uuid: '1a2b3c4d-0001-4000-8001-000000000001',
  issueDate: '2026-09-06',
  supplier: {
    taxNumber: '1234567890',
    name: 'Gönderen A.Ş.',
    address: { district: 'Üsküdar', city: 'İstanbul' },
  },
  customer: {
    taxNumber: '9876543210',
    name: 'Alıcı Ltd.',
    address: { district: 'Kadıköy', city: 'İstanbul' },
  },
  shipment: {
    actualDespatchDate: '2026-09-06',
    drivers: [{ firstName: 'Mehmet', familyName: 'Sürücü', nationalityId: '12345678901' }],
    licensePlates: [{ plateNumber: '34ABC123' }, { plateNumber: '34DEF456', schemeId: 'DORSE' }],
  },
  lines: [{ quantity: 10, itemName: 'Paketlenmiş Ürün' }],
})
```

e-İrsaliye faturadan bağımsız bir belge tipidir: kök öğesi `DespatchAdvice`,
ad alanı ayrıdır ve tutar taşımaz. Çoklu sürücü, çekici ve dorse plakası,
taşıyıcı firma, taşıma ekipmanı ve matbu irsaliyeden dönüş desteklenir.

Kap bilgisi ve malın beyan değeri de yazılabilir:

```ts
shipment: {
  goodsValue: { amount: 15000 },
  transportHandlingUnits: [
    {
      id: 'TB-1',
      totalPackageQuantity: 12,
      actualPackages: [{ quantity: 12, packagingTypeCode: 'BX' }],
      transportEquipment: [{ id: 'KONT-1' }],
    },
  ],
}
```

Ambalaj cinsi kodları (UN/ECE Rec 21) `PACKAGING_TYPE_DEFINITIONS` ile
listelenir; `packagingTypeDefinition('BX')?.name` → `'Kutu'`.
Referansın 4 e-İrsaliye senaryosunda hem yapı hem öğe sırası örtüşüyor.

### Belge okuma

```ts
import { parseDocument, parseInvoice } from '@yankikucuk/ubl-tr'

const { root } = parseDocument(gelenXml)
const fatura = parseInvoice(root)

fatura.supplier?.name // 'Satıcı A.Ş.'
fatura.lines.length // 3
formatAmount(fatura.totals.payableAmount!) // '1200.00'
fatura.withholdingSubtotals[0]?.code // '603'
```

Okuma tipi yazma tipinden **kasten farklıdır**. Yazarken toplamları
kütüphane hesaplar; okurken belgede yazan ne ise o gelir. İkisini tek tip
yapmak, okunan belgenin toplamlarının doğrulanmış olduğu izlenimi verirdi.

Ayrıştırma hoşgörülüdür: eksik ya da bozuk bir alan `undefined` kalır,
belgenin tamamı okunamaz hâle gelmez. Geçerliliği söylemek doğrulayıcının
işidir. Hiçbir değerin türü tahmin edilmez — tanımlayıcılar `string`,
tutarlar tam `Decimal`.

### Doğrulama

İki katman var ve ikisi de farklı hata sınıfı yakalar.

**Yapısal doğrulama** — alt öğe sırası ve zorunluluk:

```ts
import { validateStructure } from '@yankikucuk/ubl-tr'

const sonuc = validateStructure(root)
sonuc.issues // [{ code: 'ELEMENT_OUT_OF_ORDER', path: 'Invoice/cbc:Note[4]', … }]
```

Bu bir XSD işlemcisi değildir — gerçek şema doğrulaması bir XML şema motoru
ister, o da çalışma zamanı bağımlılığı demektir. Burada XSD'nin yakaladığı
hataların en sık görülen sınıfı denetlenir: UBL `xsd:sequence` kullanır ve
doğru öğeleri yanlış sırada yazmak belgeyi geçersiz kılar.

**İş kuralı doğrulaması** — şemanın göremediği:

```ts
import { validateInvoiceRules } from '@yankikucuk/ubl-tr'

validateInvoiceRules(root).issues
// INVALID_DOCUMENT_NUMBER · PROFILE_TYPE_MISMATCH · WITHHOLDING_RATE_MISMATCH
// MONETARY_TOTAL_MISMATCH · UNKNOWN_UNIT_CODE · HKS_MISSING_KUNYENO
// IHRACKAYITLI_MISSING_CUSTOMS_ID · ENERJI_MISSING_ESU_REPORT · YTB_ZERO_VAT
// NATURAL_PERSON_TAX_SCHEME · KAMU_MISSING_BUYER_CUSTOMER · …
```

Bunlar XSD'nin denetlemediği kurallardır: kod listeleri, tutar tutarlılığı,
profil-tip eşleşmesi, tevkifat kodu ile oranının birlikte doğruluğu. En
bilinen örneği kök `cbc:ID` alanına 16 haneli belge numarası yerine kısa
bir sıra kodu yazılmasıdır — belge `xmllint` ile doğrulanır, GİB reddeder.

**Kural kümesi GİB'in Schematron paketinin tamamı değildir**; kanıtlanabilir
kaynaklardan derlenmiştir ve temiz sonuç kabul garantisi vermez. Referansın
37 belgesinin 37'si her iki doğrulayıcıdan da temiz geçiyor.

### Etkileşimli oturum

Fatura ekranı yazanın işi tek seferlik bir `build()` çağrısı değildir: alan
seçildikçe başka alanlar açılıp kapanır, tutarlar yeniden hesaplanır, eksik
kalanlar kullanıcıya söylenmelidir. `InvoiceSession` bu döngüyü tutar.

```ts
import { InvoiceSession, InvoiceProfile, InvoiceType } from '@yankikucuk/ubl-tr'

const oturum = new InvoiceSession({ profile: InvoiceProfile.TEMEL, type: InvoiceType.SATIS, … })

oturum.subscribe((durum) => ekraniCiz(durum))

oturum.patch({ type: InvoiceType.TEVKIFAT })     // tevkifat alanları açılır
oturum.setLine(0, { withholdingCode: '603' })    // ödenecek tutar düşer

oturum.state.fields.withholdingCode  // true  — alan görünürlüğü
oturum.state.totals.payableAmount    // anlık hesap
oturum.state.issues                  // engelleyen hatalar
oturum.state.suggestions             // engellemeyen öneriler
oturum.state.valid                   // gönderilebilir mi
```

**Doğrulama girdi üzerinde değil, üretilen belge üzerinde yapılır.** Girdiyi
denetleyen bir tasarım, nesne XML'e dönüşürken ortaya çıkan hataları göremez;
oturum her değişiklikte belgeyi gerçekten kurar ve `validateStructure` ile
`validateInvoiceRules` sonuçlarını birleştirir. Ödediği bedel her tuş
vuruşunda bir belge kurulmasıdır; karşılığında ekranda gördüğünüz sonuç,
gönderdiğiniz belgenin sonucudur.

**Alan görünürlüğü** profil ve tipten türer: iade atfı yalnızca iade
tiplerinde, döviz kuru yalnızca TRY dışı para biriminde, aracı alıcı yalnızca
kamu profilinde görünür. Seçim listeleri de daralır — `availableExemptions`
muafiyet kodlarını belge tipine göre süzer, `availableWithholdings` tevkifat
taşıyamayan tiplerde boş liste verir.

**Öneriler** engellemez, işaret eder: sıfır KDV'de muafiyet kodu, ihraç
kayıtlı 702'de GTİP ve alıcı satır kodu, şarj faturasında dönem-plaka-ESU
raporu, yatırım teşvikte harcama tipi ile marka-model. Kendi kuralınızı
`suggest(input, [...SUGGESTION_RULES, kendiKuralim])` ile ekleyebilirsiniz.

**Değişikliğin ne olduğu** dinleyiciye ikinci parametreyle gelir. Tek bir
durum dinleyicisi çoğu form için yeterlidir, ama satır silme animasyonu ya
da "geri al" düğmesi neyin değiştiğini bilmeyi gerektirir:

```ts
oturum.subscribe((state, degisim) => {
  if (degisim.previousInput.type !== state.input.type) tipDegistiUyar()
  if (degisim.kind === 'line-removed') satirSilmeAnimasyonu(degisim.index, degisim.previousLine)
})
```

`(state) => …` yazan bir dinleyici ikinci parametreyi görmezden gelir ve
çalışmayı sürdürür. Ayrı bir olay yayıcı (`EventEmitter`) kullanılmadı —
kütüphanenin çalışma zamanı bağımlılığı yok ve tarayıcıda da çalışıyor.

**Mükellefiyet durumu** listeleri daraltır. Türkiye'de fatura düzenlemenin
ilk kararı budur: alıcı GİB'in e-Fatura mükellef listesinde ise e-Fatura,
değilse e-Arşiv Fatura düzenlenir; yanlış tarafı seçmek belgeyi geçersiz
kılar.

```ts
new InvoiceSession(girdi, { liability: 'earchive' }).state.allowedProfiles
// ['EARSIVFATURA']  — e-Fatura profilleri listeden düşer

// Tip değişince profil hâlâ geçerli mi?
resolveProfileForType(InvoiceProfile.TICARI, InvoiceType.IADE) // 'TEMELFATURA'
// Ters yönü de var: profil değişince tip hâlâ geçerli mi?
resolveTypeForProfile(InvoiceType.IADE, InvoiceProfile.TICARI) // 'SATIS'
```

Kütüphane mükellef listesini **sorgulamaz** — ağ isteği yapmaz. Sonucu siz
verirsiniz; `liability` verilmezse hiçbir şey süzülmez, çünkü kütüphane
alıcının mükellef olup olmadığını tahmin etmez.

**Alan temizleme ayrı bir çağrıdır.** `patch()` derin birleştirme yapar ve
`undefined` "bu alana dokunma" demektir; bir alanı gerçekten kaldırmak için
`clear()` vardır. Kabul ettiği anahtarlar girdi tipinden türer — elle
tutulan bir liste yoktur.

```ts
oturum.patch({ type: InvoiceType.SATIS })
oturum.clear('billingReference') // iade atfı artık anlamsız
oturum.clearLine(0, 'exemptionCode') // satır düzeyinde
```

**Üretim reddedilse bile geri bildirim alan düzeyindedir.** Doğrulama
üretilen belge üzerinde yapıldığı için, belge hiç kurulamadığında geri
bildirimin de kaybolması beklenirdi. Kurucular bunun için `code` ve `path`
taşıyan `DocumentInputError` fırlatır (`RangeError`'dan türer, mevcut
`instanceof` denetimleri bozulmaz); oturum bu iki alanı doğrudan bulguya
taşır:

```ts
oturum.state.issues
// [{ code: 'UNKNOWN_WITHHOLDING_CODE', path: 'lines[1].withholdingCode', … }]
```

**Alanı yoluyla değiştirmek.** Genel bir form bileşeni alanının yolunu
bilir ama tipini bilmez. `setPath` ikisini birleştirir ve değerin tipi
**derleme zamanında** denetlenir:

```ts
import { linePath } from '@yankikucuk/ubl-tr'

oturum.setPath('currencyCode', 'USD')
oturum.setPath(linePath(0, 'vatRate'), 10)
oturum.setPath(linePath(0, 'vatRate'), 'yirmi') // ✗ derlenmez
```

Yol yazımı doğrulama bulgularınınkiyle aynıdır — bir bulgunun `path`
değeri doğrudan `getPath`/`setPath`'e verilebilir, form alanı ile bulgu tek
anahtarla eşleşir. Yollar tipten türer; girdiye yeni bir alan eklendiğinde
yol kümesi kendiliğinden genişler, senkron tutan bir kod üretim adımı yok.

**Önerilerin farkı.** Her tuş vuruşunda tüm listeyi yeniden çizmek yerine
yalnızca değişeni vurgulamak için:

```ts
diffSuggestions(oncekiOneriler, oturum.state.suggestions)
// { added: [...], removed: [...], kept: [...] }
```

Anahtar kimlik **ve** yoldur: aynı kural iki satır için ateşlendiğinde
bunlar ayrı önerilerdir. Gerekçe metni anahtara girmez — metnin
düzeltilmesi öneriyi "yeni" göstermemelidir.

### Kod tablolarını genişletmek

GİB kod listelerini kendi takvimine göre günceller. Bir kütüphane sürümünü
beklemek sahada gerçek bir engeldir: kod tanınmadığı için belge **hiç
üretilemez**. Verdiğiniz tanımlar gömülü tablonun önüne geçer — yeni kod
eklenebilir, var olan bir tanım düzeltilebilir.

```ts
const tablolar = {
  withholdings: [{ code: '999', name: 'Yeni tevkifat', rate: 50 }],
}

new InvoiceSession(girdi, { codeTables: tablolar })
// hesaplama, üretim, doğrulama, öneriler ve seçim listeleri — hepsi aynı tabloyu görür
```

Tablo **çağrı başına** verilir, süreç genelinde değişen bir tekil nesneyle
değil. Sebebi üç tane: aynı süreçte birden çok kiracıya farklı tablo
verilebilir; `withholdingDefinition('603')` saf kalır, süreç ömrü boyunca
aynı sonucu verir; ve `EventEmitter` gerekmediği için kütüphane tarayıcıda
çalışmayı sürdürür.

Aynı seçenek `buildInvoiceXml(girdi, { codeTables })` ve
`validateInvoiceRules(root, { codeTables })` için de geçerlidir — belgeyi
bir tabloyla üretip başkasıyla doğrulamak, kendi eklediğiniz kodu
"tanımsız" göstermek olurdu.

### Vergi kimliği doğrulama

VKN ve TCKN'nin **kontrol basamaklarını** doğrular. İncelediğimiz üç UBL-TR
paketinin hiçbiri bunu yapmıyor — üçü de yalnızca hane sayısına bakıyor.
Sonuç: iki rakamı yer değiştirmiş bir VKN belgeye yazılıyor, belge
gönderiliyor ve GİB tarafından reddediliyor.

```ts
import { assertValidTaxIdentifier, isValidVkn } from '@yankikucuk/ubl-tr'

isValidVkn('0843118681') // true — sıfırla başlayan VKN geçerlidir

const kind = assertValidTaxIdentifier(girdi.vergiNo, 'supplier.vkn')
// kind: 'VKN' | 'TCKN' — UBL `schemeID` özniteliğine doğrudan yazılabilir
```

Ne yakaladığı ölçüldü ve testlerle sabitlendi: tek hane hatasının tamamı,
bitişik transpozisyonun TCKN'de %89,8'i (kaçan tek durum: hane farkının tam
olarak 5 olması — nedeni JSDoc'ta cebirsel olarak açıklanıyor), VKN'de
%96,1'i. Algoritmalar iki bağımsız uygulamaya karşı 200.000 örnekte
doğrulandı: sıfır uyuşmazlık.

### Tutar aritmetiği ve yazıyla tutar

Tutarlar `bigint` üzerinde sabit noktalı taşınır; kayan nokta hiç
kullanılmaz. Rakiplerin tamamı `number` + `toFixed(2)` yolunu kullanıyor.

```ts
import { decimal, multiply, sum, toStringValue, amountInWords } from '@yankikucuk/ubl-tr'

;(1.005).toFixed(2) // '1.00'  — bir kuruş kayboldu
toStringValue(decimal(1.005, 2)) // '1.01'

;(1e21).toFixed(2) // '1e+21' — XSD decimal kabul etmez
toStringValue(decimal('1e21'), 2) // '1000000000000000000000.00'

Math.round(-2.5) // -2 — yarımı hep +∞ yönüne yuvarlar
toStringValue(rescale(decimal('-2.5'), 0)) // '-3' — sıfırdan uzağa
```

Yazıyla tutar, para birimi farkında ve Türkçe büyük harf kurallarına uyar:

```ts
amountInWords(decimal('1.999')) // 'İki Türk Lirası'
amountInWords(decimal('0.50')) // 'Sıfır Türk Lirası Elli Kuruş'
amountInWords(decimal('100.25'), 'USD') // 'Yüz Amerikan Doları Yirmi Beş Sent'
amountInWords(decimal('5000'), 'JPY') // 'Beş Bin Japon Yeni'
amountInWords(decimal('1200'), 'TRY', { case: 'upper' })
// 'BİN İKİ YÜZ TÜRK LİRASI' — toUpperCase() 'LIRASI' verirdi
```

Bu dört satırın dördü de incelenen paketlerde canlı olarak yanlış çıktı
veriyor; hepsi birer regresyon testiyle sabitlendi.

### Belge numarası doğrulama

GİB tüm e-belgelerde 16 haneli düzeni şart koşar: **3 harf + 4 haneli yıl +
9 haneli sıra**. Bu kural XSD'de değil, kılavuzda tanımlı — `xmllint` ile
şema doğrulaması yapan bir üretici bu hatayı göremez.

```ts
import { assertValidDocumentNumber } from '@yankikucuk/ubl-tr'

assertValidDocumentNumber('ABC2026000000001', 'cbc:ID')
// { prefix: 'ABC', year: 2026, sequence: '000000001' }

assertValidDocumentNumber('ABC2025000000001', 'cbc:ID', { issueDate: '2026-09-06' })
// → InvalidDocumentNumberError { reason: 'year-mismatch', detail: '2026' }
```

Düzenleme tarihiyle yıl çapraz denetimini hiçbir rakip yapmıyor; ikisi yıl
segmentine hiç bakmıyor. Seri kodunda rakama da izin verilmez — en yaygın
rakip `[A-Z0-9]{3}` deseniyle `123` gibi bir seriyi geçerli sayıyor.

### XML ↔ JSON, kayıpsız

```ts
import { xmlToJson, jsonToXml } from '@yankikucuk/ubl-tr'

const belge = xmlToJson(faturaXml)
belge.root.name // 'Invoice'

jsonToXml(belge) === faturaXml // sıkışık yazılmış belgede her zaman true
```

Gidiş-dönüş garantisi testlerle sabitlenmiş: `xml → json → xml` bayt bayt
aynı, ikinci tur da aynı. Girintili bir girdi sıkışık ve kararlı çıktıya
iner. Bu garantiyi rakiplerin hiçbiri veremiyor — ikisi yalnızca tek yönlü.

Şekil üç noktada bilinçli olarak farklı:

| Konu     | Yaygın davranış                                             | Burada                    |
| -------- | ----------------------------------------------------------- | ------------------------- |
| Ad alanı | `removeNSPrefix` ile silinir; `cbc:ID` ile `cac:ID` karışır | URI korunur               |
| Çokluk   | Tek `InvoiceLine` nesne, iki tanesi dizi olur               | `children` her zaman dizi |
| Tür      | `1234567890` sayı, `0123456789` dize olur                   | metin her zaman `string`  |

Ayrıca korunanlar: `ext:UBLExtensions` ve `cac:Signature` (bir rakip bunları
sabit listeyle siliyor), 1000 karakterden uzun base64 içerik (bir rakip
`"#base64encoded"` ile değiştiriyor, kapatılamıyor), `xsi:schemaLocation`
gibi ön ekli öznitelikler.

### Güvenli ayrıştırma

`<!DOCTYPE>` bildirimi **tümden reddedilir**. XXE, varlık genişletme
(billion laughs) ve karesel şişmenin tamamı DTD üzerinden gelir; "sınırlı
destek" yerine bildirimi reddetmek bu saldırı sınıfını ortadan kaldırır.
Geçerli bir UBL-TR belgesinde DTD bulunmaz.

Derinlik (varsayılan 100) ve boyut (varsayılan 16 MiB) sınırları açıktır;
boyut sınırı ayrıştırmadan önce uygulanır.

```ts
xmlToJson(partnerdenGelenBelge, { maxSize: 2 * 1024 * 1024, maxDepth: 40 })
```

### Deterministik yazma

Ad alanı doğru, kaçırması unutulamaz, C14N uyumlu serileştirici. Varsayılan
çıktı boşluksuzdur — girinti, sarmalanmış XAdES imzasında imzalanan içeriğin
parçası olur.

## XAdES imzalama

Bu kütüphane imza **atmaz**. İmzayı kardeş paket
[`@yankikucuk/e-imza`](https://github.com/yankikucuk/e-imza) atar; o da
sıfır bağımlılıklı ve UBL'yi bilmez.

İki paket birbirini **import etmez**. Aralarındaki tek bağ yapısal bir
sözleşme: bu kütüphanenin varsayılan olarak yazdığı **boş
`ext:ExtensionContent`**. `ubl-tr` onu boş bırakır, `e-imza` doldurur.

Ayrım bilinçli. `ubl-tr` kullanıp belgeyi başka bir araçla imzalayanlar,
imzayı hiç kullanmayanlar (e-Arşiv portal akışında belge GİB tarafında
imzalanır) ve `e-imza`'yı kendi XML'iyle kullananlar — üçü de zorunlu bir
bağımlılık taşımıyor.

```bash
npm install @yankikucuk/ubl-tr @yankikucuk/e-imza
```

```ts
import {
  buildInvoiceXml,
  InvoiceProfile,
  InvoiceType,
  parseDocument,
  parseInvoice,
} from '@yankikucuk/ubl-tr'
import { loadPkcs12, sign, verify } from '@yankikucuk/e-imza'
import { readFileSync } from 'node:fs'

// 1. Üret — imza zarfı (boş ext:ExtensionContent) varsayılan olarak yazılır.
const fatura = buildInvoiceXml({
  id: 'ABC2026000000001',
  uuid: '1a2b3c4d-0001-4000-8001-000000000001',
  issueDate: '2026-09-07',
  profile: InvoiceProfile.TEMEL,
  type: InvoiceType.SATIS,
  supplier: {
    taxNumber: '1234567890',
    name: 'ÖRNEK SATICI A.Ş.',
    taxOffice: 'Kadıköy',
    address: { district: 'Kadıköy', city: 'İstanbul' },
  },
  customer: {
    taxNumber: '9876543210',
    name: 'Örnek Alıcı Ltd. Şti.',
    address: { district: 'Çankaya', city: 'Ankara' },
  },
  lines: [{ name: 'Danışmanlık hizmeti', quantity: 10, unitPrice: 100, vatRate: 20 }],
})

// 2. İmzala — mali mühür kabını aç, imzayı uzantıya yerleştir.
const { privateKey, certificate, chain } = loadPkcs12(
  new Uint8Array(readFileSync('mali-muhur.p12')),
  process.env.MUHUR_SIFRESI ?? '',
)
const imzali = sign({ xml: fatura, signer: { certificate, chain }, privateKey })

// 3. Doğrula ve oku — imza belgeyi bozmaz.
if (!verify(imzali).valid) throw new Error('İmza geçersiz')

const { root } = parseDocument(imzali)
parseInvoice(root).id // 'ABC2026000000001'
```

**İmza son adımdır.** İmzaladıktan sonra XML'e dokunmak — bir boşluk eklemek
bile — imzayı geçersiz kılar. Bu kütüphanenin
[deterministik, boşluksuz çıktısı](#deterministik-yazma) tam da bu yüzden
öyle.

Mali mühürünüz eski bir araçla dışa aktarılmışsa — `.p12` dosyasının
sertifika bölümü `RC2-40` ile şifrelenmişse — `e-imza` onu açar. RC2 ve RC4
Node'un kriptografisinden çıkarıldığı için bu kaplar çoğu modern araçta
sorun çıkarır; `e-imza` ikisini de kendi içinde taşıyor. Gerekçe ve ölçüm
[e-imza README'sinde](https://github.com/yankikucuk/e-imza#neden-bu-paket).

`e-imza` yalnızca XAdES ile sınırlı değil: ikili veri için **CAdES**, PDF
için **PAdES**, belgeyi imzasıyla tek dosyada taşımak için **ASiC** de var
ve üçü de arşiv seviyesine (LTA) kadar destekleniyor. e-Fatura akışında
gereken tek şey XAdES; gerisi elinizin altında duruyor.

## Tasarım kararları

**Sıfır çalışma zamanı bağımlılığı.** `dependencies` boş ve öyle kalacak;
CI bunu her PR'da makine olarak kontrol ediyor. Mali belge üreten bir
kütüphanenin bağımlılık zinciri, saldırı yüzeyidir.

**Güvenli varsayılanlar.** Gelen XML her zaman dış girdidir. DTD ve dış
varlık çözümlemesi kapalıdır, genişletme ve derinlik sınırları uygulanır,
kütüphane hiçbir koşulda ağ isteği yapmaz. Ayrıntı için
[SECURITY.md](SECURITY.md).

**Deterministik çıktı.** Aynı girdi her zaman bayt bayt aynı XML'i üretir.
Bu, belge imzalamanın ön koşuludur ve testleri karşılaştırılabilir kılar.

**İmza kapsam dışı.** XAdES imzalama ayrı bir paket:
[`@yankikucuk/e-imza`](https://github.com/yankikucuk/e-imza). Bu kütüphane
imzasız belge üretir ve imzalı belgeyi imzasını doğrulamadan okur. Ayrım
bilinçli — bkz. [XAdES imzalama](#xades-imzalama).

## Mimari

Katmanlar tek yönlüdür ve sınırlar ESLint tarafından zorlanır — bir
ihlal derleme değil, **lint** hatasıdır:

```
constants/    GİB kod listeleri, ad alanı URI'leri            (yaprak)
core/         XML yazıcı/okuyucu, biçimlendirme                → constants
documents/    UBL-TR belge tip modeli                          → core, constants
builders/     nesne → XML          ┐
parsers/      XML → nesne          ├ kardeş, birbirini çağıramaz
validators/   şema ve iş kuralı    ┘
session/      etkileşimli form durumu  → üç kardeşi de kullanır (tepe)
```

Kardeş izolasyonunun sebebi: bir doğrulayıcının belge üretmesi ya da bir
ayrıştırıcının doğrulayıcı çağırması, tek yönlü olması gereken veri akışını
çift yönlü hâle getirir ve döngüsel bağımlılığa açar. Ortak ihtiyaç `core`
ya da `documents` katmanına iner.

`session` üç kardeşi birden kullanan tek katmandır ve tepede durur; hiçbir
alt katman ona bağımlı olamaz. Kardeşleri birleştirme ihtiyacı gerçektir
(oturum önce belgeyi kurar, sonra doğrular) ama bu birleşimin tek bir yeri
olması, izolasyonun kardeş düzeyinde bozulmamasını sağlar.

## Geliştirme

```bash
npm ci
npm test            # birim testleri
npm run typecheck   # tsc --noEmit
npm run lint        # katman sınırları dâhil
npm run knip        # ölü kod ve kullanılmayan bağımlılık
npm run build       # ESM + CJS + .d.ts
```

Tam kontrol listesi ve katkı süreci için [CONTRIBUTING.md](CONTRIBUTING.md).

## Kaynaklar

- [GİB e-Belge — kılavuzlar ve UBL-TR paketleri](https://ebelge.gib.gov.tr/anasayfa.html)
- [OASIS UBL 2.1 spesifikasyonu](http://docs.oasis-open.org/ubl/os-UBL-2.1/)

## Güvenlik

Güvenlik açıklarını herkese açık issue ile değil,
[özel güvenlik danışma kanalından](https://github.com/yankikucuk/ubl-tr/security/advisories/new)
bildirin. Ayrıntı: [SECURITY.md](SECURITY.md).

## Sorumluluk reddi

Bu proje GİB ile ilişkili değildir ve GİB tarafından onaylanmamıştır.
Ürettiğiniz belgelerin mevzuata uygunluğundan siz sorumlusunuz.

## Lisans

[MIT](LICENSE)
