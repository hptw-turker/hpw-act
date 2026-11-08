# language: tr
Özellik: Kanıt ve doğrulama — M06
  Senaryo: T-25 "Tamamlandı" düğmesi, kanıt yok
    Diyelim ki "1:1 programı" aksiyonunun kanıt gereksinimi 8 hafta içinde 8 toplantı
    Eğer sahip "tamamlandı" derse
    O zaman execution_status "evidence_pending" olur
    Ve "verified" olmaz

  Senaryo: T-24 Sekiz toplantı beklenir, yedi doğrulanır
    Diyelim ki 7 toplantı tutanağı yüklendi
    Eğer doğrulama çalıştırılırsa
    O zaman execution_status "partially_verified" olur
    Ve eksik olarak "1 toplantı kaydı" raporlanır

  Senaryo: T-20 Sahip kritik kanıtta doğrulayıcı olmaya çalışır
    Diyelim ki kanıtı yükleyen kişi "ayse"
    Eğer "ayse" aynı kanıtı doğrulamaya çalışırsa
    O zaman istek 403 "separation_of_duties" ile reddedilir

  Senaryo: T-22 Aynı PDF 14 ilişkisiz aksiyonda
    Diyelim ki aynı SHA-256 hash 14 farklı standalone aksiyonda yüklendi
    Eğer kanıt güveni hesaplanırsa
    O zaman anomaly_flags "duplicate_hash_unrelated" içerir
    Ve durum "review_required" olur
    Ve hiçbir kanıt otomatik "rejected" olmaz

  Senaryo: Aynı ana aksiyonun yerel uygulamalarında aynı duyuru meşru
    Diyelim ki "Aylık iletişim toplantısı" ana aksiyonunun 40 yerel uygulaması aynı duyuru PDF'ini yükledi
    Eğer kanıt güveni hesaplanırsa
    O zaman "duplicate_hash_unrelated" bayrağı oluşmaz

  Senaryo: T-23 Beyan 200, LMS 83
    Diyelim ki sahip 200 katılımcı beyan etti ve LMS bağlayıcısı 83 döndürdü
    Eğer kanıt güveni hesaplanırsa
    O zaman confidence "LOW" olur
    Ve doğrulayıcıya "evidence_review" dikkat öğesi düşer
