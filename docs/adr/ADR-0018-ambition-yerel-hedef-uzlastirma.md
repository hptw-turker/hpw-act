# ADR-0018: Kurumsal ambition ≠ yerel hedef ≠ katkı tahmini; yerel-önce uzlaştırma; resmî toplama ağırlığı

**Durum:** Kabul edildi (v2.2 semantik kilit, 23.09.2026)

## Karar
Target.kind ∈ {corporate_ambition, local_numeric, maintain, contribution_kpi, priority_only}. Yerel hedef birimin kendi verisinden (akran dağılımı P65/P80, yetersizse metodoloğun kalıcı bantları) ambition'dan bağımsız üretilir; anlamlı en küçük hareketin altında MAINTAIN. TargetReconciliationRun: yerel önerilerin resmî ağırlıklı toplamı = desteklenen değer; tavanlarla azami; SUPPORTED / GAP / INFEASIBLE. Fark hiçbir zaman sessizce dağıtılmaz: GAP'te 'tavanlar içinde esnetme' bir seçenek olarak hesaplanır ve karar Genel Müdür'e sunulur (ambition düşür / merkezi müdahale ekle / esnetmeyi bilerek kabul et / süreyi uzat). Ağırlık yanıt sayısı değil, sonuç dosyasında gelen aggregation_weight; HPW Act'ın üst skoru HPTW raporuyla birebir tutmalı (sürüm kapısı testi T-57). Katkı yalnız açıklama/tahmindir; birim düzeyinde gösterilmez.

## Gerekçe
v2.1 allocate() yerel bantlardan başlıyor, tavanı aşmıyordu ama şirket hedefi tutmayınca farkı otomatik dağıtıp onaya sunuyordu; yumuşatılmış kota. Hedef bir performans kotası gibi tasarlanırsa oyunlaştırma ve dar odak doğurur. Yerel-önce + kısıtlı uzlaştırma, top-down ile bottom-up'ın doğru orta yoludur; kapalı çözüm (kalan alan oranında) yöneticinin hesap makinesiyle yeniden üretebileceği kadar açıktır.

## Sonuçlar
- Mimari belge bölüm 24 bağlayıcıdır; `packages/domain-core` bu kararı uygular, kabul testleri T-55..T-62 doğrular.
