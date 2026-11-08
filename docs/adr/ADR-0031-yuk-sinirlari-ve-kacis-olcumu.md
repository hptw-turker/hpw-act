# ADR-0031: Yük sınırları domain politikasıdır; Excel/WhatsApp kaçışı ölçülür, kayıt sistemi HPW Act kalır

**Durum:** Kabul edildi (v2.3 kanonik, 24.09.2026)

## Karar
Politika: yerel yönetici için en fazla 2 aktif yerel hedef, 3 aktif aksiyon, ≤3 öneri; dördüncüsü istenirse sistem "mevcut üç aksiyondan biri tamamlanmadan yeni aksiyon önerilmiyor" der ya da merkezi destek/alternatif sahip ister; dikkat ekranında yinelenen istisnalar demetlenir. Kaçış ölçümleri: bildirim açılış → karar süresi, deep-link tamamlama oranı, takipsiz export oranı, elle Excel içe alma sıklığı, dikkat öğesi yeniden açma oranı, hedef üzerine yazma oranı, "uygun değil" neden dağılımı, işlemsiz giriş oranı. CSV export serbesttir ama karar durumu dışarıda değişmez; içe alma açık ve kontrollü bir komuttur; WhatsApp bildirim kanalıdır, kanıt ve karar deep-link ile HPW Act'a yazılır. Veri güveni kullanıcıya yüzde değil Düşük/Orta/Yüksek etiketiyle gösterilir; gözlemsel etkinlik aksiyon sıralamasında ilk kriter olamaz (sözlüksel sıra: sahip uygunluğu, bağlam, kanıt olgunluğu, çaba, sinyal süresi, en sonda gözlemsel geçmiş).

## Gerekçe
Yöneticinin zaman kısıtı post-survey sürecinin en sık kırılma noktasıdır; kullanıcı Excel'e kaçıyorsa HPW Act'taki iş daha zordur.

## Sonuçlar
- Mimari belge v2.3 bağlayıcıdır; `packages/domain-core` ve `db/migrations/0001_core.sql` bu kararı uygular; kabul testleri T-64..T-69 doğrular.
