"""PostgreSQL için gecikme benzetimi (TCP vekil): her yönde her pakete DELAY_MS gecikme ekler. Gerçek uzak/hosted veritabanı değildir; yalnız ağ gecikmesi altında davranışı gösterir."""
import asyncio, os
LISTEN = int(os.environ.get('LISTEN', '55432')); TARGET = ('127.0.0.1', int(os.environ.get('TARGET_PORT', '5432'))); DELAY = float(os.environ.get('DELAY_MS', '2.5')) / 1000
async def pipe(r, w):
    try:
        while True:
            b = await r.read(65536)
            if not b: break
            await asyncio.sleep(DELAY); w.write(b); await w.drain()
    except Exception: pass
    finally:
        try: w.close()
        except Exception: pass
async def handle(cr, cw):
    sr, sw = await asyncio.open_connection(*TARGET); await asyncio.gather(pipe(cr, sw), pipe(sr, cw))
async def main():
    s = await asyncio.start_server(handle, '127.0.0.1', LISTEN)
    async with s: await s.serve_forever()
asyncio.run(main())
