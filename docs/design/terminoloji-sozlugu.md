# Arayüz terminoloji sözlüğü (bağlayıcı)

Kullanıcının gördüğü her metin bu sözlüğe uyar; `tools/scripts/ui-kota-dili-tara.py` yasaklı ifadeleri prototipte, i18n kataloğunda ve kılavuz metinlerinde tarar; CI dışında sürüm öncesi çalıştırılır.

| Yasaklı | Yerine |
|---|---|
| size düşen pay, sana düşen pay, bölgenin hedefinden payınız | yerel gelişim hedefiniz |
| kurumsal olarak senden beklenen (sayı) | şirket genelindeki yön: Güven (sayısız) |
| hedef dağıtımı, dağıtımı hesapla, allocation | uzlaştırma / uzlaştır |
| kota, quota | — (kavram yok) |
| katkı tahmini (birim ekranında) | — (birim ekranında gösterilmez); bölge/merkezde: katkı projeksiyonu |
| nedensel güven, bu aksiyon +X puan getirdi | atıf kanıtı derecesi; "zamansal ilişki var; nedensellik kanıtlanmadı" (C) |
| veri güveni %63 | veri güveni: Düşük / Orta / Yüksek |
| birim yine de hedef alabilir (n<5) | birim sayısal yerel hedef almaz; üst birim önceliğine bağlı yönetim aksiyonu alabilir |
| iki hedef (biri kurumsal pay) | yerel gelişim hedefleriniz (en fazla iki, ikisi de yerel veriden) |
| tamamlandı = doğrulandı, işe yaradı | tamamlandı ≠ doğrulandı ≠ sonuç iyileşti ≠ bu aksiyon nedeniyle iyileşti |

Kullanılacak terimler: kurumsal ambition (arayüzde: istenen değer), yerel hedef, makul gelişim aralığı, öneri, dayanak, uzlaştırma, desteklenen değer, azami değer, fark, katkı projeksiyonu (yalnız bölge/merkez), fonksiyonel katkı KPI'sı, şiddet, veri güveni (etiket), sahip (rol), kanıt seviyesi E0–E4, atıf kanıtı derecesi A–D, gözlenen değişim.

## v2.4 ekleri
- "Madde" takip birimidir; "boyut" ve "indeks" türetilmiş görünüm. Arayüzde hedef, aksiyon ve kanıt hep madde kodu + madde metniyle anılır (GUV-01 "…").
- "Sorumluluk merkezi" ve "etkileşim alanı" her madde satırında yazılır; "müdahaleye yetkili rol" sorumluluk merkezinden gelir.
- "Boyut ortalaması boyut içi yayılımı gizler": boyut özeti her zaman yayılım (en düşük–en yüksek madde) ile birlikte gösterilir.
- "Sonuç paketi" (hpw-act-result-bundle): yükleme birimi; "algılanan enstrüman", "türetilen paneller".
- Yasaklı: "Güven hedefi" gibi boyut hedefi ifadeleri (→ madde hedefi); "boyut aksiyonu".
