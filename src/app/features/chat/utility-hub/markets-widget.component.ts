import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

interface Asset {
  symbol: string;
  name: string;
  icon: string;
  price: number;
  prev: number;
  changePct: number;
  dir: 'up' | 'down' | 'flat';
  arrow: string;
  pctText: string;
}

interface Game {
  league: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  status: string;
}

const SEED: Asset[] = [
  { symbol: 'BTC', name: 'Bitcoin', icon: '₿', price: 67420.5, prev: 67420.5, changePct: 0, dir: 'flat', arrow: '•', pctText: '0.00' },
  { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', price: 3521.18, prev: 3521.18, changePct: 0, dir: 'flat', arrow: '•', pctText: '0.00' },
  { symbol: 'AAPL', name: 'Apple Inc.', icon: '', price: 189.42, prev: 189.42, changePct: 0, dir: 'flat', arrow: '•', pctText: '0.00' },
  { symbol: 'TSLA', name: 'Tesla', icon: '⚡', price: 242.16, prev: 242.16, changePct: 0, dir: 'flat', arrow: '•', pctText: '0.00' },
  { symbol: 'NVDA', name: 'NVIDIA', icon: '▦', price: 91.07, prev: 91.07, changePct: 0, dir: 'flat', arrow: '•', pctText: '0.00' }
];

const GAMES: Game[] = [
  { league: 'NFL', home: 'Chiefs', away: 'Bills', homeScore: 24, awayScore: 21, status: 'Q3 04:12' },
  { league: 'NBA', home: 'Lakers', away: 'Celtics', homeScore: 88, awayScore: 92, status: 'Q4 02:40' },
  { league: 'EPL', home: 'Arsenal', away: 'Chelsea', homeScore: 1, awayScore: 1, status: "67'" },
  { league: 'MLB', home: 'Yankees', away: 'Red Sox', homeScore: 3, awayScore: 2, status: 'Top 7th' },
  { league: 'UCL', home: 'Real Madrid', away: 'Bayern', homeScore: 2, awayScore: 0, status: "HT" }
];

/**
 * 📈 Markets & Scores widget — a mock live dashboard. Prices tick on a timer to
 * simulate a market feed, flashing green/red on each move, while a seamless
 * marquee scrolls live sports scores beneath.
 */
@Component({
  selector: 'app-markets-widget',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="rise-in space-y-4">
      <div class="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-pane">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold tracking-wide">Live Markets</h3>
          <span class="flex items-center gap-1.5 text-[11px] text-emerald-300">
            <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-400"></span>
            Live
          </span>
        </div>
        <div class="space-y-1.5">
          @for (asset of assets(); track asset.symbol) {
            <div
              class="flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-300"
              [class.flash-up]="asset.dir === 'up'"
              [class.flash-down]="asset.dir === 'down'"
            >
              <div class="flex items-center gap-3">
                <span class="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base">{{ asset.icon }}</span>
                <div>
                  <p class="text-sm font-semibold">{{ asset.symbol }}</p>
                  <p class="text-[11px] text-white/50">{{ asset.name }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-semibold tabular-nums">\${{ asset.price | number: '1.2-2' }}</p>
                <p class="text-[11px] font-medium tabular-nums" [class.text-emerald-400]="asset.dir === 'up'" [class.text-rose-400]="asset.dir === 'down'" [class.opacity-50]="asset.dir === 'flat'">
                  {{ asset.arrow }} {{ asset.pctText }}%
                </p>
              </div>
            </div>
          }
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div class="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5">
          <span class="text-base">🏆</span>
          <h3 class="text-sm font-semibold text-messenger-ink">Live Scores</h3>
        </div>
        <div class="marquee-wrap relative overflow-hidden py-3">
          <div class="marquee-track gap-3 px-3">
            @for (game of ticker(); track $index) {
              <div class="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl border border-gray-100 bg-messenger-wash px-3 py-2">
                <span class="rounded-md bg-messenger-blue/10 px-1.5 py-0.5 text-[10px] font-bold text-messenger-blue">
                  {{ game.league }}
                </span>
                <span class="text-xs font-medium text-messenger-ink">{{ game.home }} {{ game.homeScore }}</span>
                <span class="text-[11px] text-messenger-muted">–</span>
                <span class="text-xs font-medium text-messenger-ink">{{ game.awayScore }} {{ game.away }}</span>
                <span class="text-[10px] text-messenger-muted">{{ game.status }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class MarketsWidgetComponent implements OnInit, OnDestroy {
  readonly assets = signal<Asset[]>(SEED.map((a) => ({ ...a })));
  /** Doubled list so the marquee can loop seamlessly (translateX -50%). */
  readonly ticker = signal<Game[]>([...GAMES, ...GAMES]);
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.timer = setInterval(() => this.tick(), 1600);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private tick(): void {
    this.assets.update((list) =>
      list.map((asset) => {
        const volatility = asset.price * 0.004;
        const delta = (Math.random() - 0.5) * 2 * volatility;
        const price = Math.max(0.01, asset.price + delta);
        const changePct = ((price - asset.prev) / asset.prev) * 100;
        const dir: Asset['dir'] = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
        const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•';
        const pctText = `${changePct >= 0 ? '+' : ''}${Math.abs(changePct).toFixed(2)}`;
        return { ...asset, price, changePct, dir, arrow, pctText };
      })
    );
  }
}
