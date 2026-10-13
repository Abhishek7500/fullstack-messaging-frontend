import { AfterViewChecked, Component, ElementRef, ViewChild, signal } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { ChatMessage, Conversation, MessageType, SubscriptionStatus } from '../../core/models';
import { AvatarComponent } from '../../shared/avatar.component';
import { ChatBubbleComponent } from '../../shared/chat-bubble.component';
import { PremiumUpgradeModalComponent } from '../../shared/premium-upgrade-modal.component';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [
    AsyncPipe,
    DatePipe,
    FormsModule,
    AvatarComponent,
    ChatBubbleComponent,
    PremiumUpgradeModalComponent
  ],
  template: `
    <section class="flex h-full min-w-0 flex-1 flex-col bg-[#f7f9fc]">
      @if (vm$ | async; as vm) {
        @if (vm.conversation) {
          <header class="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
            <div class="flex items-center gap-3">
              <app-avatar
                [name]="title(vm.conversation)"
                [color]="accent(vm.conversation)"
                [online]="isOnline(vm.conversation)"
                [showStatus]="true"
              />
              <div>
                <h2 class="text-base font-semibold">{{ title(vm.conversation) }}</h2>
                <p class="text-xs text-messenger-muted">
                  {{ isOnline(vm.conversation) ? 'Active now' : 'Offline' }}
                </p>
              </div>
            </div>
            @if (subscription(); as sub) {
              <span
                class="rounded-full px-3 py-1 text-xs font-semibold"
                [class.bg-amber-100]="!sub.premium"
                [class.text-amber-700]="!sub.premium"
                [class.bg-emerald-100]="sub.premium"
                [class.text-emerald-700]="sub.premium"
              >
                {{ sub.premium ? '⭐ Paid Family' : 'Free' }}
              </span>
            }
          </header>

          <div #scroller class="flex-1 space-y-3 overflow-y-auto px-5 py-6">
            @for (message of vm.messages; track message.id) {
              <app-chat-bubble
                [message]="message"
                [mine]="message.senderId === me?.id"
                [showSender]="message.senderId !== me?.id && vm.conversation.type === 'GROUP'"
                (react)="onReact($event, message)"
                (unlocked)="onUnlocked(message)"
              />
            }
            @if (vm.typists.length) {
              <div class="flex items-center gap-2 text-sm text-messenger-muted">
                <span class="flex gap-1 rounded-full bg-white px-3 py-2">
                  <span class="typing-dot h-1.5 w-1.5 rounded-full bg-gray-500"></span>
                  <span class="typing-dot h-1.5 w-1.5 rounded-full bg-gray-500"></span>
                  <span class="typing-dot h-1.5 w-1.5 rounded-full bg-gray-500"></span>
                </span>
                {{ vm.typists[0].displayName }} is typing…
              </div>
            }
          </div>

          @if (capsuleMode()) {
            <div class="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              <span>🔒 Capsule unlocks in</span>
              <input
                type="number"
                min="1"
                class="w-16 rounded border border-amber-300 px-2 py-1"
                [(ngModel)]="capsuleDays"
                name="capsuleDays"
              />
              <span>days</span>
              <button class="ml-auto font-semibold text-amber-700 hover:underline" type="button" (click)="capsuleMode.set(false)">
                Cancel
              </button>
            </div>
          }

          <form class="border-t border-gray-200 bg-white px-4 py-3" (ngSubmit)="send()">
            <div class="flex items-center gap-2 rounded-full bg-messenger-wash px-4 py-2">
              <label class="cursor-pointer text-messenger-muted hover:text-messenger-blue" title="Attach photo or video">
                📎
                <input type="file" class="hidden" accept="image/*,video/*" (change)="onFileSelected($event)" />
              </label>
              <button
                type="button"
                class="text-messenger-muted hover:text-amber-600"
                title="Lock a time capsule"
                (click)="capsuleMode.set(!capsuleMode())"
              >
                🔒
              </button>
              <input
                class="flex-1 bg-transparent py-2 text-sm outline-none"
                placeholder="Aa"
                [(ngModel)]="draft"
                name="draft"
                (ngModelChange)="onDraftChange()"
                autocomplete="off"
              />
              <button
                class="font-semibold text-messenger-blue disabled:text-gray-400"
                type="submit"
                [disabled]="!draft.trim() && !capsuleMode()"
              >
                Send
              </button>
            </div>
          </form>
        } @else {
          <div class="flex h-full flex-col items-center justify-center text-center">
            <div class="flex h-20 w-20 items-center justify-center rounded-full bg-white text-3xl shadow-pane">💬</div>
            <h2 class="mt-6 text-2xl font-semibold">Select a conversation</h2>
            <p class="mt-2 max-w-sm text-sm text-messenger-muted">
              Pick someone from the left, or search for a teammate to start a live chat.
            </p>
          </div>
        }
      }

      <app-premium-upgrade-modal
        [open]="premiumOpen()"
        [status]="subscription()"
        [reason]="premiumReason()"
        (upgraded)="onUpgrade()"
        (closed)="premiumOpen.set(false)"
      />
    </section>
  `
})
export class ChatWindowComponent implements AfterViewChecked {
  draft = '';
  capsuleDays = 30;
  readonly capsuleMode = signal(false);
  readonly premiumOpen = signal(false);
  readonly premiumReason = signal('general');
  readonly subscription = signal<SubscriptionStatus | null>(null);
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldStickToBottom = true;
  readonly me = this.auth.currentUser();
  readonly vm$ = combineLatest([
    this.chat.conversations$,
    this.chat.activeConversationId$,
    this.chat.messages$,
    this.chat.typing$
  ]).pipe(
    map(([conversations, activeId, messages, typists]) => ({
      conversation: conversations.find((item) => item.id === activeId) ?? null,
      messages,
      typists
    }))
  );

  @ViewChild('scroller') scroller?: ElementRef<HTMLDivElement>;

  constructor(
    private readonly chat: ChatService,
    private readonly auth: AuthService
  ) {
    this.chat.subscription$.subscribe((status) => this.subscription.set(status));
  }

  ngAfterViewChecked(): void {
    if (this.shouldStickToBottom) {
      this.scrollToBottom();
      this.shouldStickToBottom = true;
    }
  }

  send(): void {
    const conversationId = this.activeId();
    if (!conversationId) {
      return;
    }
    if (this.capsuleMode()) {
      const days = Math.max(1, Math.floor(this.capsuleDays || 1));
      const unlockAt = new Date(Date.now() + days * 86400000).toISOString();
      this.chat.send({
        conversationId,
        content: this.draft.trim() || null,
        messageType: 'CAPSULE',
        unlockAt
      });
      this.capsuleMode.set(false);
    } else {
      this.chat.send({
        conversationId,
        content: this.draft,
        messageType: 'TEXT'
      });
    }
    this.draft = '';
    this.chat.notifyTyping(false);
    this.shouldStickToBottom = true;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const conversationId = this.activeId();
    if (!file || !conversationId) {
      return;
    }
    this.chat.uploadMedia(file).subscribe({
      next: (asset) => {
        const messageType: MessageType = file.type.startsWith('video') ? 'VIDEO' : 'PHOTO';
        this.chat.send({
          conversationId,
          content: this.draft.trim() || null,
          messageType,
          mediaUrl: asset.url
        });
        this.draft = '';
      },
      error: (err: HttpErrorResponse) => this.handlePremium(err)
    });
    input.value = '';
  }

  onReact(reactionType: string, message: ChatMessage): void {
    this.chat.react(message.id, reactionType);
  }

  onUnlocked(message: ChatMessage): void {
    // Refresh the active thread so the now-readable capsule content appears.
    this.chat.openConversation(message.conversationId);
  }

  onUpgrade(): void {
    this.chat.upgrade().subscribe({
      next: () => this.premiumOpen.set(false),
      error: () => this.premiumOpen.set(false)
    });
  }

  onDraftChange(): void {
    this.chat.notifyTyping(!!this.draft.trim());
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }
    this.typingTimer = setTimeout(() => this.chat.notifyTyping(false), 1500);
  }

  /** Surface a 403 premium gate as the upgrade modal. */
  private handlePremium(err: HttpErrorResponse): void {
    if (err.status === 403) {
      this.premiumReason.set((err.error?.feature as string) ?? 'general');
      this.premiumOpen.set(true);
    }
  }

  private activeId(): number | null {
    return this.chat.activeConversation()?.id ?? null;
  }

  title(conversation: Conversation): string {
    if (conversation.type === 'GROUP') {
      return conversation.title;
    }
    return conversation.participants.find((p) => p.id !== this.me?.id)?.displayName ?? conversation.title;
  }

  accent(conversation: Conversation): string {
    return conversation.participants.find((p) => p.id !== this.me?.id)?.avatarColor ?? '#0084FF';
  }

  isOnline(conversation: Conversation): boolean {
    return conversation.participants.some((p) => p.id !== this.me?.id && p.online);
  }

  private scrollToBottom(): void {
    const el = this.scroller?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
