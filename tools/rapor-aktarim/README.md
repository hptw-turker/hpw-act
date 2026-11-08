# Rapor aktarım yardımcıları (isteğe bağlı)

HPTW birim raporu sunumlarından (PPTX) yol haritası ve Ek A soru listesi verisini yapılandırılmış JSON'a çıkarır. Ant Yapı 2026 aktarımında kullanıldı; formlar bu JSON'dan dolduruldu ve HPW Act'in kendi içe alım hattıyla yüklendi.

- `dump.py <pptx klasörü> <çıktı klasörü>` — her slaytın metin kutularını konumlarıyla JSON'a döker.
- `extract.py <dump klasörü> <çıktı.json>` — kapak, katılım, sertifikasyon puanı, yol haritası bölümünün bütün slaytları (ana sonuç, güçlü yönler, öncelikler, etki alanı, gündem, eylem planları, uygulama adımları, roller, uygulama takvimi, izleme hedefleri) ve soru listesi.

Sınırlar: Slayt düzeni 2026 HPTW birim raporu şablonuna göredir; şablon değişirse ayrıştırıcı güncellenmelidir. Çalışan alıntıları çıkarılmaz. Ana yol, sunumu hazırlayan Claude'un `docs/rapor-formu/DOLDURMA-PROMPTU.md` ile formları doldurmasıdır; bu araçlar yalnız denetim ve hızlandırma içindir. HPW Act hiçbir durumda PPTX okumaz.
