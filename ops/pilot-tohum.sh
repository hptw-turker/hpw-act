#!/bin/bash
# v2.12 pilot tohumu: mevcut DOLU demo veritabanına (hpw_act_demo) 18 pilot şirket + HPW danışmanı ekler; ardından veritabanı sahibi yetkisiyle
# (1) 5 pilot şirketin açılış tarihini 20 gün geri alır (kurulum gecikti işi), (2) tohumun geçici doğrulama kayıtlarını siler (HPW kullanıcıları ilk girişte kurar).
set -e; cd "$(dirname "$0")/../apps/api"
set -a; . ./.env.demo; set +a; export HPW_MFA_KEY="${HPW_MFA_KEY:-$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')}"
npx tsx src/seed-pilot.ts
su postgres -c "psql -d hpw_act_demo -v ON_ERROR_STOP=1 -c \"UPDATE tenant SET created_at = now() - interval '20 days' WHERE code IN ('PILOT01','PILOT02','PILOT04','PILOT05','PILOT07')\" -c 'DELETE FROM platform_mfa'"
