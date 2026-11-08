"""python3 extract-test-bundle.py bundle.txt new-output-directory"""
import sys, json, hashlib
from pathlib import Path, PurePosixPath

bundle = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
assert bundle['format'] == 'hpw-independent-test-bundle/1'
root = Path(sys.argv[2]).resolve()
assert not root.exists(), 'Çıktı için yeni bir dizin seçin'
seen = set()
for item in bundle['files']:
    rel = PurePosixPath(item['path'])
    assert not rel.is_absolute() and '..' not in rel.parts and rel.parts
    assert str(rel) not in seen
    seen.add(str(rel))
    data = item['content'].encode('utf-8')
    assert len(data) == item['bytes']
    assert hashlib.sha256(data).hexdigest() == item['sha256']
root.mkdir(parents=True)
for item in bundle['files']:
    p = root / item['path']
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(item['content'].encode('utf-8'))
print(f"Doğrulandı ve çıkarıldı: {len(bundle['files'])} dosya")
