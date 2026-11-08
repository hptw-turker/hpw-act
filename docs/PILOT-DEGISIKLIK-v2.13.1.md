# HPW Act pilot v2.13.1 — v2.13.0'a göre dar düzeltme

**Hedef kararından önce AI.** Yeni hedef formunda "Öneriyi gör"den sonra (HPW aralığı ve sistem önerisi görünür) "✨ Yapay zekâdan yardım al" tek çağrıyla planı ve AI hedef önerisini üretir; hedef kaydı yazılmaz. "AI hedefini kullan" yalnız "Hedef değer" alanını doldurur (değer sunucunun izinli aralığında olmalıdır; öneri yoksa düğme görünmez); kullanıcı değeri değiştirebilir ve hedefi mevcut "Öneriyi kabul et" akışıyla kendisi oluşturur. Hedef oluşturulunca aynı plan yeni sağlayıcı çağrısı yapılmadan hedefe bağlanır. Hedef oluşturulmazsa plan hiçbir hedef ya da aksiyon kaydı değildir (ekranda yazılıdır).

**Migrasyon 0021** (`0021_v2131_ai_hedef_oncesi.sql`; 0020 değişmedi): `ai_plan.target_id` boş olabilir (önizleme planı), `bound_at`; önizleme araması için dizin; uygulama rolüne yalnız `target_id` ve `bound_at` sütunlarında güncelleme yetkisi (plan içeriği değişmez); `ai_call_log` önizleme çağrıları için birim ve madde tutar.

**İstem/şema V2.** `HPW_AI_ACTION_PLAN_V2` / `hpw-ai-action-plan/2`: her ana aksiyonda doğrulanan `cadence` (weekly, biweekly, monthly, quarterly, once). V1 planlar okunmaya devam eder (cadence yoksa aylık).

**Aksiyon tarih ve sıklığı.** Taslağa aktarımda sıklık plandan gelir; tarih çıpası hedefin kabul tarihidir (kabul kaydı yoksa hedefin oluşturulma tarihi): başlangıç = çıpa + (startMonth − 1) ay, bitiş = çıpa + endMonth ay − 1 gün, en geç çıpa + takip ufku. Ay hesabı UTC tarihle ve ay sonuna kırpılarak deterministiktir.

**Plan ayrıntısı Aksiyonlar'da.** AI kökenli aksiyonda "AI planını gör" amaç, gerekçe, adımlar, göstergeler, gerekli kanıt, bağımlılıklar, riskler, önerilen dönem ve roller içeren kartı salt okunur açar; "öneridir, gerçekleşme ya da kanıt değildir" yazılıdır.

**Bayatlık.** Parmak izi temel veriden hesaplanır (sonuçlar, aralık, dönem, diğer aksiyonlar, kurumsal istek); hedefin oluşması/kabulü ve planın kendi açtığı aksiyonlar planı bayatlatmaz. Bayat plandan aksiyon aktarılamaz (sunucu 409; ekranda aktarım kapalı); önce "Planı yeniden oluştur". Açılmış aksiyonlar silinmez ya da değişmez.

**Bağlam.** Seçili sorunun şirket değeri ve sertifikalı kıyas değeri (varsa) ayrı alanda; diğer görünür sorularda kıyas değeri de taşınır. v2.13.0'da kurumsal istek bağlamı, ucun yanıt biçimi yüzünden hiç dolmuyordu; düzeltildi.
