#!/bin/sh
# Tek ana ZIP: HPW_Act_TESLIMAT_<surum>/{DOLU_DEMO,BOS_BASLANGIC,GELISTIRICI_KAYNAK,KANITLAR}. Her uygulama klasörünün kökünde index.html + NASIL_ACARIM.html.
# assets/app = aynı build (derlenmiş API + yalnız üretim bağımlılıkları + web dist + migrasyonlar). Sır yok; sırlar ilk çalıştırmada üretilir.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="${OUT:-/mnt/user-data/outputs}"; VER="2.15.0"; SFX="${SUFFIX:-}"; DEMO_DB="${DEMO_DB:-hpw_act_demo}"; MAIL_SRC="${MAIL_SRC:-$ROOT/apps/api/var/mail-demo}"; GIRIS_SRC="${GIRIS_SRC:-$ROOT/apps/api/var/DEMO-GIRIS-BILGILERI.md}"; T="$(mktemp -d)"; TOP="$T/HPW_Act_TESLIMAT_v$VER$SFX"   # v2.15.0: SUFFIX/DEMO_DB ile ikinci paket (ör. müşteri pilotu) aynı betikten
BUILD="$( (cd "$ROOT" && find apps/api/dist apps/web/dist db/migrations -type f | sort | xargs cat) | sha256sum | cut -c1-12)"   # build kimliği: bütün çalışma zamanı dosyalarından (tek kaynak)
mkdir -p "$TOP/DOLU_DEMO" "$TOP/BOS_BASLANGIC" "$TOP/GELISTIRICI_KAYNAK" "$TOP/KANITLAR/TEST_KOSULARI"
[ -f "$ROOT/apps/api/dist/src/server.js" ] || { echo "apps/api derlenmemiş: npx tsc -p tsconfig.json"; exit 2; }
# ortak çalışma zamanı (bir kez hazırla, iki ortama kopyala)
RT="$T/runtime/assets/app"; mkdir -p "$RT/apps/api" "$RT/apps/web" "$RT/packages/domain-core" "$RT/db"
cp -R "$ROOT/apps/api/dist" "$ROOT/apps/api/package.json" "$ROOT/apps/api/package-lock.json" "$RT/apps/api/"
cp -R "$ROOT/apps/api/node_modules" "$RT/apps/api/node_modules"; rm -rf "$RT/apps/api/node_modules/@hpw-act"
( cd "$RT/apps/api" && npm prune --omit=dev --no-audit --no-fund >/dev/null 2>&1 ) || true   # yalnız üretim bağımlılıkları (saf JS; platforma bağlı ikili yok)
mkdir -p "$RT/apps/api/node_modules/@hpw-act/domain-core"; cp -R "$ROOT/packages/domain-core/package.json" "$ROOT/packages/domain-core/dist" "$RT/apps/api/node_modules/@hpw-act/domain-core/"   # prune'dan SONRA: gerçek kopya (symlink yok)
[ -f "$RT/apps/api/node_modules/@hpw-act/domain-core/dist/index.js" ] && [ -f "$RT/apps/api/node_modules/fastify/package.json" ] && [ -f "$RT/apps/api/node_modules/pg/package.json" ] && [ -f "$RT/apps/api/node_modules/exceljs/package.json" ] || { echo "çalışma zamanı bağımlılıkları eksik"; exit 3; }
find "$RT/apps/api/node_modules" -name "*.node" | grep -q . && { echo "platforma bağlı ikili bulundu"; exit 3; } || true
cp -R "$ROOT/apps/web/dist" "$RT/apps/web/dist"; rm -f "$RT/apps/web/dist/index.html" "$RT/apps/web/dist/hpw-act-prototip.html"; rm -rf "$RT/apps/web/dist/prototip"   # prototip üründe yok (N03)
cp -R "$ROOT/db/migrations" "$RT/db/migrations"; cp "$ROOT/tsconfig.base.json" "$RT/" 2>/dev/null || true
pkg() { # $1 klasör, $2 env, $3 port, $4 host, $5 pgport, $6 başlık, $7 etiket, $8 demoData
  D="$TOP/$1"; ORIGIN="http://$4:$3"; LAUNCH="HPW_Act_$(echo "$2" | tr a-z A-Z)_Baslat.command"
  cp -R "$T/runtime/assets" "$D/assets"; mkdir -p "$D/CALISTIRMA" "$D/SABLONLAR"
  sed -e "s#__ENV_TITLE__#$6#g" -e "s#__ENV_LABEL__#$7#g" -e "s#__ENV__#$2#g" -e "s#__ORIGIN__#$ORIGIN#g" -e "s#__BUILD_ID__#$BUILD#g" -e "s#__LAUNCHER__#$LAUNCH#g" "$ROOT/ops/paket/index.template.html" > "$D/index.html"
  sed -e "s#__ENV_TITLE__#$6#g" -e "s#__ENV__#$2#g" -e "s#__PORT__#$3#g" -e "s#__HOST__#$4#g" -e "s#__PGPORT__#$5#g" -e "s#__ORIGIN__#$ORIGIN#g" -e "s#__BUILD_ID__#$BUILD#g" -e "s#__DEMO_DATA__#$8#g" "$ROOT/ops/paket/launcher.template.sh" > "$D/CALISTIRMA/$LAUNCH"; chmod +x "$D/CALISTIRMA/$LAUNCH"; cp "$D/CALISTIRMA/$LAUNCH" "$D/CALISTIRMA/${LAUNCH%.command}.sh"; sh -n "$D/CALISTIRMA/$LAUNCH"
  if [ "$2" = "demo" ]; then FL='<p>Sentetik giriş bilgileri <code>CALISTIRMA/DEMO-GIRIS-BILGILERI.md</code> dosyasındadır (platform yöneticisi, iki şirketin İK yöneticileri, HRBP, GMY, bölge/şube müdürleri, ekip lideri, kapsamlı izleyici, vekiller). Kullanıcı adı e-postadır.</p>'; RN='Demo sıfırlama açık bir işlemdir: CALISTIRMA/pgdata-demo klasörünü ve .env.demo dosyasını silip başlatıcıyı yeniden çalıştırın; BOŞ ortama dokunmaz.'; else FL='<p>Bu kurulumda hiçbir müşteri, kullanıcı ya da veri yoktur. Giriş ekranı "İlk kurulum · HPW yöneticisi" formunu gösterir: kendi e-postanızı ve parolanızı belirleyin, <code>CALISTIRMA/ILK_KURULUM_ANAHTARI.txt</code> dosyasındaki tek satırı "Kurulum anahtarı" alanına yapıştırın. İşlem tek seferliktir; ikinci deneme reddedilir. Varsayılan ya da herkese açık parola yoktur. Sonra: Müşteriler → Yeni şirket → Aç → Genel bakış.</p>'; RN='Test kayıtları teslimattan önce temizlenmiştir; bu paket sıfır müşteri verisiyle başlar.'; fi
  sed -e "s#__ENV_TITLE__#$6#g" -e "s#__ENV__#$2#g" -e "s#__ORIGIN__#$ORIGIN#g" -e "s#__LAUNCHER__#$LAUNCH#g" -e "s#__FIRST_LOGIN__#$FL#g" -e "s#__RESET_NOTE__#$RN#g" "$ROOT/ops/paket/NASIL_ACARIM.template.html" > "$D/NASIL_ACARIM.html"
  printf '{"product":"HPW Act","version":"%s","build":"%s","env":"%s","origin":"%s","port":%s,"pgport":%s,"launcher":"CALISTIRMA/%s","mail":"sandbox","secrets_in_package":false,"generated":"%s"}\n' "$VER" "$BUILD" "$2" "$ORIGIN" "$3" "$5" "$LAUNCH" "$(date -u +%FT%TZ)" > "$D/runtime-manifest.json"
  cp "$ROOT/docs/xlsx-sablonlar-bos/"*.xlsx "$D/SABLONLAR/"
}
pkg DOLU_DEMO demo 8787 127.0.0.1 54327 "DOLU DEMO" "DOLU DEMO — sentetik veri" 1
pkg BOS_BASLANGIC bos 8788 localhost 54328 "BOŞ BAŞLANGIÇ" "BOŞ BAŞLANGIÇ — sizin veriniz" 0
# demo: veri dump'ı + giriş bilgileri; bos: hiçbir veri/posta/sır yok
su postgres -c "pg_dump -Fc --exclude-table-data=schema_migrations $DEMO_DB" > "$TOP/DOLU_DEMO/CALISTIRMA/hpw_act_demo.dump"
su postgres -c "psql -d $DEMO_DB -Atc \"SELECT 'tenant='||(SELECT COUNT(*) FROM tenant)||' result='||(SELECT COUNT(*) FROM result)||' action='||(SELECT COUNT(*) FROM action)||' evidence='||(SELECT COUNT(*) FROM evidence)||' membership='||(SELECT COUNT(*) FROM membership)\"" > "$TOP/DOLU_DEMO/CALISTIRMA/demo-manifest.txt"   # M06: geri yükleme tamamlanma manifesti
cp "$GIRIS_SRC" "$TOP/DOLU_DEMO/CALISTIRMA/DEMO-GIRIS-BILGILERI.md"; mkdir -p "$TOP/DOLU_DEMO/CALISTIRMA/mail-demo"; cp "$MAIL_SRC/"*.eml "$TOP/DOLU_DEMO/CALISTIRMA/mail-demo/"   # sentetik davet postaları: test kutusunda bağlantılar incelenebilir; mkdir -p "$TOP/DOLU_DEMO/SABLONLAR/ornek-dolu"; cp "$ROOT/docs/xlsx-sablonlar-demo/"*.xlsx "$TOP/DOLU_DEMO/SABLONLAR/ornek-dolu/"
# geliştirici kaynağı (node_modules, var, .env, dist hariç) + kanıtlar
( cd "$ROOT" && tar --exclude='node_modules' --exclude='apps/api/var' --exclude='apps/api/.env.*' --exclude='apps/api/dist' --exclude='.git' --exclude='*.zip' --exclude='data/atlas/*.json' --exclude='data/atlas/*.csv' --exclude='apps/web/dist-single' -cf - apps packages db ops docs tools data CLAUDE.md pnpm-lock.yaml KURULUM.md NASIL-CALISTIRILIR.md tsconfig.base.json pnpm-workspace.yaml package.json README.md NEREDEN-BASLARIM.md docker-compose.yml ) | ( cd "$TOP/GELISTIRICI_KAYNAK" && tar -xf - )
cp "$ROOT/docs/test-ciktilari/"* "$TOP/KANITLAR/TEST_KOSULARI/" 2>/dev/null || true
python3 - "$ROOT/docs/KANITLAR/KAPANIS.json" "$BUILD" "$VER" <<'PY'
import json,sys; p,b,v=sys.argv[1:]; d=json.load(open(p,encoding='utf-8')); d['build']=b; d['surum']=v; json.dump(d,open(p,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
PY
# KAPANIS_PRE: build alanı kopyadan önce
cp "$ROOT/docs/KANITLAR/"* "$TOP/KANITLAR/" 2>/dev/null || true; sed -i "s/__BUILD__/$BUILD/g" "$TOP/KANITLAR/KAPANIS.md"; sed -e "s/__BUILD__/$BUILD/g" -e "s/__VER__/$VER/g" "$ROOT/docs/TESLIMAT-v2.6.3.md" > "$TOP/KANITLAR/TESLIMAT-v$VER.md"; python3 - "$ROOT/docs/KANITLAR/KAPANIS.json" "$BUILD" "$VER" <<'PY'
import json,sys; p,b,v=sys.argv[1:]; d=json.load(open(p,encoding='utf-8')); d['build']=b; d['surum']=v; json.dump(d,open(p,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
PY
cp "$ROOT/docs/N01-N36-kapanis-tablosu.md" "$ROOT/docs/R01-R44-kapanis-tablosu.md" "$ROOT/docs/MAC_VE_HTTPS_TESLIM_PLANI.md" "$TOP/KANITLAR/" 2>/dev/null || true
# BOŞ temizlik doğrulaması: müşteri verisi, dump, posta, demo giriş bilgisi, prototip yok
for f in CALISTIRMA/hpw_act_demo.dump CALISTIRMA/DEMO-GIRIS-BILGILERI.md CALISTIRMA/.env.bos CALISTIRMA/.env.demo CALISTIRMA/mail-demo assets/app/apps/api/.env.bos assets/app/apps/api/.env.demo assets/app/apps/web/dist/index.html assets/app/apps/web/dist/hpw-act-prototip.html CALISTIRMA/mail-bos CALISTIRMA/pgdata-bos; do [ -e "$TOP/BOS_BASLANGIC/$f" ] && { echo "BOŞ paket kirli: $f"; exit 4; }; done
# checksum manifesti
( cd "$TOP" && find . -type f ! -name TESLIMAT_MANIFESTI.json -print0 | sort -z | xargs -0 sha256sum ) | python3 -c "
import sys, json, datetime
files = [{'path': l.split('  ',1)[1].strip()[2:], 'sha256': l.split('  ',1)[0]} for l in sys.stdin if l.strip()]
json.dump({'version': '$VER', 'build': '$BUILD', 'generated': datetime.datetime.utcnow().isoformat()+'Z', 'files': files, 'count': len(files)}, open('$TOP/KANITLAR/TESLIMAT_MANIFESTI.json','w'), ensure_ascii=False, indent=0)"
( cd "$T" && rm -f "$OUT"/HPW_Act_TESLIMAT_v${VER}${SFX}_*.zip "$OUT"/HPW_Act_TESLIMAT_v${VER}${SFX}_*.sha256 && zip -qry "$OUT/HPW_Act_TESLIMAT_v${VER}${SFX}_$BUILD.zip" "HPW_Act_TESLIMAT_v$VER$SFX" )
IB=$(python3 -c "import json;print(json.load(open('$TOP/KANITLAR/KAPANIS.json'))['build'])"); RB=$(grep -o '"build":"[a-f0-9]*"' "$TOP/BOS_BASLANGIC/runtime-manifest.json" | cut -d'"' -f4); [ "$IB" = "$BUILD" ] && [ "$RB" = "$BUILD" ] || { echo "BUILD TUTARSIZ: kapanis=$IB manifest=$RB paket=$BUILD"; exit 5; }; echo "build tutarlı: $BUILD"
sha256sum "$OUT/HPW_Act_TESLIMAT_v${VER}${SFX}_$BUILD.zip" | tee "$OUT/HPW_Act_TESLIMAT_v${VER}${SFX}_$BUILD.sha256"
echo "BUILD=$BUILD"; ls -la "$OUT/HPW_Act_TESLIMAT_v${VER}${SFX}_$BUILD.zip" | awk '{print $5}'; rm -rf "$T"
