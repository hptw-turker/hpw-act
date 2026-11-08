# language: tr
Özellik: Hedef dağıtımı (cascade) — M04
  Arka plan:
    Diyelim ki "2026-ANA" döneminde roll-up hiyerarşisi "idari" olarak işaretli
    Ve şirket "Güven" baseline'ı 62 ve onaylı hedefi 68

  Senaryo: T-02 Alt hedeflerin dondurulmuş ağırlıklı toplamı üst hedefi karşılar
    Diyelim ki kohort BASELINE_FROZEN politikasıyla dondurulmuş
    Eğer şirket hedefi için allocate çalıştırılırsa
    O zaman AllocationRun durumu "FEASIBLE" olur
    Ve önerilerin frozenWeight ile ağırlıklı ortalaması 68'den küçük olmaz
    Ve hiçbir öneri kendi "high" tavanını aşmaz

  Senaryo: T-03 Üst hedef mümkün değil
    Diyelim ki tüm birimlerin tavanı baseline+3 ve şirket hedefi 80
    Eğer allocate çalıştırılırsa
    O zaman durum "INFEASIBLE" olur
    Ve maxAchievable değeri döner
    Ve seçenekler "LOWER_PARENT_TARGET" içerir

  Senaryo: T-04 44 ve 82 baseline'lı birimler
    Eğer allocate çalıştırılırsa
    O zaman 44 baseline'lı birimin delta'sı 82 baseline'lı birimden büyüktür
    Ve iki birime aynı hedef sayısı verilmez

  Senaryo: T-05 Baseline'ı olmayan yeni şube
    Diyelim ki "SUBE-YENI-01" biriminin baseline'ı yok
    Eğer kohort dondurulur ve allocate çalıştırılırsa
    O zaman "SUBE-YENI-01" inclusion_state "no_baseline" olur
    Ve paydaya (W) dahil edilmez
    Ve "priority_only" türünde hedef alır

  Senaryo: T-07 Aynı birim iki kanonik kenarla bağlanamaz
    Diyelim ki "SUBE-KONAK" için aktif bir inherited kenar var
    Eğer aynı üst hedefe ikinci bir shared kenar eklenirse
    O zaman istek "canonical_edge_violation" ile reddedilir

  Senaryo: T-50 Üst hedef yükseltilir ama kalan alan yok
    Diyelim ki tüm alt hedefler tavanda
    Eğer şirket hedefi 72'ye yükseltilirse
    O zaman üst hedef "at_risk" olur
    Ve üst hedef sahibine "feasibility_dropped" dikkat öğesi düşer
