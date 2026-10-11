import { Component, OnDestroy, OnInit } from '@angular/core';
import { ChatService } from '../../core/services/chat.service';
import { ConversationListComponent } from './conversation-list.component';
import { ChatWindowComponent } from './chat-window.component';

@Component({
  selector: 'app-chat-shell',
  standalone: true,
  imports: [ConversationListComponent, ChatWindowComponent],
  template: `
    <div class="flex h-screen overflow-hidden bg-messenger-wash">
      <app-conversation-list />
      <app-chat-window />
    </div>
  `
})
export class ChatShellComponent implements OnInit, OnDestroy {
  constructor(private readonly chat: ChatService) {}

  ngOnInit(): void {
    this.chat.bootstrap();
  }

  ngOnDestroy(): void {
    this.chat.shutdown();
  }
}
