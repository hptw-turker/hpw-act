-- api container migrasyondan sonra çalıştırır (MIGRATE_DATABASE_URL ile): servis hesabına uygulama rolleri
GRANT hpw_app TO hpw_api_demo; GRANT hpw_worker TO hpw_api_demo;
