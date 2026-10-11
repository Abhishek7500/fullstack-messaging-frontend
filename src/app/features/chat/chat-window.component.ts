import { AsyncPipe, DatePipe } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { Conversation } from '../../core/models';
import { AvatarComponent } from '../../shared/avatar.component';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, AvatarComponent],
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
          </header>

          <div #scroller class="flex-1 space-y-3 overflow-y-auto px-5 py-6">
            @for (message of vm.messages; track message.id) {
              <div class="flex" [class.justify-end]="message.senderId === me?.id">
                <div class="max-w-[72%]">
                  @if (message.senderId !== me?.id && vm.conversation.type === 'GROUP') {
                    <p class="mb-1 pl-1 text-[11px] text-messenger-muted">{{ message.senderName }}</p>
                  }
                  <div
                    class="rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm"
                    [class.bg-messenger-blue]="message.senderId === me?.id"
                    [class.text-white]="message.senderId === me?.id"
                    [class.rounded-br-md]="message.senderId === me?.id"
                    [class.bg-white]="message.senderId !== me?.id"
                    [class.rounded-bl-md]="message.senderId !== me?.id"
                  >
                    {{ message.content }}
                  </div>
                  <p class="mt-1 px-1 text-[10px] text-messenger-muted" [class.text-right]="message.senderId === me?.id">
                    {{ message.createdAt | date: 'shortTime' }}
                  </p>
                </div>
              </div>
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

          <form class="border-t border-gray-200 bg-white px-4 py-3" (ngSubmit)="send()">
            <div class="flex items-center gap-3 rounded-full bg-messenger-wash px-4 py-2">
              <input
                class="flex-1 bg-transparent py-2 text-sm outline-none"
                placeholder="Aa"
                [(ngModel)]="draft"
                name="draft"
                (ngModelChange)="onDraftChange()"
                autocomplete="off"
              />
              <button class="font-semibold text-messenger-blue disabled:text-gray-400" [disabled]="!draft.trim()">Send</button>
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
    </section>
  `
})
export class ChatWindowComponent implements AfterViewChecked {
  draft = '';
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
  ) {}

  ngAfterViewChecked(): void {
    if (this.shouldStickToBottom) {
      this.scrollToBottom();
      this.shouldStickToBottom = true;
    }
  }

  send(): void {
    this.chat.send(this.draft);
    this.draft = '';
    this.chat.notifyTyping(false);
    this.shouldStickToBottom = true;
  }

  onDraftChange(): void {
    this.chat.notifyTyping(!!this.draft.trim());
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }
    this.typingTimer = setTimeout(() => this.chat.notifyTyping(false), 1500);
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
