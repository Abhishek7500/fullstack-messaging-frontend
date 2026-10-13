import { Component, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ReactionSummary } from '../core/models';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

/**
 * Compact reaction bar shown under a chat bubble. Displays emoji tallies and a
 * hover quick-picker. Taps are applied optimistically via Signals so the count
 * updates instantly, then the authoritative tally arrives from the server
 * broadcast and overwrites the local state.
 */
@Component({
  selector: 'app-reaction-bar',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="relative mt-1 flex items-center gap-1" [class.justify-end]="align() === 'right'">
      @for (summary of reactions(); track summary.reactionType) {
        <button
          type="button"
          class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs shadow-sm transition"
          [ngClass]="summary.reactedByMe
            ? 'border-messenger-blue bg-blue-50 text-messenger-blue'
            : 'border-gray-200 bg-white text-messenger-muted hover:bg-gray-50'"
          (click)="toggle(summary.reactionType)"
          [attr.aria-label]="'React with ' + summary.reactionType"
        >
          <span class="text-sm leading-none">{{ summary.reactionType }}</span>
          <span class="font-semibold">{{ summary.count }}</span>
        </button>
      }

      <div class="relative">
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-messenger-muted shadow-sm transition hover:bg-gray-50"
          (click)="pickerOpen.set(!pickerOpen())"
          aria-label="Add reaction"
        >
          😊
        </button>
        @if (pickerOpen()) {
          <div
            class="absolute bottom-8 z-10 flex gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-pane"
            [class.right-0]="align() === 'right'"
            [class.left-0]="align() === 'left'"
          >
            @for (emoji of quick; track emoji) {
              <button
                type="button"
                class="rounded-full px-1.5 py-0.5 text-base transition hover:scale-125 hover:bg-gray-100"
                (click)="toggle(emoji)"
              >
                {{ emoji }}
              </button>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class ReactionBarComponent {
  /** Authoritative tallies from the server. */
  readonly reactions = input.required<ReactionSummary[]>();
  /** Which side of the bubble the bar sits on. */
  readonly align = input<'left' | 'right'>('left');
  /** Emits the emoji the user tapped. */
  readonly toggled = output<string>();

  readonly quick = QUICK_REACTIONS;
  readonly pickerOpen = signal(false);

  toggle(reactionType: string): void {
    this.pickerOpen.set(false);
    this.toggled.emit(reactionType);
  }
}
