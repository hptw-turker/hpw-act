# Rapor ile HPW Act arasındaki sözleşme (v3.0, yh-2)

HPW Act, kurum raporunun ve işletme raporlarının yol haritası bölümünü takip eder. Raporun bu bölümü aşağıdaki kurallara uyarsa "Yol haritası dosyası" (yh-2) rapordan elle ya da `tools/rapor-aktarim/yh2_extract.py` ile hatasız üretilir. Bu kurallar Ant Yapı 2026 dokuz raporunun son biçiminden çıkarıldı (08.11.2026) ve bütün şirketlerde aynıdır.

## Rapor düzeyi

- Bir şirket için bir kurum raporu ve her işletme için bir işletme raporu vardır. Kurum yol haritası kök birime, işletme yol haritası o işletmeye bağlanır; birim kodları organizasyon dosyasındaki kodlardır.
- Başlangıç tarihi raporun sunulduğu gündür. Terminler buradan hesaplanır: İlk 30 gün, İlk 90 gün, İlk 6 ay (= 180 gün).
- Etkinin ölçüleceği dönem tek satırdır (örnek: "2027 ölçümü").

## Eylem planı

- Her plan tek bir anket maddesine bağlıdır (madde kodu + madde metni). Bir işletmede en fazla üç plan önerilir.
- Mevcut değer olumlu yanıt sayısı / yanıt sayısı olarak yazılır (örnek: 9/29 → %31,0). Yüzde, kesirden hesaplanmalıdır; dosyada ikisi birlikte yer alır ve HPW Act tutarlılığı denetler.
- Hedef ya bir olumlu yanıt sayısıdır (örnek: 11/29 → %37,9) ya da "İzlenir" (sayısal hedef verilmez). Yanıt sayısı 5'in altındaysa hedef verilmez.
- Kurum hedefi işletme hedeflerinin toplamıdır: kurumun hedef olumlu sayısı = işletmelerin hedef olumlu sayılarının toplamı (rapor yöntemi). Tutmazsa HPW Act uyarır.
- Karşılaştırma değeri kurum raporunda sektör, işletme raporunda şirket geneli olur; adı dosyada yazılır.

## Adımlar

- Roller: İK, yönetim (kurum raporunda şirketin yönetimi, işletme raporunda işletme yönetimi) ve çalışanlar. Çalışan adımları bilgi içindir, işaretlenmez.
- Her adım tek cümlelik bir iştir ve somut bir çıktısı vardır (adım yapıldığında ortaya çıkan sonuç). Çıktısı olmayan adım takip edilemez.
- İşletme raporundaki İK adımları işletmeye özeldir; işletmeler arasında birleştirilmez (R-04). Kurumdaki bir İK adımına bağlanan satır şu kalıpla yazılır: `Kurum planı N · İK · İlk 30 gün · Kısa ad`. Kısa ad, kurum adımının metninden ilk sözcüklerle bulunabilecek kadar açık olmalıdır; HPW Act bu satırı kurum adımına bağlar ve durumunu oradan gösterir.
- Aynı plan, rol ve aşamada adımlar sıra numarasıyla ayrılır.

## İzleme göstergeleri

- Raporun izleme tablosu: madde kodu, madde metni, bağlı olduğu plan, mevcut, karşılaştırma, sektör ve hedef. Bir sonraki ölçümde bu maddelerin değeri raporla karşılaştırılır.

## Dosyaya girmeyenler

- Çalışan alıntıları ve açık uçlu yorumlar HPW Act'e girmez.
- Rapordaki grafikler, açıklayıcı metinler ve ekler dosyaya girmez; yalnız ana sonuç başlığı ve kısa özet her yol haritasının başında gösterilir.

## Yükleme

Dosyayı Happy Place to Work sorumlusu yükler: Şirketler → şirket → Kurulum → 2 · Yol haritası. Dosya önce denetlenir; hata varken yüklenmez. Yeni yükleme eski yol haritasının yerini alır; aynı plan, rol, aşama ve metindeki adımların durumu korunur.
