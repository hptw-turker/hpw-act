/** Aktörler: her rol için kapsam, gezinme ve dikkat kuyruğu. Gerçek sistemde bunlar RoleAssignment + packages/policy'den gelir. */
export type Route = '/' | '/donem' | '/excel' | '/musteri-kur' | '/kurumsal' | '/sonuclar' | '/birimler' | '/hedefler' | '/aksiyonlar' | '/yerel-uygulamalar' | '/kanit' | '/karne' | '/organizasyon' | '/kullanicilar' | '/ayarlar' | '/musteriler' | '/metodoloji' | '/denetim';
export type Severity = 'critical' | 'warning' | 'info';
export interface AttentionItem { id: string; severity: Severity; title: string; entity: string; due: string | null; sla: string; to: Route; }
export interface Persona {
  id: string; name: string; roleCode: string; roleLabel: string; org: 'Atlas Holding' | 'HPTW'; unitLabel: string;
  scope: 'company' | 'gmy' | 'region' | 'unit' | 'tenant' | 'platform' | 'none';
  unitId?: string;
  nav: Route[];
  homeClaim: string;
  attention: AttentionItem[];
}

export const ROUTE_LABEL: Record<Route, string> = {
  '/': 'Dikkat', '/donem': 'Dönem', '/excel': 'Excel ile kurulum', '/kurumsal': 'Kurumsal', '/sonuclar': 'Sonuçlar', '/birimler': 'Birimler', '/hedefler': 'Hedefler', '/aksiyonlar': 'Aksiyonlar',
  '/yerel-uygulamalar': 'Yerel uygulamalar', '/kanit': 'Kanıt', '/karne': 'Karne', '/organizasyon': 'Organizasyon', '/kullanicilar': 'Kullanıcılar',
  '/ayarlar': 'Ayarlar', '/musteriler': 'Müşteriler', '/musteri-kur': 'Müşteri kur', '/metodoloji': 'Metodoloji', '/denetim': 'Denetim',
};

export const PERSONAS: Persona[] = [
  { id: 'ceo', name: 'Ahmet Karaca', roleCode: 'executive', roleLabel: 'Genel Müdür', org: 'Atlas Holding', unitLabel: 'Atlas Holding', scope: 'company',
    nav: ['/', '/donem', '/kurumsal', '/hedefler', '/karne'], homeClaim: 'karar sizi bekliyor. Gerisi organizasyonda.',
    attention: [
      { id: 'c1', severity: 'critical', title: 'Kurumsal istenen değer onayınızı bekliyor: GUV-01 "yöneticim bana bireysel ilgi gösterir" 55,2 → 62 (madde düzeyi; sürecin başlangıç adımı)', entity: 'Atlas Holding · 9 ay · 12 GMY', due: '2026-09-26', sla: '4 iş günü', to: '/kurumsal' },
      { id: 'c2', severity: 'critical', title: '73 şube vardiya planlamasını "kontrolüm dışında" bildirdi', entity: 'Sorun kümesi → kurumsal aksiyon önerisi · Operasyon GMY', due: '2026-09-30', sla: '6 iş günü', to: '/kurumsal' },
      { id: 'c3', severity: 'warning', title: 'İki GMY hedefi çelişiyor: satış temposu × Güven', entity: 'Bireysel İşler GMY · Dijital Kanallar GMY', due: '2026-10-02', sla: '8 iş günü', to: '/kurumsal' },
      { id: 'c4', severity: 'info', title: 'Doğu Anadolu ve Güneydoğu: hedef tavan dışında, dönem uzatma önerisi', entity: '2 bölge · 44 şube', due: null, sla: '—', to: '/hedefler' },
    ] },
  { id: 'gmy', name: 'Selin Aydın', roleCode: 'executive', roleLabel: 'Bireysel İşler GMY', org: 'Atlas Holding', unitLabel: 'Bireysel İşler', scope: 'gmy',
    nav: ['/', '/kurumsal', '/hedefler', '/yerel-uygulamalar', '/karne'], homeClaim: 'konu kararınızı bekliyor.',
    attention: [
      { id: 'g1', severity: 'critical', title: 'Bireysel İşler GUV-01 istenen değeri 62 · 9 bölgeden 2\'sinin yerel önerileri desteklemiyor', entity: 'Doğu Anadolu · Güneydoğu', due: '2026-09-25', sla: '3 iş günü', to: '/hedefler' },
      { id: 'g2', severity: 'warning', title: 'Aylık iletişim toplantısı: 37 şube gecikmiş (%9)', entity: 'Ana aksiyon · 400 şube', due: '2026-09-29', sla: '5 iş günü', to: '/yerel-uygulamalar' },
      { id: 'g3', severity: 'warning', title: 'Marmara → İstanbul Anadolu devri: 12 hedef yeni sahip bekliyor', entity: 'Organizasyon değişikliği 07/2026 · 40 şube', due: '2026-10-06', sla: '10 iş günü', to: '/hedefler' },
    ] },
  { id: 'hr_admin', name: 'Zeynep Demir', roleCode: 'hr_admin', roleLabel: 'İK Yöneticisi', org: 'Atlas Holding', unitLabel: 'İnsan ve Kültür', scope: 'tenant',
    nav: ['/', '/donem', '/excel', '/sonuclar', '/organizasyon', '/kullanicilar', '/ayarlar', '/karne'], homeClaim: 'konu kararınızı bekliyor.',
    attention: [
      { id: 'h1', severity: 'critical', title: 'İK sisteminden 5 taslak organizasyon değişikliği onay bekliyor', entity: 'birleştirme · taşıma (40 şube) · kapanış (10) · açılış (15) · tekrar (1)', due: '2026-09-24', sla: '2 iş günü', to: '/organizasyon' },
      { id: 'h2', severity: 'critical', title: '8 yönetici ayrıldı: 23 hedef ve 41 aksiyon sahipsiz', entity: 'Sahipsiz iş kuyruğu · geçici sorumlu atandı', due: '2026-09-25', sla: '3 iş günü', to: '/kullanicilar' },
      { id: 'h3', severity: 'warning', title: 'Q7 maddesinin ifadesi değişti: eşdeğerlik kararı Metodolog\'da', entity: 'Güven boyutu · madde sürümü 3', due: '2026-09-29', sla: '5 iş günü', to: '/sonuclar' },
      { id: 'h4', severity: 'info', title: 'Saklama süresi dolan 1.240 kanıt dosyası imha kuyruğunda', entity: 'Veri yaşam döngüsü · yasal bekletme yok', due: null, sla: '—', to: '/ayarlar' },
    ] },
  { id: 'hrbp', name: 'Emre Çelik', roleCode: 'hrbp', roleLabel: 'İK İş Ortağı', org: 'Atlas Holding', unitLabel: 'Ege Bölge Direktörlüğü', scope: 'region',
    nav: ['/', '/sonuclar', '/birimler', '/hedefler', '/aksiyonlar', '/yerel-uygulamalar', '/kanit', '/karne'], homeClaim: 'konu kararınızı bekliyor.',
    attention: [
      { id: 'at-1', severity: 'critical', title: 'Ege Bölge GUV-01 istenen değeri mevcut planla desteklenmiyor', entity: 'Ege Bölge Direktörlüğü · Güven 66', due: '2026-09-24', sla: '2 iş günü', to: '/hedefler' },
      { id: 'at-2', severity: 'critical', title: '3 aksiyonun sahibi ayrıldı', entity: 'Şube 302, Şube 303, Şube 305', due: '2026-09-25', sla: '3 iş günü', to: '/aksiyonlar' },
      { id: 'at-3', severity: 'warning', title: 'Kanıt incelemesi bekliyor: aynı dosya 14 aksiyonda', entity: 'Bireysel İşler · 14 yerel uygulama', due: '2026-09-29', sla: '5 iş günü', to: '/kanit' },
      { id: 'at-4', severity: 'warning', title: 'İstisna talebi: Şube 118 hedef 61 → 57', entity: 'İzmir Alan Müdürlüğü 2', due: '2026-09-29', sla: '5 iş günü', to: '/hedefler' },
      { id: 'at-5', severity: 'warning', title: 'Devralınan 12 hedef sizi bekliyor', entity: 'Marmara → İstanbul Anadolu devri', due: '2026-10-06', sla: '10 iş günü', to: '/hedefler' },
      { id: 'at-6', severity: 'info', title: 'Konak Şubesi: ilerleme arttı, güven düştü', entity: 'Vardiya planlama aksiyonu · durum bildirimi', due: null, sla: '—', to: '/aksiyonlar' },
      { id: 'at-7', severity: 'info', title: 'Bütçe açığı: 650.000 ₺ taahhüt edilmedi', entity: 'Mağaza personel eğitimi (ana aksiyon)', due: null, sla: '—', to: '/yerel-uygulamalar' },
    ] },
  { id: 'region_head', name: 'Deniz Koç', roleCode: 'dept_head', roleLabel: 'Bölge Direktörü', org: 'Atlas Holding', unitLabel: 'Ege Bölge Direktörlüğü', scope: 'region',
    nav: ['/', '/birimler', '/hedefler', '/yerel-uygulamalar', '/karne'], homeClaim: 'onay kararı bekliyor.',
    attention: [
      { id: 'r1', severity: 'critical', title: '24 şube hedefi onayınızı bekliyor', entity: 'Ege · GUV-01 madde · yerel öneriler 58,9 · uzlaştırma koşusu #4', due: '2026-09-24', sla: '2 iş günü', to: '/hedefler' },
      { id: 'r2', severity: 'warning', title: 'İstisna talebi: Şube 118 hedef 61 → 57 (kapanış söylentisi)', entity: 'İzmir Alan Müdürlüğü 2 · talep eden: Şube Müdürü', due: '2026-09-29', sla: '5 iş günü', to: '/hedefler' },
      { id: 'r3', severity: 'warning', title: '5 şube aylık iletişim toplantısında gecikmiş', entity: 'Ana aksiyon · Ege', due: '2026-09-29', sla: '5 iş günü', to: '/yerel-uygulamalar' },
    ] },
  { id: 'branch_manager', name: 'Ayşe Yılmaz', roleCode: 'line_manager', roleLabel: 'Şube Müdürü', org: 'Atlas Holding', unitLabel: 'Konak Şubesi', scope: 'unit', unitId: 'SUBE-KONAK',
    nav: ['/', '/birimler', '/hedefler', '/aksiyonlar', '/kanit'], homeClaim: 'iş sizi bekliyor. Metodoloji bilmeniz gerekmiyor.',
    attention: [
      { id: 'b1', severity: 'critical', title: 'Yerel gelişim hedefi önerisi: GUV-01 "yöneticim bana bireysel ilgi gösterir" 44,6 → 51 (makul aralık 48–54)', entity: 'Kabul et / değiştir / uygun değil', due: '2026-09-26', sla: '4 iş günü', to: '/hedefler' },
      { id: 'b2', severity: 'warning', title: 'Vardiya planlama aksiyonu: haftalık durum bildirimi', entity: 'İlerleme %40 · güven: orta', due: '2026-09-25', sla: '3 iş günü', to: '/aksiyonlar' },
      { id: 'b3', severity: 'warning', title: '1 eksik görüşme kaydı: 7 / 8', entity: 'Aylık birebir görüşme programı', due: '2026-11-30', sla: 'pencere sonu', to: '/kanit' },
    ] },
  { id: 'action_owner', name: 'Can Öztürk', roleCode: 'action_owner', roleLabel: 'Şube Müdür Yardımcısı (aksiyon sahibi)', org: 'Atlas Holding', unitLabel: 'Konak Şubesi', scope: 'unit', unitId: 'SUBE-KONAK',
    nav: ['/', '/kanit'], homeClaim: 'aksiyon sizde. Sahip her zaman bir yöneticidir; çalışana hedef ya da aksiyon atanmaz.',
    attention: [
      { id: 'o1', severity: 'warning', title: 'Vardiya planını çalışanla birlikte yap: 2. toplantı tutanağı bekleniyor', entity: '8 hafta içinde 2 tutanak · 1 yüklendi', due: '2026-10-15', sla: 'pencere sonu', to: '/kanit' },
      { id: 'o2', severity: 'info', title: 'Durum bildirimi: bu hafta ilerleme ve güven', entity: 'Cuma hatırlatması', due: '2026-09-25', sla: '3 iş günü', to: '/kanit' },
    ] },
  { id: 'enabler', name: 'Merve Şahin', roleCode: 'enabler_unit', roleLabel: 'Akademi Müdürü (destekleyici birim)', org: 'Atlas Holding', unitLabel: 'Akademi Müdürlüğü', scope: 'gmy',
    nav: ['/', '/hedefler', '/yerel-uygulamalar'], homeClaim: 'talep sizi bekliyor. Şube skorlarını görmezsiniz; yerel uygulamaları görürsünüz.',
    attention: [
      { id: 'e1', severity: 'critical', title: 'Katkı hedefi: 24 Ege şubesinde yönetici eğitimi tamamlanma ≥ %90', entity: 'katkı hedefi · hedef sahibi: Ege Bölge', due: '2026-12-31', sla: 'dönem', to: '/hedefler' },
      { id: 'e2', severity: 'warning', title: 'Mağaza personel eğitimi: bütçe açığı 650.000 ₺', entity: 'Kaynak ihtiyacı 2,0 M ₺ · taahhüt 1,35 M ₺', due: '2026-10-10', sla: '12 iş günü', to: '/yerel-uygulamalar' },
    ] },
  { id: 'viewer', name: 'Kerem Arslan', roleCode: 'viewer', roleLabel: 'İzleyici', org: 'Atlas Holding', unitLabel: 'Kurumsal İletişim', scope: 'company',
    nav: ['/', '/karne'], homeClaim: 'Bekleyen karar yok; yalnız izleme yetkiniz var.', attention: [] },
  { id: 'hpw_admin', name: 'Ozan Kılıç', roleCode: 'hpw_super_admin', roleLabel: 'HPTW Sistem Yöneticisi', org: 'HPTW', unitLabel: 'Sistem', scope: 'platform',
    nav: ['/excel', '/', '/musteriler', '/musteri-kur', '/ayarlar', '/denetim'], homeClaim: 'sistem olayı ilgi bekliyor.',
    attention: [
      { id: 'p1', severity: 'critical', title: 'Atlas Holding: görünüm gecikmesi 41 sn (hedef 30 sn)', entity: 'Kuyruk derinliği 12.400 · organizasyon değişikliği süreci çalışıyor', due: null, sla: '—', to: '/musteriler' },
      { id: 'p2', severity: 'warning', title: 'Müşteri kotası: Beta Sigorta toplu işlem sınırına yaklaştı (%92)', entity: 'toplu işlem / gün', due: null, sla: '—', to: '/musteriler' },
      { id: 'p3', severity: 'info', title: 'Felaket kurtarma tatbikatı: son 34 gün önce (hedef 30)', entity: 'veri kaybı 3 dk · kurtarma 22 dk', due: '2026-09-30', sla: '6 iş günü', to: '/musteriler' },
    ] },
  { id: 'hpw_consultant', name: 'İpek Doğan', roleCode: 'hpw_consultant', roleLabel: 'HPTW Danışman', org: 'HPTW', unitLabel: '4 müşteri', scope: 'tenant',
    nav: ['/', '/donem', '/musteriler', '/musteri-kur', '/aksiyonlar', '/karne'], homeClaim: 'müşteri konusu ilgi bekliyor.',
    attention: [
      { id: 'k1', severity: 'warning', title: 'Atlas Holding: 14 aksiyonda aynı kanıt dosyası — inceleme desteği istendi', entity: 'Bireysel İşler · İK İş Ortağı talebi', due: '2026-09-29', sla: '5 iş günü', to: '/karne' },
      { id: 'k2', severity: 'info', title: 'Aksiyon kütüphanesi: "vardiya planlama" şablonuna 3 müşteriden etkinlik verisi', entity: 'etkinlik istatistiği · karşılaştırılabilir 2/3', due: null, sla: '—', to: '/aksiyonlar' },
    ] },
  { id: 'hpw_methodologist', name: 'Elif Kurt', roleCode: 'hpw_methodologist', roleLabel: 'HPTW Metodolog', org: 'HPTW', unitLabel: 'Metodoloji', scope: 'tenant',
    nav: ['/', '/metodoloji', '/sonuclar'], homeClaim: 'metodoloji kararı bekliyor.',
    attention: [
      { id: 'm1', severity: 'critical', title: 'Q7 ifadesi değişti: aynı mı, eşdeğer mi, değişti mi?', entity: 'Atlas Holding · Güven · 2027 ölçümünü etkiler', due: '2026-09-29', sla: '5 iş günü', to: '/metodoloji' },
      { id: 'm2', severity: 'warning', title: 'Karşılaştırılabilirlik incelemesi: Çağrı Merkezi 2, n 650 → 41', entity: 'inceleme gerekli · hedef sonucu askıda', due: '2026-10-01', sla: '7 iş günü', to: '/metodoloji' },
    ] },
  { id: 'hpw_auditor', name: 'Tolga Çetin', roleCode: 'hpw_auditor', roleLabel: 'HPTW Denetçi', org: 'HPTW', unitLabel: 'Denetim (salt okunur)', scope: 'tenant',
    nav: ['/', '/denetim'], homeClaim: 'Bekleyen karar yok; denetim izi salt okunur.', attention: [] },
];

export const SCOPE_LABEL: Record<Persona['scope'], string> = { company: 'şirket', gmy: 'iş kolu', region: 'bölge', unit: 'birim', tenant: 'müşteri şirket', platform: 'sistem', none: 'yok' };
export const DEFAULT_PERSONA = 'hrbp';
export const byId = (id: string) => PERSONAS.find(p => p.id === id) ?? PERSONAS.find(p => p.id === DEFAULT_PERSONA)!;
