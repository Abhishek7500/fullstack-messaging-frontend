import { Component, OnDestroy, signal } from '@angular/core';

type Cell = 'X' | 'O' | null;
type Difficulty = 'easy' | 'hard';

const LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

/**
 * 🕹️ Arcade widget — a fully playable, CSS-styled Tic-Tac-Toe you can enjoy
 * while waiting for replies. "Easy" plays a random legal move; "Hard" uses a
 * minimax search so it never loses. The human is always X and moves first.
 */
@Component({
  selector: 'app-arcade-widget',
  standalone: true,
  template: `
    <div class="rise-in">
      <div class="mb-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-base">🕹️</span>
          <h3 class="text-sm font-semibold text-messenger-ink">Tic-Tac-Toe</h3>
        </div>
        <div class="flex items-center gap-1 rounded-full bg-messenger-wash p-0.5">
          <button
            type="button"
            class="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-300"
            [class.bg-white]="difficulty() === 'easy'"
            [class.shadow-sm]="difficulty() === 'easy'"
            [class.text-messenger-ink]="difficulty() === 'easy'"
            [class.text-messenger-muted]="difficulty() !== 'easy'"
            (click)="setDifficulty('easy')"
          >
            Easy
          </button>
          <button
            type="button"
            class="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-300"
            [class.bg-white]="difficulty() === 'hard'"
            [class.shadow-sm]="difficulty() === 'hard'"
            [class.text-messenger-ink]="difficulty() === 'hard'"
            [class.text-messenger-muted]="difficulty() !== 'hard'"
            (click)="setDifficulty('hard')"
          >
            Unbeatable
          </button>
        </div>
      </div>

      <div class="mb-3 grid grid-cols-3 gap-2 text-center">
        <div class="rounded-xl bg-emerald-50 py-2">
          <p class="text-[10px] font-medium text-emerald-600">YOU (X)</p>
          <p class="text-lg font-bold text-emerald-600">{{ scores().you }}</p>
        </div>
        <div class="rounded-xl bg-messenger-wash py-2">
          <p class="text-[10px] font-medium text-messenger-muted">DRAWS</p>
          <p class="text-lg font-bold text-messenger-muted">{{ scores().draw }}</p>
        </div>
        <div class="rounded-xl bg-rose-50 py-2">
          <p class="text-[10px] font-medium text-rose-600">AI (O)</p>
          <p class="text-lg font-bold text-rose-600">{{ scores().ai }}</p>
        </div>
      </div>

      <div class="mx-auto grid max-w-[240px] grid-cols-3 gap-2">
        @for (cell of board(); track $index) {
          <button
            type="button"
            class="flex aspect-square items-center justify-center rounded-2xl border text-3xl font-bold transition-all duration-300"
            [class.bg-white]="!cell"
            [class.border-gray-200]="!cell"
            [class.hover:bg-blue-50]="!cell && xIsNext() && !gameOver"
            [class.shadow-sm]="!cell"
            [class.bg-blue-50]="cell === 'X'"
            [class.border-blue-200]="cell === 'X'"
            [class.text-messenger-blue]="cell === 'X'"
            [class.bg-rose-50]="cell === 'O'"
            [class.border-rose-200]="cell === 'O'"
            [class.text-rose-500]="cell === 'O'"
            [class.ring-2]="winLine()?.includes($index)"
            [class.ring-emerald-400]="winLine()?.includes($index)"
            (click)="play($index)"
          >
            {{ cell }}
          </button>
        }
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-xs font-medium text-messenger-muted">
          @if (winner() === 'X') { <span class="text-emerald-600">You win! 🎉</span> }
          @else if (winner() === 'O') { <span class="text-rose-500">AI wins 🤖</span> }
          @else if (winner() === 'draw') { <span>It's a draw 🤝</span> }
          @else if (thinking()) { AI is thinking… }
          @else { Your turn }
        </p>
        <button
          type="button"
          class="rounded-full bg-messenger-blue px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:bg-messenger-blue-dark"
          (click)="reset()"
        >
          New game
        </button>
      </div>
    </div>
  `
})
export class ArcadeWidgetComponent implements OnDestroy {
  readonly board = signal<Cell[]>(Array<Cell>(9).fill(null));
  readonly xIsNext = signal(true);
  readonly winner = signal<Cell | 'draw' | null>(null);
  readonly winLine = signal<number[] | null>(null);
  readonly difficulty = signal<Difficulty>('hard');
  readonly scores = signal({ you: 0, ai: 0, draw: 0 });
  readonly thinking = signal(false);
  private aiTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
    }
  }

  get gameOver(): boolean {
    return this.winner() !== null;
  }

  play(index: number): void {
    if (this.gameOver || !this.xIsNext() || this.board()[index]) {
      return;
    }
    this.place(index, 'X');
    const result = this.evaluate(this.board());
    if (result.winner) {
      this.finish(result.winner, result.line);
      return;
    }
    this.xIsNext.set(false);
    this.thinking.set(true);

    // Small delay so the AI "thinks" and the human can follow the move.
    this.aiTimer = setTimeout(() => {
      const move = this.chooseMove();
      if (move >= 0) {
        this.place(move, 'O');
      }
      this.thinking.set(false);
      const after = this.evaluate(this.board());
      if (after.winner) {
        this.finish(after.winner, after.line);
      } else if (this.board().every((c) => c !== null)) {
        this.finish('draw', null);
      } else {
        this.xIsNext.set(true);
      }
    }, 420);
  }

  reset(): void {
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
    }
    this.board.set(Array<Cell>(9).fill(null));
    this.xIsNext.set(true);
    this.winner.set(null);
    this.winLine.set(null);
    this.thinking.set(false);
  }

  setDifficulty(level: Difficulty): void {
    this.difficulty.set(level);
    this.reset();
  }

  private place(index: number, mark: Cell): void {
    this.board.update((b) => {
      const next = [...b];
      next[index] = mark;
      return next;
    });
  }

  private finish(result: Cell | 'draw', line: number[] | null): void {
    this.winner.set(result);
    this.winLine.set(line);
    this.scores.update((s) => {
      if (result === 'X') return { ...s, you: s.you + 1 };
      if (result === 'O') return { ...s, ai: s.ai + 1 };
      return { ...s, draw: s.draw + 1 };
    });
  }

  private evaluate(board: Cell[]): { winner: Cell | null; line: number[] | null } {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line };
      }
    }
    return { winner: null, line: null };
  }

  private chooseMove(): number {
    const empty = this.board()
      .map((c, i) => (c === null ? i : -1))
      .filter((i) => i >= 0);
    if (empty.length === 0) {
      return -1;
    }
    if (this.difficulty() === 'easy') {
      return empty[Math.floor(Math.random() * empty.length)];
    }
    return this.bestMove();
  }

  /** Minimax: AI is the maximizing player ('O'). */
  private bestMove(): number {
    let bestScore = -Infinity;
    let move = -1;
    for (let i = 0; i < 9; i++) {
      if (this.board()[i] === null) {
        this.place(i, 'O');
        const score = this.minimax(this.board(), 0, false);
        // undo
        this.board.update((b) => {
          const next = [...b];
          next[i] = null;
          return next;
        });
        if (score > bestScore) {
          bestScore = score;
          move = i;
        }
      }
    }
    return move;
  }

  private minimax(board: Cell[], depth: number, isMaximizing: boolean): number {
    const { winner } = this.evaluate(board);
    if (winner === 'O') return 10 - depth;
    if (winner === 'X') return depth - 10;
    if (board.every((c) => c !== null)) return 0;

    if (isMaximizing) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = 'O';
          best = Math.max(best, this.minimax(board, depth + 1, false));
          board[i] = null;
        }
      }
      return best;
    }
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'X';
        best = Math.min(best, this.minimax(board, depth + 1, true));
        board[i] = null;
      }
    }
    return best;
  }
}
