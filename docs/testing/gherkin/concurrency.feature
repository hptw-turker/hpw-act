# language: tr
Özellik: Eşzamanlılık ve olay tekilleştirme — M07/M12
  Senaryo: T-14 İki HRBP aynı hedefin 11. sürümünü değiştirir
    Diyelim ki hedef sürümü 11
    Eğer HRBP-A If-Match 11 ile termin değiştirir
    Ve HRBP-B If-Match 11 ile sahip değiştirmeye çalışırsa
    O zaman HRBP-A 200 alır ve sürüm 12 olur
    Ve HRBP-B 409 alır, gövdede currentVersion 12, changedBy "HRBP-A", changedFields ["target_date"] bulunur

  Senaryo: T-31 Aynı komut iki kez gönderilir
    Eğer aynı Idempotency-Key ile check-in iki kez gönderilirse
    O zaman ikinci yanıt birincinin aynısıdır
    Ve yalnızca bir CheckIn kaydı oluşur

  Senaryo: T-13 Outbox relay aynı olayı iki kez yollar
    Eğer "Target.Approved" olayı aynı event_id ile iki kez teslim edilirse
    O zaman fizibilite tüketicisi bir kez çalışır
    Ve yalnızca bir dikkat öğesi üretilir

  Senaryo: T-30 Gecikmiş check-in, aksiyon bu sırada iptal edilmiş
    Diyelim ki aksiyon 14:32'de iptal edildi
    Eğer 14:40'ta If-Match eski sürümle check-in gelirse
    O zaman 409 "SemanticConflict" döner, reason "aggregate_cancelled"
    Ve seçenekler "attach_as_comment" içerir
