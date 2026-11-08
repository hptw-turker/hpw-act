#!/bin/sh
# HPW Act v3.0 teslimatı. İki ayrı ZIP:
#  1) HPW_Act_v3.0.0_<build>.zip — müşteri verisi YOK: SUNUCU (Claude Code ile kurulum), YEREL_DENEME (boş başlatıcı), SABLONLAR, BELGELER, GELISTIRICI_KAYNAK, KANITLAR
#  2) HPW_Act_v3.0.0_ANTYAPI_DENEME_<build>.zip — yalnız Ant Yapı denemesi: yükleme Excel'leri + Ant Yapı yüklenmiş yerel deneme kurulumu (ANT_DUMP verilirse)
# Kullanım: OUT=/mnt/user-data/outputs ANT_DIR=<excel klasörü> ANT_DUMP=<pg_dump -Fc> ANT_SHOTS=<ekran görüntüleri> sh ops/paketle-v3.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="${OUT:-/mnt/user-data/outputs}"; VER="3.0.0"; T="$(mktemp -d)"
[ -f "$ROOT/apps/api/dist/src/server.js" ] || { echo "apps/api derlenmemiş: (cd apps/api && npx tsc -p tsconfig.json)"; exit 2; }
BUILD="$( (cd "$ROOT" && find apps/api/dist apps/web/dist db/migrations -type f | sort | xargs cat) | sha256sum | cut -c1-12)"
# ortak çalışma zamanı
RT="$T/runtime/assets/app"; mkdir -p "$RT/apps/api" "$RT/apps/web" "$RT/db"
cp -R "$ROOT/apps/api/dist" "$ROOT/apps/api/package.json" "$ROOT/apps/api/package-lock.json" "$RT/apps/api/"
cp -R "$ROOT/apps/api/node_modules" "$RT/apps/api/node_modules"; rm -rf "$RT/apps/api/node_modules/@hpw-act"
( cd "$RT/apps/api" && npm prune --omit=dev --no-audit --no-fund >/dev/null 2>&1 ) || true
rm -rf "$RT/apps/api/node_modules/@hpw-act"; mkdir -p "$RT/apps/api/node_modules/@hpw-act/domain-core"; cp -R "$ROOT/packages/domain-core/package.json" "$ROOT/packages/domain-core/dist" "$RT/apps/api/node_modules/@hpw-act/domain-core/"
[ -f "$RT/apps/api/node_modules/@hpw-act/domain-core/dist/index.js" ] && [ -f "$RT/apps/api/node_modules/fastify/package.json" ] && [ -f "$RT/apps/api/node_modules/pg/package.json" ] || { echo "çalışma zamanı bağımlılıkları eksik"; exit 3; }
cp -R "$ROOT/apps/web/dist" "$RT/apps/web/dist"; rm -f "$RT/apps/web/dist/index.html" "$RT/apps/web/dist/hpw-act-prototip.html"; rm -rf "$RT/apps/web/dist/prototip"
cp -R "$ROOT/db/migrations" "$RT/db/migrations"
# yerel başlatıcı klasörü üretir: $1 hedef, $2 env (bos|demo), $3 port, $4 pgport, $5 başlık, $6 ilk giriş metni (HTML)
launcher() {
  D="$1"; ORIGIN="http://localhost:$3"; LAUNCH="HPW_Act_Baslat.command"; mkdir -p "$D/CALISTIRMA"; cp -R "$T/runtime/assets" "$D/assets"
  sed -e "s#__ENV_TITLE__#$5#g" -e "s#__ENV_LABEL__#$5#g" -e "s#__ENV__#$2#g" -e "s#__ORIGIN__#$ORIGIN#g" -e "s#__BUILD_ID__#$BUILD#g" -e "s#__LAUNCHER__#$LAUNCH#g" "$ROOT/ops/paket/index.template.html" > "$D/index.html"
  sed -e "s#__ENV_TITLE__#$5#g" -e "s#__ENV__#$2#g" -e "s#__PORT__#$3#g" -e "s#__HOST__#localhost#g" -e "s#__PGPORT__#$4#g" -e "s#__ORIGIN__#$ORIGIN#g" -e "s#__BUILD_ID__#$BUILD#g" -e "s#__DEMO_DATA__#0#g" "$ROOT/ops/paket/launcher.template.sh" > "$D/CALISTIRMA/$LAUNCH"; chmod +x "$D/CALISTIRMA/$LAUNCH"; cp "$D/CALISTIRMA/$LAUNCH" "$D/CALISTIRMA/${LAUNCH%.command}.sh"; sh -n "$D/CALISTIRMA/$LAUNCH"
  sed -e "s#__ENV_TITLE__#$5#g" -e "s#__ENV__#$2#g" -e "s#__ORIGIN__#$ORIGIN#g" -e "s#__LAUNCHER__#$LAUNCH#g" -e "s#__FIRST_LOGIN__#$6#g" -e "s#__RESET_NOTE__#Sıfırlamak için CALISTIRMA/pgdata-$2 klasörünü ve CALISTIRMA/.env.$2 dosyasını silip başlatıcıyı yeniden çalıştırın.#g" "$ROOT/ops/paket/NASIL_ACARIM.template.html" > "$D/NASIL_ACARIM.html"
  printf '{"product":"HPW Act","version":"%s","build":"%s","env":"%s","origin":"%s","port":%s,"pgport":%s,"launcher":"CALISTIRMA/%s","mail":"sandbox","secrets_in_package":false,"generated":"%s"}\n' "$VER" "$BUILD" "$2" "$ORIGIN" "$3" "$4" "$LAUNCH" "$(date -u +%FT%TZ)" > "$D/runtime-manifest.json"
}
# ---------- 1) ana paket ----------
TOP="$T/HPW_Act_v$VER"; mkdir -p "$TOP/SUNUCU" "$TOP/SABLONLAR" "$TOP/BELGELER" "$TOP/GELISTIRICI_KAYNAK" "$TOP/KANITLAR"
cp "$ROOT/ops/sunucu/SUNUCU-KURULUMU.md" "$ROOT/ops/sunucu/SUNUCU-KURULUMU.pdf" "$TOP/SUNUCU/"; cp -R "$ROOT/ops/sunucu" "$TOP/SUNUCU/ops-sunucu-kopyasi"
launcher "$TOP/YEREL_DENEME" bos 8788 54328 "YEREL DENEME — boş kurulum" '<p>Bu kurulumda hiçbir şirket ya da kullanıcı yoktur. Giriş ekranı "İlk kurulum · HPW yöneticisi" formunu gösterir: e-postanızı ve parolanızı belirleyin, <code>CALISTIRMA/ILK_KURULUM_ANAHTARI.txt</code> dosyasındaki satırı "Kurulum anahtarı" alanına yapıştırın. Sonra Şirketler → Yeni şirket → Kurulum: üç dosya.</p>'
cp "$ROOT/docs/xlsx-sablonlar-bos/HPW_Act_org.xlsx" "$ROOT/docs/xlsx-sablonlar-bos/HPW_Act_yol_haritasi_v3.xlsx" "$ROOT/docs/xlsx-sablonlar-bos/HPW_Act_users.xlsx" "$TOP/SABLONLAR/"
cp "$ROOT/docs/guides/v3/HPW-Act-v3-Kisa-Kilavuz.pdf" "$ROOT/docs/rapor-formu/RAPOR-KURALLARI.pdf" "$ROOT/docs/PILOT-DEGISIKLIK-v3.0.0.md" "$ROOT/docs/adr/ADR-0043-sade-hpw-act-v3.md" "$ROOT/docs/REVIZE-NOTLARI.md" "$TOP/BELGELER/"
( cd "$ROOT" && tar --exclude='node_modules' --exclude='apps/api/var' --exclude='apps/api/.env.*' --exclude='apps/api/dist' --exclude='apps/web/dist' --exclude='.git' --exclude='*.zip' --exclude='data/atlas/*.json' --exclude='data/atlas/*.csv' --exclude='apps/web/dist-single' --exclude='ops/sunucu/.env' --exclude='ops/sunucu/yedekler' --exclude='*antyapi*' --exclude='*ANTYAPI*' -cf - apps packages db ops docs tools data DEVIR-v3.0.md CLAUDE.md pnpm-lock.yaml KURULUM.md NASIL-CALISTIRILIR.md tsconfig.base.json pnpm-workspace.yaml package.json README.md NEREDEN-BASLARIM.md docker-compose.yml ) | ( cd "$TOP/GELISTIRICI_KAYNAK" && tar -xf - )
# eski sürümlerin test çıktıları ve rol kılavuzları önceki paketlerdedir; kaynakta yalnız v3 kılavuzu kalır (sunucuya kopyalanan klasör küçük kalsın)
rm -rf "$TOP/GELISTIRICI_KAYNAK/docs/test-ciktilari"; find "$TOP/GELISTIRICI_KAYNAK/docs/guides" -mindepth 1 -maxdepth 1 ! -name v3 -exec rm -rf {} +
[ -d "$ROOT/docs/test-ciktilari/v300" ] && cp -R "$ROOT/docs/test-ciktilari/v300" "$TOP/KANITLAR/test-ciktilari-v300"
cp "$ROOT/DEVIR-v3.0.md" "$TOP/DEVIR-v3.0.md"
cat > "$TOP/OKU-BENI.md" <<EOT
# HPW Act v$VER (build $BUILD)

- **SUNUCU/** — sunucuya kurulum. Claude Code'a "SUNUCU/SUNUCU-KURULUMU.md dosyasını uygula" demeniz yeterli; alan adı, sunucu erişimi ve SMTP bilgisi sizden istenir. Kurulum dosyaları GELISTIRICI_KAYNAK/ops/sunucu içindedir.
- **YEREL_DENEME/** — kendi bilgisayarınızda boş bir kurulum (müşteri verisi yok). NASIL_ACARIM.html dosyasını açın.
- **SABLONLAR/** — üç boş yükleme şablonu: organizasyon, yol haritası (rapordan), kullanıcılar.
- **BELGELER/** — kısa kılavuz, rapor ile HPW Act arasındaki kurallar, değişiklik özeti, karar kaydı (ADR-0043), revize notları.
- **GELISTIRICI_KAYNAK/** — kaynak kod (müşteri verisi yok). Yeni bir Claude Code oturumu önce `GELISTIRICI_KAYNAK/DEVIR-v3.0.md` dosyasını okur.
- **DEVIR-v3.0.md** — yeni Claude Code oturumu için devir belgesi (kaynaktakinin kopyası).
- **KANITLAR/** — test çıktıları.

Bu pakette hiçbir müşteriye ait veri yoktur. Ant Yapı denemesi ayrı pakettedir.
EOT
# temizlik denetimi: ana pakette müşteri verisi yok
for f in "$TOP/YEREL_DENEME/CALISTIRMA/hpw_act_demo.dump" "$TOP/YEREL_DENEME/CALISTIRMA/.env.bos"; do [ -e "$f" ] && { echo "ana paket kirli: $f"; exit 4; }; done
find "$TOP" -iname '*antyapi*' | grep -q . && { echo "ana pakette ANTYAPI dosyası var"; find "$TOP" -iname '*antyapi*'; exit 4; } || true
( cd "$TOP" && find . -type f ! -name MANIFEST.json -print0 | sort -z | xargs -0 sha256sum ) | python3 -c "
import sys, json, datetime
files=[{'path': l.split('  ',1)[1].strip()[2:], 'sha256': l.split('  ',1)[0]} for l in sys.stdin if l.strip()]
json.dump({'version':'$VER','build':'$BUILD','generated':datetime.datetime.utcnow().isoformat()+'Z','count':len(files),'files':files}, open('$TOP/KANITLAR/MANIFEST.json','w'), ensure_ascii=False, indent=0)"
( cd "$T" && rm -f "$OUT"/HPW_Act_v${VER}_[0-9a-f]*.zip && zip -qry "$OUT/HPW_Act_v${VER}_$BUILD.zip" "HPW_Act_v$VER" ); echo "ana paket: $OUT/HPW_Act_v${VER}_$BUILD.zip"
# ---------- 2) Ant Yapı deneme paketi ----------
if [ -n "$ANT_DIR" ]; then
  AT="$T/HPW_Act_v${VER}_ANTYAPI_DENEME"; mkdir -p "$AT/1_EXCEL_YUKLEME"
  cp "$ANT_DIR"/ANTYAPI_0*.xlsx "$AT/1_EXCEL_YUKLEME/"
  if [ -n "$ANT_DUMP" ]; then
    launcher "$AT/2_DENEME_KURULUMU" demo 8789 54329 "ANT YAPI DENEMESİ" '<p>Ant Yapı yüklenmiş deneme kurulumu. Giriş bilgileri <code>CALISTIRMA/DENEME-GIRIS-BILGILERI.md</code> dosyasındadır. Şirket girişi: <code>http://localhost:8789/g/ANTYAPI</code>.</p>'
    cp "$ANT_DUMP" "$AT/2_DENEME_KURULUMU/CALISTIRMA/hpw_act_demo.dump"
    su postgres -c "psql -d ${ANT_DB:-hpw_act_v3dene_test} -Atc \"SELECT 'tenant='||(SELECT COUNT(*) FROM tenant)||' rm2_roadmap='||(SELECT COUNT(*) FROM rm2_roadmap)||' rm2_step='||(SELECT COUNT(*) FROM rm2_step)||' membership='||(SELECT COUNT(*) FROM membership)\"" > "$AT/2_DENEME_KURULUMU/CALISTIRMA/demo-manifest.txt"
    [ -n "$ANT_LOGIN" ] && cp "$ANT_LOGIN" "$AT/2_DENEME_KURULUMU/CALISTIRMA/DENEME-GIRIS-BILGILERI.md"
  fi
  [ -n "$ANT_SHOTS" ] && mkdir -p "$AT/3_EKRAN_GORUNTULERI" && cp "$ANT_SHOTS"/*.png "$AT/3_EKRAN_GORUNTULERI/"
  [ -n "$ANT_README" ] && cp "$ANT_README" "$AT/OKU-BENI.md"
  ( cd "$T" && rm -f "$OUT"/HPW_Act_v${VER}_ANTYAPI_DENEME_*.zip && zip -qry "$OUT/HPW_Act_v${VER}_ANTYAPI_DENEME_$BUILD.zip" "HPW_Act_v${VER}_ANTYAPI_DENEME" ); echo "Ant paketi: $OUT/HPW_Act_v${VER}_ANTYAPI_DENEME_$BUILD.zip"
fi
echo "BUILD=$BUILD"; rm -rf "$T"
