# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/lang/tr/) kullanır.
Biçim [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) temellidir.

## [0.1.0] — 2026-09-06

### Eklendi

- Depo iskeleti: TypeScript araç zinciri, katmanlı ESLint yapılandırması,
  CI, CodeQL, bağımlılık incelemesi, etiket senkronizasyonu ve yayın
  iş akışları
- UBL-TR ad alanı URI'leri, belge tipi kodları ve profil kimlikleri
- **Çekirdek XML katmanı** — deterministik, ad alanı doğru, C14N uyumlu
  serileştirici:
  - `leaf` / `container` / `optionalLeaf` / `optionalContainer` öğe
    kurucuları; karışık içerik tip düzeyinde imkânsız
  - `serializeDocument` — ön ekler kök öğede toplanır, bildirilmemiş ad
    alanı hata verir, varsayılan çıktı boşluksuz
  - Kanonik XML (C14N 1.0 §2.3) kaçış kuralları; kaçırmayı serileştirici
    yapar, çağıran unutamaz
  - XML 1.0 §2.2 karakter kümesi denetimi; kontrol karakteri sessizce
    geçirilmez, konumuyla birlikte hata verilir

- **Kimlik doğrulama katmanı**:
  - `isValidVkn` / `isValidTckn` / `detectTaxIdentifierKind` /
    `assertValidTaxIdentifier` — kontrol basamağı doğrulaması. İki bağımsız
    uygulamaya karşı 200.000 örnekte doğrulandı, sıfır uyuşmazlık.
    Algoritmaların ölçülmüş sınırı JSDoc'ta ve testlerde sabitlendi.
  - `parseDocumentNumber` / `isValidDocumentNumber` /
    `assertValidDocumentNumber` — 16 haneli UBL-TR belge numarası; isteğe
    bağlı düzenleme tarihi çapraz denetimi.

- **XML ayrıştırıcı** (`parseDocument`) — sıfır bağımlılıklı, ad alanı
  farkında. DTD tümden reddedilir; derinlik ve boyut sınırları uygulanır;
  CDATA, yorum, işlem talimatı ve sayısal başvurular desteklenir; karışık
  içerik reddedilir; hiçbir değerin türü tahmin edilmez.
- **JSON köprüsü** (`xmlToJson`, `jsonToXml`, `toJson`, `fromJson`) —
  kayıpsız gidiş-dönüş. `xml → json → xml` bayt bayt aynı; alt öğeler her
  zaman dizi; ön ekli öznitelikler James Clark gösterimiyle korunur.

- **Tam sayı ondalık aritmetiği** (`Decimal`) — tutarlar `bigint` üzerinde
  sabit noktalı taşınır, kayan nokta hiç kullanılmaz. Yuvarlama sıfırdan
  uzağa yarım yukarıdır; `Math.round` negatif tutarlarda yanlış yönde
  yuvarlar. Çarpım tam kalır, yuvarlama yalnızca tutara yazılırken yapılır.
- **Para birimi tablosu** — ISO 4217 ondalık basamak sayısı, Türkçe ad ve
  alt birim adı. Yenin ondalığı yoktur, dinar üç basamaklıdır, "kuruş"
  yalnızca Türk lirasının alt birimidir.
- **Yazıyla tutar** (`amountInWords`, `amountInWordsNote`) — Türkçe sayı
  yazımı, para birimi farkındalığı ve `toLocaleUpperCase('tr')`.

- **Vokabüler** — 12 fatura profili, 20 fatura tipi ve aralarındaki izin
  matrisi; 52 KDV tevkifatı kodu ve oranı; 30 vergi türü; 77 ölçü birimi;
  13 para birimi.
- **Toplam motoru** (`calculateInvoice`) — satır hesabı, orana göre gruplanmış
  KDV alt toplamları, tevkifat, iskonto, KDV matrahını değiştiren ek vergiler.
  Hesaplama boyunca hiç yuvarlanmaz; yuvarlama yalnızca XML'e yazılırken.
- **Fatura üreticisi** (`buildInvoice`, `buildInvoiceXml`) — UBL `xsd:sequence`
  sırasına uyan tam belge; imza zarfı, imza bloğu, iade atfı ve yazıyla tutar
  notu dâhil. Toplamlar çağırandan alınmaz, hesaplanır.

- **e-İrsaliye üreticisi** (`buildDespatchAdvice`, `buildDespatchAdviceXml`)
  — `DespatchAdvice` kök öğesi ve kendi ad alanı; sevkiyat, çoklu sürücü,
  çekici ve dorse plakası, taşıyıcı firma, taşıma ekipmanı, teslim adresi,
  matbu irsaliyeden dönüş ve kalem ek tanımlayıcıları.
- **Ayrıştırıcı katmanı** (`parseInvoice`, `parseDespatchAdvice`) — XML'den
  tipli belge nesnesine. Okuma tipi yazma tipinden ayrıdır; ayrıştırma
  hoşgörülüdür ve hiçbir değerin türü tahmin edilmez.
- **Ödeme şekli ve plaka kod listeleri** — GİB'in kabul ettiği 20 ödeme
  şekli kodu (adı yayımlı olan 7'si etiketli) ve 6 plaka şeması.
- **Yapısal doğrulama** (`validateStructure`) — UBL `xsd:sequence` sırası,
  zorunluluk ve tekrar sınırları; 60 öğe tipi modellendi.
- **İş kuralı doğrulaması** (`validateInvoiceRules`) — 25 kural: belge
  numarası biçimi ve yılı, profil-tip eşleşmesi, iade atfı, muafiyet kodu,
  kod listeleri (birim, vergi, muafiyet, ödeme şekli), tevkifat kodu-oran
  çifti, tutar tutarlılığı, ondalık basamak sınırı, adresin zorunlu
  alanları, gerçek kişide vergi dairesi bloğu, HKS künye numarası, ihraç
  kayıtlı 702 gümrük bilgileri, şarj hizmetinde dönem/plaka/ESU raporu,
  kamu profilinde aracı alıcı, yatırım teşvikte KDV ve kalem ayrıntıları,
  demirbaş KDV, vergi numarası kontrol basamağı (uyarı).
- **Senaryo kapsamı** — 37 senaryonun (33 fatura + 4 e-İrsaliye) tamamında
  hem tutarlar hem belge yapısı referansla birebir örtüşüyor:
  - 103 KDV istisna/muafiyet kodu ve açıklaması
  - kalem ek tanımlayıcıları (HKS künye no, ilaç takip no, İDİS)
  - iskonto çarpanı, iade atfında belge tipi
  - sipariş ve sözleşme atıfları, genel belge atıfları, muhasebe kodu
  - ödeme bilgisi (şekil, vade, IBAN, açıklama) ve döviz kuru
  - aracı alıcı, ek taraf tanımlayıcıları, ticaret unvanı, uyruk ve
    kimlik belgesi, KDV iade aracısı
  - teslim: adres, Incoterms, GTİP, gümrük beyannamesi ve düzenleyeni,
    fiili teslim tarihi, taşıyıcı
  - kalem ayrıntıları: marka, model, sınıflandırma kodu, ürün takip ve
    seri numarası
  - fatura dönemi
- **Etkileşimli oturum katmanı** (`InvoiceSession`) — fatura ekranının
  ihtiyaç duyduğu durum motoru:
  - `patch` / `addLine` / `setLine` / `removeLine` / `setLines` ile tipli
    kısmi güncelleme; her değişiklikte durum yeniden türer
  - `subscribe` ile dinleyici; `build` ve `toXml` ile aynı oturumdan belge
  - Doğrulama **girdi üzerinde değil üretilen belge üzerinde** yapılır;
    `validateStructure` ve `validateInvoiceRules` sonuçları birleşir
  - Alan görünürlüğü (`deriveFieldVisibility`, `deriveLineFieldVisibility`)
    profil ve tipten türer
  - Seçim listeleri daralır: `allowedProfilesForType`,
    `allowedTypesForProfile`, `availableExemptions`, `availableWithholdings`
  - 12 öneri kuralı (`suggest`, `SUGGESTION_RULES`) — engellemez, işaret
    eder; kendi kuralınız listeye eklenebilir
  - `WITHHOLDING_ALLOWED_TYPES`, `ZERO_VAT_WITHOUT_EXEMPTION_TYPES`,
    `YTB_TYPES` tip grupları
  - `session` katmanı üç kardeşi birden kullanan tek katmandır; ESLint
    kuralı hiçbir alt katmanın ona bağımlı olmasına izin vermez
  - `SessionChange` — dinleyiciye değişikliğin ne olduğu ikinci parametreyle
    gelir: `patch`, `cleared`, `line-added`, `line-updated`, `line-removed`,
    `line-cleared`, `lines-replaced`, `identifications-changed`; her
    bildirimde `previousInput`, satır işlemlerinde `index` ve
    `previousLine`. `(state) => …` yazan dinleyici çalışmayı sürdürür.
    Ayrı bir olay yayıcı kullanılmadı; kütüphane tarayıcıda da çalışıyor
  - Mükellefiyet durumu (`CustomerLiability`) — alıcı e-Fatura mükellefi
    mi, e-Arşiv mi; profil ve tip listeleri buna göre daralır
    (`filterProfilesByLiability`, `filterTypesByLiability`). Kütüphane
    mükellef listesini sorgulamaz; sonucu çağıran verir, verilmezse
    süzme yapılmaz
  - `resolveProfileForType` — tip değişince profil hâlâ geçerliyse korunur,
    değilse mükellefiyete uygun bir profil önerilir; iade temel faturaya
    düşer (Schematron kuralı)
  - `clear` / `clearLine` — alan kaldırma; `patch` derin birleştirme yapar
    ve `undefined` "dokunma" demektir, silme ayrı bir çağrıdır. Kabul
    edilen anahtarlar girdi tipinden türer, elle tutulmaz
  - `removeIdentification` / `setIdentifications` — kimlik listesi
    yardımcıları; liste boşalınca alan tümden kaldırılır (`schemeID`
    taşımayan boş `cac:PartyIdentification` Schematron'u ihlal eder)
- **Belge atıfları, ödeme koşulları ve ek dosya** — doğrulayıcının
  tanıdığı ama kurucunun yazamadığı öğeler kapatıldı:
  - `despatchDocumentReferences` / `receiptDocumentReferences` /
    `originatorDocumentReferences` — irsaliye, mal kabul makbuzu ve siparişi
    başlatan belge atıfları. Üçü de UBL'de `cac:DocumentReference`
    tipindedir; sıra tek yerde tanımlanır
  - `paymentTerms` — `cac:PaymentTerms`; not, gecikme faizi yüzdesi, tutar
    ve vade. Gecikme faizi **kesre çevrilmez**: iskonto oranı
    `MultiplierFactorNumeric` olarak 10 → 0,1 yazılırken faiz yüzde
    tipindedir ve olduğu gibi kalır
  - `attachment` — ek belge atfına iliştirilen dosya; base64 gömme
    (`cbc:EmbeddedDocumentBinaryObject`, `mimeCode` ve `filename`
    öznitelikleriyle) ve/veya dış adres (`cac:ExternalReference`). İkisi de
    boşsa öğe hiç yazılmaz — boş `cac:Attachment` belgeyi geçersiz kılar
- **İskonto ve ek yük** (`AllowanceChargeInput`) — hem satır hem belge
  düzeyinde, `cbc:ChargeIndicator` ile indirim ve masraf ayrımı, gerekçe
  kodu ve açıklaması, çarpan ve baz tutar:
  - **Satır düzeyinde** tutar `cbc:LineExtensionAmount`'a girer, dolayısıyla
    KDV matrahını da değiştirir; satırın tek oranı olduğu için iyi tanımlıdır
  - **Belge düzeyinde** tutar vergiden SONRA `cbc:PayableAmount`'a uygulanır,
    KDV yeniden hesaplanmaz. Satırlar farklı oran taşıyabildiğinden belge
    düzeyinde bir iskontonun hangi oranı azaltacağı tanımsızdır; bu tercih
    belgelendi
  - `cbc:ChargeTotalAmount` — yük yoksa öğe hiç yazılmaz, böylece yükü
    olmayan belgelerin çıktısı değişmez
  - Çarpan yüzde olarak verilir ve kesre çevrilir (10 → 0,1); satır
    iskontosundaki `discountRate` ile aynı sözleşme
- **Çoklu para birimi, imza bilgisi ve çoğul iade atfı**:
  - `taxCurrencyCode` / `pricingCurrencyCode` / `paymentCurrencyCode` —
    verginin, fiyatlandırmanın ve ödemenin para birimi kodları
  - `taxExchangeRate` / `paymentExchangeRate` — vergi ve ödeme kuru belge
    kurundan ayrı verilebilir. GİB vergiyi belgenin düzenlendiği günün
    kuruyla ister; bu kur fiyatlandırma kurundan farklı olabilir
  - `signature` (`SignatureInput`) — imza kimliği, şeması, imzalayan taraf
    ve imza dosyasının adresi. Verilmezse blok eskisi gibi satıcıdan
    doldurulur; entegratör mührüyle imzalanan belgelerde imzalayan taraf
    artık bildirilebiliyor
  - `billingReferences` — bir iade faturası birden çok asıl faturaya atıf
    yapabilir. İade zorunluluğu denetimi her iki alana birden bakar
- **Özel matrah** (`vatBaseAmount`) — KDV matrahı satır tutarından bağımsız
  verilebiliyor. ÖZELMATRAH faturalarında KDV, satılan malın bedeli
  üzerinden değil ayrı belirlenmiş bir matrah üzerinden hesaplanır:
  telefon kartı, piyango bileti, ikinci el araç satışı. Matrah açıkça
  verildiğinde ek vergilerin artırıcı/azaltıcı etkisi **uygulanmaz** —
  kullanıcı matrahı zaten nihai hâliyle bildirmiştir. Tevkifat, özel
  matrahtan doğan KDV üzerinden hesaplanır.
- **Kod listeleri**:
  - **Ambalaj cinsi** (`PACKAGING_TYPE_DEFINITIONS`, `packagingTypeDefinition`,
    `isValidPackagingTypeCode`) — UN/ECE Rec 21'in UBL-TR alt kümesi, 27 kod.
    `CodeTables.packagingTypes` ile genişletilebilir
  - **Taşıma birimi ve kap** (`TransportHandlingUnitInput`,
    `ActualPackageInput`) — `cac:ActualPackage` ile kap numarası, adet, iade
    edilebilirlik, seviye ve ambalaj cinsi. UBL sırası `ActualPackage`'ı
    `TransportEquipment`'tan önce koyar; kap içinde de kod miktardan
    SONRA gelir
  - `CURRENCY_DEFINITIONS` ve `isValidCurrencyCode` — para birimi tablosunun
    dizi hâli ve tanımlılık denetimi. `false` dönmesi belgeyi engellemez;
    tablo kapalı değildir
  - `PARTY_IDENTIFICATION_SCHEMES` ve `isKnownPartyIdentificationScheme` —
    `cac:PartyIdentification` şema kimlikleri. Buna dayanan bir doğrulama
    kuralı **yoktur**: GİB listeyi genişlettiğinde yeni kodu kullanan doğru
    bir belgeyi reddetmek istemiyoruz. Liste arayüz seçim kutusu içindir
  - `availableBillingDocumentTypes` — iade atfında yazılabilecek belge tipi
    kodları
- **Alan yolu API'si** (`InvoicePath`, `setPath`, `getPath`, `linePath`,
  `parseInvoicePath`) — genel bir form bileşeni alanının yolunu bilir ama
  tipini bilmez; bu çağrılar ikisini birleştirir ve değerin tipi
  **derleme zamanında** denetlenir:
  `setPath(linePath(0, 'vatRate'), 'yirmi')` derlenmez.
  - Yol yazımı doğrulama bulgularınınkiyle aynıdır: bir bulgunun `path`
    değeri doğrudan `getPath`/`setPath`'e verilebilir
  - Yollar **tipten türer** — kod üretimi ve onu senkron tutan bir CI adımı
    yoktur. Girdiye yeni alan eklendiğinde yol kümesi kendiliğinden genişler
  - Tanınmayan biçim sessizce belge alanı sayılmaz; yazım hatası yamayı
    çöp alanla kirletmez
- **`diffSuggestions`** — iki öneri kümesi arasındaki fark (`added`,
  `removed`, `kept`). Arayüz her tuş vuruşunda listeyi yeniden çizmek
  yerine yalnızca değişeni vurgular. Anahtar kimlik **ve** yoldur: aynı
  kural iki satır için ateşlendiğinde bunlar ayrı önerilerdir; gerekçe
  metni anahtara girmez, düzeltilmesi öneriyi "yeni" göstermemelidir
- **`resolveTypeForProfile`** — `resolveProfileForType`'ın aynası; profil
  değiştiğinde uyan tipi korur, uymayanı profilin ilk tipine düşürür
- **e-Arşiv bilgileri** (`eArchive`) — GİB bunları ayrı öğelerle değil,
  belirli `documentTypeCode` değerleri taşıyan ek belge atıflarıyla ister;
  kodları ezberlemek kullanıcının işi değildir:
  - `sendType` — `EXT_SEND_METHOD`. `KAGIT` için öğe **yazılmaz**; GİB kâğıt
    gönderimi varsayılan sayar
  - `onlineSale` — `EXT_IS_ONLINE_SALE`, `EXT_ONLINE_STORE_URL`,
    `EXT_PAYMENT_METHOD`, `EXT_PAYMENT_DATE`. Teslim tarihi ve taşıyıcı
    `cac:Delivery` bloğuna gider; açıkça verilen `delivery` alanları üstün
    gelir
  - `sgk` — `DOSYA_NO`, `MUKELLEF_ADI`, `MUKELLEF_KODU`. Açıklamada fatura
    türünün Türkçe adı geçer ("Eczane Adı"); yeni `SGK_TYPE_DEFINITIONS`
    tablosundan çözülür, bilinmeyen kodda kodun kendisi kullanılır
  - `xsltTemplate` — görüntüleme şablonu, ek belge atfına gömülü XSLT
  - Üretilen belgeler kullanıcının `additionalDocuments` girdilerinin
    **önüne** yazılır
  - `eArchiveDocuments` ve `onlineSaleDelivery` ayrıca dışa aktarılır:
    eşlemenin ne ürettiği görülebilir, elle de kullanılabilir
- **`isAmountInWordsNote`** — bir notun kendiliğinden eklenmiş yazıyla
  tutar notu olup olmadığını söyler. Belge ayrıştırılırken bu notu
  kullanıcının notlarından ayırmak gerekir; aksi hâlde gidiş-dönüşte iki
  kez yazılır. İki yaygın etiketi tanır, özel etiket ikinci parametreyle
  verilebilir
- **`shipment.goodsValue`** — e-İrsaliyede sevk edilen malın beyan değeri
  (`cac:GoodsItem/cbc:ValueAmount`); sigorta ve gümrük işlemleri için.
  Verilmediğinde boş `cac:GoodsItem` yazılmayı sürdürür
- **Kod tablosu genişletme** (`CodeTables`) — gömülü GİB kod listelerinin
  önüne geçen ek tanımlar; yeni kod eklenebilir, var olan tanım
  düzeltilebilir. GİB bir kod yayımladığında paket sürümü beklemek
  gerekmez.
  - `buildInvoiceXml(girdi, { codeTables })`,
    `calculateInvoice({ …, codeTables })`,
    `validateInvoiceRules(root, { codeTables })`,
    `new InvoiceSession(girdi, { codeTables })`
  - Oturum tabloyu hepsine birden dağıtır: hesaplama, üretim, doğrulama,
    öneriler ve seçim listeleri
  - Arama işlevleri ikinci parametre olarak tablo alır:
    `withholdingDefinition(kod, tablolar)`, `taxDefinition`,
    `exemptionDefinition`, `unitDefinition`, `currencyDefinition`,
    `isValidTaxCode`, `isValidExemptionCode`, `isValidUnitCode`
  - Tablo **çağrı başına** verilir; süreç genelinde değişen bir tekil
    nesne değildir. Böylece çok kiracılı kullanım mümkün, arama işlevleri
    saf ve kütüphane `EventEmitter` gerektirmediği için tarayıcıda
    çalışmayı sürdürüyor
- **`DocumentInputError`** — kurucuların reddettiği girdi için `code` ve
  `path` taşıyan hata. `RangeError`'dan türer; mevcut `instanceof`
  denetimleri bozulmaz. Oturum bu iki alanı doğrudan doğrulama bulgusuna
  taşır, böylece belge hiç kurulamadığında bile geri bildirim alan
  düzeyinde kalır (`lines[1].withholdingCode`, `billingReference` …).
  Kod ve yol birlikte verildiği yerler: profil-tip uyuşmazlığı, eksik iade
  atfı, satırsız belge, bilinmeyen vergi türü ve tevkifat kodu, iskonto
  oranı ile tutarının birlikte verilmesi

### Neden bu tasarım

Yaygın üç UBL-TR paketi kaynak düzeyinde incelendi ve üç davranış canlı
olarak doğrulandı; her biri burada yapısal olarak imkânsız kılındı ve bir
regresyon testiyle sabitlendi:

- Ad alanı ön eklerinin kökte bildirilip hiç kullanılmaması — tüm öğelerin
  yanlış ad alanına düşmesi
- Kaçırmanın çağıranın sorumluluğunda olması ve geçersiz XML karakterinin
  sessizce çıktıya geçmesi
- Girintili çıktının varsayılan olması — imzalanacak belgede boşluk metin
  düğümleri

Ayrıca ekosistemde açık duran iki gerçek soruna karşılık gelen doğrulamalar
eklendi:

- Kök `cbc:ID` alanına 16 haneli belge numarası yerine kısa bir sıra kodu
  yazılması (odoo/odoo#270638) — `assertValidDocumentNumber` yakalar
- "Şema geçerli ama GİB kabul eder mi" boşluğu (gorkem-bwl/atlas#39) —
  XSD'de tanımlı olmayan kılavuz kurallarının doğrulanması bu yönde ilk adım

Kontrol basamağı doğrulamasını incelenen üç paketin hiçbiri yapmıyordu.

Referans senaryolara karşı çalıştırma kendi kodumuzda üç hata ortaya
çıkardı; üçü de düzeltildi ve regresyon testine bağlandı:

- **Stopaj toplamdan düşmüyordu.** %23 gelir stopajlı 15.000 TL'lik faturada
  ödenecek tutar 14.550 yerine 21.450 çıkıyordu.
- **`TaxExclusiveAmount` şişiyordu.** ÖTV vergi _hariç_ toplama ekleniyordu;
  400 yerine 600.
- **`cbc:WebsiteURI` yanlış sıradaydı.** UBL `cac:Party` sequence'ında ilk
  öğedir; sona yazmak belgeyi şema dışı bırakır.
- **`cac:IssuerParty` fazladan sarmalanıyordu.** UBL'de `IssuerParty`,
  `SignatoryParty` ve `CarrierParty` birer `PartyType`'tır: içerikleri
  doğrudan taraf alanlarıdır, ayrıca `cac:Party` ile sarmalanmaz.

Sayısal katmanda düzeltilen, canlı doğrulanmış hatalar:

- `1,999 TL` için "Bir Türk Lirası **Yüz Kuruş**" — önce ayırıp sonra
  yuvarlamanın sonucu; yüz kuruş diye bir şey yoktur
- `0,50 TL` için "Sıfır Türk Lirası" — ana birim sıfırken kuruşun düşmesi
- `100,25 USD` için "…Yirmi Beş **Kuruş**" ve `0,50 USD` için "Sıfır
  **Türk Lirası**" — para biriminin göz ardı edilmesi
- Her faturada "TÜRK **LIRASI**" — `toUpperCase()` Türkçede noktasız I
  üretir; doğrusu `toLocaleUpperCase('tr')` ile "LİRASI"dır
- `(1.005).toFixed(2) === "1.00"` ve `(1e21).toFixed(2) === "1e+21"` —
  kayan nokta tabanlı tutar yazımının iki bilinen sonucu

XML→JSON yönünde incelenen dönüştürücünün üç veri kaybı da burada yok:
`ext:UBLExtensions` ve `cac:Signature` sabit listeyle siliniyor, 1000
karakterden uzun base64 içerik `"#base64encoded"` ile değiştiriliyor
(kapatılamıyor), ve `removeNSPrefix` ad alanlarını silerek `cbc:ID` ile
`cac:ID` öğelerini ayırt edilemez hâle getiriyor.

[0.1.0]: https://github.com/yankikucuk/ubl-tr/releases/tag/v0.1.0
