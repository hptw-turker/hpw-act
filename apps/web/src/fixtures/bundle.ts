/** Örnek sonuç paketi (prototip): HPTW 2026 enstrümanı, Dijital Dönüşüm boyutu çıkarılmış, 2 şirkete özel madde; Konak, Alsancak ve gizli 4 kişilik ekip. */
import manifest from './manifest.json';
import instrument from './instrument.csv?raw';
import resultsItem from './results_item.csv?raw';
import resultsIndex from './results_index.csv?raw';
import benchmarks from './benchmarks.csv?raw';
export const SAMPLE_BUNDLE = { manifest: JSON.stringify(manifest), instrument, resultsItem, resultsIndex, benchmarks };
