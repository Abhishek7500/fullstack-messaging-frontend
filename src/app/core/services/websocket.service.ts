import { Injectable } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ChatMessage, PresenceEvent, ReactionEvent, SendMessagePayload, TypingEvent } from '../models';

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private client: Client | null = null;
  private connected = false;
  private readonly roomSubscriptions = new Map<string, StompSubscription>();
  private readonly messagesSubject = new Subject<ChatMessage>();
  private readonly typingSubject = new Subject<TypingEvent>();
  private readonly presenceSubject = new Subject<PresenceEvent>();
  private readonly reactionsSubject = new Subject<ReactionEvent>();

  readonly messages$ = this.messagesSubject.asObservable();
  readonly typing$ = this.typingSubject.asObservable();
  readonly presence$ = this.presenceSubject.asObservable();
  readonly reactions$ = this.reactionsSubject.asObservable();

  constructor(private readonly auth: AuthService) {}

  connect(): void {
    if (this.connected || this.client?.active) {
      return;
    }
    const token = this.auth.token();
    if (!token) {
      return;
    }

    this.client = new Client({
      webSocketFactory: () => new SockJS(environment.wsUrl),
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      reconnectDelay: 3000,
      heartbeatIncoming: 15000,
      heartbeatOutgoing: 15000,
      onConnect: () => {
        this.connected = true;
        this.client?.subscribe('/topic/presence', (message: IMessage) => {
          this.presenceSubject.next(JSON.parse(message.body) as PresenceEvent);
        });
      },
      onStompError: (frame) => {
        console.error('STOMP error', frame.headers['message'], frame.body);
      },
      onWebSocketClose: () => {
        this.connected = false;
      }
    });

    this.client.activate();
  }

  disconnect(): void {
    this.roomSubscriptions.forEach((sub) => sub.unsubscribe());
    this.roomSubscriptions.clear();
    this.connected = false;
    void this.client?.deactivate();
    this.client = null;
  }

  watchConversation(conversationId: number): Observable<void> {
    return new Observable<void>((subscriber) => {
      const trySubscribe = () => {
        if (!this.client || !this.client.connected) {
          setTimeout(trySubscribe, 200);
          return;
        }
        const messageDest = `/topic/conversations/${conversationId}`;
        const typingDest = `/topic/conversations/${conversationId}/typing`;
        const reactionDest = `/topic/conversations/${conversationId}/reactions`;
        if (!this.roomSubscriptions.has(messageDest)) {
          this.roomSubscriptions.set(
            messageDest,
            this.client.subscribe(messageDest, (message: IMessage) => {
              this.messagesSubject.next(JSON.parse(message.body) as ChatMessage);
            })
          );
        }
        if (!this.roomSubscriptions.has(typingDest)) {
          this.roomSubscriptions.set(
            typingDest,
            this.client.subscribe(typingDest, (message: IMessage) => {
              this.typingSubject.next(JSON.parse(message.body) as TypingEvent);
            })
          );
        }
        if (!this.roomSubscriptions.has(reactionDest)) {
          this.roomSubscriptions.set(
            reactionDest,
            this.client.subscribe(reactionDest, (message: IMessage) => {
              this.reactionsSubject.next(JSON.parse(message.body) as ReactionEvent);
            })
          );
        }
        subscriber.next();
      };
      trySubscribe();
      return () => undefined;
    });
  }

  sendMessage(payload: SendMessagePayload): void {
    this.client?.publish({
      destination: '/app/chat.send',
      body: JSON.stringify(payload)
    });
  }

  sendTyping(conversationId: number, typing: boolean): void {
    this.client?.publish({
      destination: '/app/chat.typing',
      body: JSON.stringify({ conversationId, typing })
    });
  }

  sendReaction(messageId: number, reactionType: string): void {
    this.client?.publish({
      destination: '/app/chat.react',
      body: JSON.stringify({ messageId, reactionType })
    });
  }

  isConnected(): boolean {
    return this.connected;
  }
}

