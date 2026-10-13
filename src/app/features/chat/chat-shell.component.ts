import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ChatService } from '../../core/services/chat.service';
import { ConversationListComponent } from './conversation-list.component';
import { ChatWindowComponent } from './chat-window.component';
import { UtilityHubComponent } from './utility-hub/utility-hub.component';
import { AiCompanionComponent } from './ai-companion.component';

@Component({
  selector: 'app-chat-shell',
  standalone: true,
  imports: [ConversationListComponent, ChatWindowComponent, UtilityHubComponent, AiCompanionComponent],
  template: `
    <div class="flex h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-[#f7f9fc] to-blue-50">
      <!-- Column 1: conversation list -->
      <app-conversation-list class="hidden md:flex" />

      <!-- Column 2: active chat -->
      <app-chat-window class="min-w-0 flex-1" />

      <!-- Column 3: collapsible Utility Hub -->
      <app-utility-hub
        class="hidden lg:flex"
        [open]="hubOpen()"
        (toggle)="hubOpen.set(!hubOpen())"
      />

      <!-- Floating AI Workspace Companion -->
      <app-ai-companion />
    </div>
  `
})
export class ChatShellComponent implements OnInit, OnDestroy {
  readonly hubOpen = signal(true);

  constructor(private readonly chat: ChatService) {}

  ngOnInit(): void {
    this.chat.bootstrap();
  }

  ngOnDestroy(): void {
    this.chat.shutdown();
  }
}

