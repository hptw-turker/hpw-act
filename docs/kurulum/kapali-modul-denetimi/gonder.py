#!/usr/bin/env python3
"""Kapalı modül denetimi, 2. adım: sema-ornek.mjs çıktısındaki şemaya uygun istekleri oturumsuz gönderir.

Beklenen: her istek 404 module_disabled. Gövde doğrulamasında takılan (400) istek kapı denetimi sayılmaz.
Kullanım:
  python3 -I gonder.py ornekler.jsonl https://ALAN_ADI [--cafile kok.crt] > sonuc.tsv
Çıkış kodu 0 yalnız bütün istekler 404 module_disabled döndüyse.
"""
import collections
import json
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request


def main() -> int:
    args = sys.argv[1:]
    cafile = None
    if '--cafile' in args:
        i = args.index('--cafile')
        cafile = args[i + 1]
        del args[i:i + 2]
    if len(args) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    rows = [json.loads(line) for line in open(args[0], encoding='utf-8') if line.strip()]
    base = args[1].rstrip('/')
    ctx = ssl.create_default_context(cafile=cafile)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPSHandler(context=ctx))
    tally = collections.Counter()
    bad_prevalidation = [r for r in rows if not r.get('ok')]
    print('yontem\trota\thttp\thata')
    for r in rows:
        url = base + r['path'] + (('?' + urllib.parse.urlencode(r['query'])) if r.get('query') else '')
        data = None if r['method'] == 'GET' else json.dumps(r['body'] if r['body'] is not None else {}).encode()
        headers = {'content-type': 'application/json'} if data is not None else {}
        rq = urllib.request.Request(url, data=data, method=r['method'], headers=headers)
        try:
            resp = opener.open(rq, timeout=20)
            code, body = resp.status, resp.read()
        except urllib.error.HTTPError as e:
            code, body = e.code, e.read()
        try:
            err = json.loads(body).get('error')
        except Exception:
            err = '(json değil)'
        tally[(code, err)] += 1
        print(f"{r['method']}\t{r['url']}\t{code}\t{err}")
    summary = ', '.join(f'{c} {e}: {n}' for (c, e), n in sorted(tally.items(), key=lambda x: str(x[0])))
    print(f'# toplam {len(rows)} istek; {summary}; ön doğrulamada geçmeyen: {len(bad_prevalidation)}', file=sys.stderr)
    return 0 if tally == collections.Counter({(404, 'module_disabled'): len(rows)}) and not bad_prevalidation else 1


if __name__ == '__main__':
    sys.exit(main())
