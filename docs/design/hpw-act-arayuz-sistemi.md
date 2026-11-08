# HPW Act arayüz sistemi — brifin ürüne uyarlanması

Kaynak: *Happy Place to Work® — Web Sitesi Tasarım ve Üretim Brifi* (22.09.2026, V1). Brifin renk, tipografi, grid, logo, zemin ve yasak bölümleri bu üründe de bağlayıcıdır. Bu belge yalnız, brifin kurumsal site için yazdığı kuralların bir yürütme yazılımında nasıl uygulandığını söyler. Brif ile çelişkide brif kazanır; çelişki bir ADR ile çözülür.

Tez aynıdır: **az öğe × yüksek ölçek farkı × yüksek kontrast × kesin grid.** Her ekranda bir şey beklenmedik derecede büyüktür; bir uygulamada bu şey bir karar sayısı, bir skor, bir öneri ya da bir eksiktir. Geri kalan her şey — tablo, liste, form — gridde sessiz durur.

## Kare = bölüm
Web'de "kare" bir bölüm ya da ekran yüksekliğidir; uygulamada kare bir `section`'dır. Header kendi karesidir: beyaz zemindeki kırmızı wordmark header'ın kırmızısını tüketir, header'da başka kırmızı olmaz. Footer kendi karesidir: siyah zemin, kırmızı wordmark. Her ekran bölümünde kırmızı tam olarak bir kez kullanılır; hangi öğenin kırmızı olacağı ekranın işine göre tabloda tanımlıdır.

| Ekran | Baskın öğe (dev) | Bölümün tek kırmızısı | Siyah bölüm |
|---|---|---|---|
| Giriş | "Sonuç bir başlangıçtır." Display XXL | Zemin (Manifesto Red); metin yalnız beyaz | — |
| Dikkat kuyruğu | Bekleyen karar sayısı | O sayı | — |
| Sonuçlar (içe alma) | Sayfa tezi H1 | İçe alınacak satır sayısı | — |
| Birim sonuçları | Güven skoru | O skor | — |
| Hedef ağı | Önerilen hedef (Display XL) | O sayı | "Neden 58,7?" açıklaması; tek kırmızı kelime: birimin payı |
| Aksiyon önerileri | "Üç öneri. Bir tanesi yeter." | "Önerilen paket" etiketi (yalnız ilk öneri) | — |
| Yerel uygulamalar | Doğrulanan yüzde | Gecikmiş satırı (çubuk + sayı) | Kural: "Uygulama şubede olur." |
| Kanıt | Eksik kanıt sayısı | O sayı | — |
| Karne | Gecikmiş şube sayısı | O sayı | — |
| Kurumsal | Şirket skoru | O sayı | Tez: beş şey ayrı |
| Organizasyon | Onay bekleyen reorg sayısı | O sayı | — |
| Kullanıcılar | Sahipsiz iş sayısı | O sayı | — |
| Ayarlar | Sayfa tezi | Kaydet düğmesi | — |
| Müşteriler | Hizmet hedefi dışındaki müşteri sayısı | O sayı | — |
| Metodoloji | Bekleyen karar sayısı | O sayı | — |
| Denetim | "Tarih yeniden yazılmaz." | SoD ihlali satırı | — |

Ritim: siyah bir bölümün ardından beyaz nefes gelir; siyah bölüm doğrudan siyah footer'a değmez. Bu yüzden siyah statement içeren her ekran beyaz bir bölümle biter.

## Aktörler ve kapsam
Arayüz rolden değil sorumluluk ilişkisinden görünür olur; prototipte 13 aktör `src/personas.ts` içinde tanımlıdır ve header'daki aktör seçici ile değiştirilir (gerçek sistemde RoleAssignment + `packages/policy`). Her aktörün gezinmesi, dikkat kuyruğu ve veri kapsamı ayrıdır; gezinmesinde olmayan ekran `Guard` ile reddedilir ve nedeni yazılır.

| Aktör | Kapsam | Ekranlar |
|---|---|---|
| Genel Müdür, GMY | şirket / GMY | Dikkat, Kurumsal, Hedefler, (Yerel uygulamalar), Karne |
| İK Yöneticisi | müşteri şirket | Dikkat, Sonuçlar, Organizasyon, Kullanıcılar, Ayarlar, Karne |
| İK İş Ortağı | bölge | Dikkat, Sonuçlar, Birimler, Hedefler, Aksiyonlar, Yerel uygulamalar, Kanıt, Karne |
| Bölge Direktörü | bölge | Dikkat, Birimler, Hedefler (onay), Yerel uygulamalar, Karne |
| Şube Müdürü | birim | Dikkat, Birimler (yalnız kendi), Hedefler (yalnız kendi satırı), Aksiyonlar, Kanıt |
| Aksiyon Sahibi | birim | Dikkat, Kanıt |
| Destekleyici birim (Akademi) | katkı | Dikkat, Hedefler (katkı), Yerel uygulamalar; şube skoru görmez |
| İzleyici | şirket | Dikkat, Karne |
| HPTW Sistem Yöneticisi | sistem | Dikkat, Müşteriler, Ayarlar (sistem), Denetim |
| HPTW Danışman | çok müşteri | Dikkat, Müşteriler, Aksiyonlar (kütüphane), Karne |
| HPTW Metodolog | tenant | Dikkat, Metodoloji, Sonuçlar |
| HPTW Denetçi | tenant | Dikkat, Denetim (salt okunur) |

## Durum renk değil kelimedir
Bir yürütme ürününde onlarca satır aynı anda "riskte" olabilir; kırmızı karede bir kez kullanılabildiği için durum hiçbir zaman renkle taşınmaz. `execution_status`, `impact_status`, şiddet ve karşılaştırılabilirlik Caption ölçüsünde büyük harf kelimedir: KANIT BEKLİYOR, GECİKMİŞ, KRİTİK, YÜKSEK. Sıralama ve konum aciliyeti söyler; kuyruk en kritikten başlar. Yeşil/sarı/kırmızı trafik ışığı, rozet, nokta, ikon yoktur.

## Veri görselleştirme
Çubuklar siyah dolgu ve 1 px çerçevedir; ölçü söyler, renk söylemez. Bir grafikte tek satır kırmızı olabilir (ekranın vurgusu). Baskılanmış değer uzun tire (—) ve "n < 5" açıklamasıdır; sunucu değeri zaten göndermez. Sayılar `tabular-nums` ile hizalanır, Türkçe biçimde yazılır (60,45), yüzde işareti önde (%61). Uygulama ve etki asla tek sayıya birleştirilmez; iki ayrı sütun, iki ayrı kelime.

## Tipografi ölçeği (uygulama)
Brifin web ölçeği `tokens.css` içinde clamp() ile masaüstü–mobil arasında tanımlıdır. Uygulama ekranlarında iki kademe kullanılır: ekranın baskın öğesi (Display XXL/XL ya da H1) ve gövde (Body / Caption). "Hepsi orta boy" ekran yoktur; H2 yalnız baskın öğenin altındaki tek cümle için kullanılır. Dev ifade sarmaz: `FitText` bileşeni ölçüyü kabın içerik genişliğine düşürür; kasıtlı crop yalnız tek kelimelik ifadede ve en fazla %12'dir, cümleler kırpılmaz. Asgari ölçüde bile sığmıyorsa satır sarar, kelime asla bölünmez. Kicker ve meta metinler `text-transform: uppercase` ile ve `lang="tr"` altında dönüştürülür (i → İ); İngilizce ibareler `lang="en"` ile işaretlenir.

## Bileşenler
Brifin bileşen tablosu `components.css` içinde birebir uygulanmıştır: birincil buton siyah dolgu / hover tersleme; ikincil beyaz dolgu 1 px çerçeve; kırmızı buton yalnız bölümün tek kırmızısıysa; metin bağlantısı altı çizgi 1 → 2 px; navigasyon Caption ölçüsü, aktif altı çizili; form alanı 1 px çerçeve, odakta 2 px, etiket alanın üstünde, placeholder yok; hata 2 px çerçeve + siyah metin; tablo 1 px çizgi, siyah başlık satırı, zebra yok; kart yok, hairline ile ayrılmış satır. Disabled durum soluklaştırılmaz: boş çerçeveli buton + açıklayıcı etiket ("Kanıtı yükleyen kişi doğrulayamaz."). Dosya seçici yerli kontrolü gizler, etiket ikincil buton gibi çizilir. Çatışma (409) kutusu siyah zemin beyaz metin, kırmızı yok.

## Hareket
Tek seferlik giriş yalnız ekranın baskın öğesinde (`.enter`, 200 ms); hover terslemeleri 200 ms; `prefers-reduced-motion` etkinse `--motion: 0ms`. Otomatik hareket, kayan slider, parallax yok.

## Erişilebilirlik
WCAG 2.2 AA. Odak her öğede 2 px dış çizgi, zemine göre siyah/beyaz. Dev sayı `aria-hidden`, tam cümle ekran okuyucuya `sr-only` ile verilir. Siyah üzerine kırmızı yalnız H2 ve üstü (≥ 24 px) tek kelimede; gövde ve etiketler beyazdır. Küçük metin daima siyah–beyaz kontrastında.

## Denetim
`pnpm brand-qa` (tools/scripts/brand-qa.mjs) kod tarafında brifin QA listesini uygular: üç hex dışında renk yok, hex yalnız tokens.css'te, rgb/hsl yok, border-radius 0, gölge/blur/degrade/opaklık yok, yalnız Poppins 400/700, italik yok, SVG/ikon/emoji yok, padding/margin/gap 12 px tabanında, toUpperCase yok. CI'da zorunludur. Ekran görüntüleri `docs/design/screens/` altındadır; her yeni ekran aynı listeyle gözden geçirilir.

## Brifteki "Doldurulacak" alanların ürün karşılığı
- Dil: tr-TR ana dil, EN hazır (`src/i18n`), AR Faz 2.
- Fotoğraf: üründe fotoğraf yok; boş alan tipografiyle dolar.
- Logo: wordmark Poppins Bold "Happy Place to Work®" + ürün adı "Act" Regular. İstiflenmiş form favicon'dadır (`public/favicon.svg`). Logo SVG dosyaları geldiğinde wordmark bileşeni onlarla değiştirilir; renkler token'a bağlı kalır.
- Font: Poppins 400/700 Latin + Latin Extended self-host (`public/fonts`, OFL 1.1), preload, `font-display: swap`, `font-synthesis: none`.

## Dil kuralı
Türkçe arayüzde İngilizce kelime yoktur; İngilizce modda (EN) ise her metin İngilizcedir. Kaynak dil Türkçedir (kodda Türkçe metin), İngilizce karşılıklar `src/i18n/en-dom.json` sözlüğünde (sayılar `#` yer tutucu) ve `tools/scripts/en-dom-dictionary.py` üreticisinde durur; EN modda `domTranslate.ts` ekrandaki metin düğümlerini bu sözlükle çevirir. Yeni metin eklendiğinde sözlüğe karşılığı eklenir; `python3 /home/claude/en-tara.py` benzeri tarama (ui-dil-tara.py'nin EN sürümü) çevrilmemişleri listeler.
Türkçe arayüzde İngilizce kelime yoktur: durum, tür ve neden kodları (`in_progress`, `out_of_authority`, `BASELINE_FROZEN` vb.) yalnız kodda yaşar, ekranda Türkçe karşılığıyla görünür; eşleme tabloları ilgili sayfa dosyasının başında ya da i18n kataloğundadır. Tek istisna markalar: "Happy Place to Work®", "HPTW" ve ürün adı "Act". Denetim: görünen-metin taraması `python3 tools/scripts/ui-dil-tara.py` CI dışında, sürüm öncesi çalıştırılır.

## Üst şerit
İki açılır liste: **Ekranlar** (bütün ekran grupları — Yönetim, İnsan Kaynakları, Saha, Sistem yönetimi — ve her rolün ekranları; seçim aktörü değiştirir ve ekranı açar) ve **Aktör** (kim olarak bakıyorum). Etiketli alan ile düğme aynı satırda ise alt hizaya (`.row:has(.field) { align-items: flex-end }`) oturur; alan etiketi düğmeyi yukarı itmez.

## Düğme kuralı
Her düğme çalışır ya da gerekçesiyle kapalıdır; "süs" düğme yoktur. Prototipte tıklanabilir her işlem bir sonuç metni bırakır ("Onaylandı · sürüm 12", "37 şubeye hatırlatma gönderildi"). `dugme-test.py` tüm akışları tıklayarak doğrular.

## v2.2 ekran kuralları
Hedefler: istenen değer → Uzlaştır → destekleniyor / fark var · karar gerekli / ulaşılamaz; fark varsa karar düğmeleri (hedefi desteklenene çek, esnetmeyi bilerek kabul et, merkezi müdahale ekle, süreyi uzat), karar verilmeden onay kapalı. Şube görünümünde iki kart: 'Kurumsal olarak senden beklenen' ve 'Şubenin kendi önceliği'; katkı ve kardeş şubeler görünmez. Birimler: dört eksenli öncelik tablosu (şiddet, veri güveni, karar, sahip, yol). Kurumsal: istenen / desteklenen / azami. Gizli birimde hiçbir sayısal türetilmiş çıktı gösterilmez; yalnız 'üst birim önceliği kapsamında' kalıbı.

## v2.3 ekran kuralları
Şube görünümü: yalnız 'yerel gelişim hedefleriniz' (en fazla iki; ikisi de şubenin kendi verisinden) ve bilgi satırı 'şirket genelindeki yön: Güven'; sayı 'öneri + makul aralık + dayanak' ile gelir; katkı, kardeş şubeler ve şirket hedefinin sayısı gösterilmez; her hedef için Kabul et / Değiştir / Uygun değil. Bölge görünümü: 'istenen değer → Uzlaştır → destekleniyor / fark var / ulaşılamaz'; katkı sütunu 'katkı projeksiyonu'. Birimler: veri güveni Düşük/Orta/Yüksek etiketiyle, stratejik önem ayrı. Kanıt: seviye 'kuraldan', doğrulama yolu yazılı. Yasaklı terimler `docs/design/terminoloji-sozlugu.md`; tarama `python3 tools/scripts/ui-kota-dili-tara.py` sürüm kapısı.

## Tasarım B (v2.14.0) — onaylanan rol prototiplerinin ürüne uyarlanması
Kaynak: Ekim 2026 rol prototipleri ve on beş ilke (docs/PILOT-DEGISIKLIK-v2.14.0.md). Renk: üç marka rengine ek olarak sarı (#F2C14E, yalnız ikincil düğme ve vurgu) ve dört gri ton (#EDEAE7 yumuşak zemin, #B9B2AD/#8A817C karşılaştırma çubuğu, #6B625D ikincil metin); hepsi yalnız `tokens.css`'te. Siyah dolu düğme birincil işlem, sarı düğme ikincil işlem, kırmızı yalnız iptal/durdurma. Veri grafikleri (mermi grafik, Gantt, kare ilerleme, çubuk tabloları) `product/ui/charts/` ve `product/ui/tb.tsx` içindedir; ikon ve emoji yasağı sürer. Ekran iskeleti: kicker + başlık (+ sağda dönem/birim seçicileri) → siyah özet şeridi (en fazla üç hücre) → numaralı bölümler (solda numara ve soru, sağda içerik, düğmeler içeriğin altında) → "Nasıl okunur?" sağ kenar paneli. 820 px altında her şey tek sütun; tablolar kendi içinde yatay kayar; mermi grafiğin dar sürümü gösterilir.
