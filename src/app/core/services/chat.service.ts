import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatMessage, Conversation, PageResponse, PresenceEvent, TypingEvent, UserProfile } from '../models';
import { AuthService } from './auth.service';
import { WebsocketService } from './websocket.service';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly conversationsSubject = new BehaviorSubject<Conversation[]>([]);
  private readonly activeIdSubject = new BehaviorSubject<number | null>(null);
  private readonly messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private readonly typingSubject = new BehaviorSubject<TypingEvent[]>([]);
  private readonly peopleSubject = new BehaviorSubject<UserProfile[]>([]);
  private readonly presence = new Map<number, boolean>();

  readonly conversations$ = this.conversationsSubject.asObservable();
  readonly activeConversationId$ = this.activeIdSubject.asObservable();
  readonly messages$ = this.messagesSubject.asObservable();
  readonly typing$ = this.typingSubject.asObservable();
  readonly people$ = this.peopleSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly websocket: WebsocketService
  ) {
    this.websocket.messages$.subscribe((message) => this.onIncomingMessage(message));
    this.websocket.typing$.subscribe((event) => this.onTyping(event));
    this.websocket.presence$.subscribe((event) => this.onPresence(event));
  }

  bootstrap(): void {
    this.websocket.connect();
    this.refreshConversations().subscribe();
    this.searchPeople('').subscribe();
  }

  shutdown(): void {
    this.websocket.disconnect();
    this.conversationsSubject.next([]);
    this.messagesSubject.next([]);
    this.activeIdSubject.next(null);
    this.typingSubject.next([]);
  }

  refreshConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${environment.apiUrl}/conversations`).pipe(
      map((items) => items.map((item) => this.withLivePresence(item))),
      tap((items) => {
        this.conversationsSubject.next(items);
        items.forEach((item) => this.websocket.watchConversation(item.id).subscribe());
      })
    );
  }

  searchPeople(query: string): Observable<UserProfile[]> {
    let params = new HttpParams();
    if (query.trim()) {
      params = params.set('q', query.trim());
    }
    return this.http.get<UserProfile[]>(`${environment.apiUrl}/users`, { params }).pipe(
      map((users) =>
        users.map((user) => ({
          ...user,
          online: this.presence.get(user.id) ?? user.online
        }))
      ),
      tap((users) => this.peopleSubject.next(users))
    );
  }

  openConversation(conversationId: number): void {
    this.activeIdSubject.next(conversationId);
    this.typingSubject.next([]);
    this.websocket.watchConversation(conversationId).subscribe();
    this.http
      .get<PageResponse<ChatMessage>>(`${environment.apiUrl}/conversations/${conversationId}/messages`, {
        params: { page: 0, size: 50 }
      })
      .subscribe((page) => {
        this.messagesSubject.next([...page.content].reverse());
      });
    this.http.put<Conversation>(`${environment.apiUrl}/conversations/${conversationId}/read`, {}).subscribe((updated) => {
      this.upsertConversation(this.withLivePresence({ ...updated, unreadCount: 0 }));
    });
  }

  startDirectChat(userId: number): void {
    this.http.post<Conversation>(`${environment.apiUrl}/conversations`, { userId }).subscribe((conversation) => {
      this.upsertConversation(this.withLivePresence(conversation));
      this.websocket.watchConversation(conversation.id).subscribe();
      this.openConversation(conversation.id);
    });
  }

  send(content: string): void {
    const conversationId = this.activeIdSubject.value;
    const trimmed = content.trim();
    if (!conversationId || !trimmed) {
      return;
    }
    this.websocket.sendMessage(conversationId, trimmed);
    this.websocket.sendTyping(conversationId, false);
  }

  notifyTyping(typing: boolean): void {
    const conversationId = this.activeIdSubject.value;
    if (conversationId) {
      this.websocket.sendTyping(conversationId, typing);
    }
  }

  activeConversation(): Conversation | null {
    const id = this.activeIdSubject.value;
    return this.conversationsSubject.value.find((item) => item.id === id) ?? null;
  }

  private onIncomingMessage(message: ChatMessage): void {
    const activeId = this.activeIdSubject.value;
    if (activeId === message.conversationId) {
      const existing = this.messagesSubject.value;
      if (!existing.some((item) => item.id === message.id)) {
        this.messagesSubject.next([...existing, message]);
      }
      this.http.put(`${environment.apiUrl}/conversations/${message.conversationId}/read`, {}).subscribe();
    }

    const conversations = [...this.conversationsSubject.value];
    const index = conversations.findIndex((item) => item.id === message.conversationId);
    if (index >= 0) {
      const current = conversations[index];
      const mine = message.senderId === this.auth.currentUser()?.id;
      const unread = activeId === message.conversationId || mine ? 0 : current.unreadCount + 1;
      conversations.splice(index, 1);
      conversations.unshift({
        ...current,
        lastMessagePreview: message.content,
        lastMessageAt: message.createdAt,
        lastMessageSenderId: message.senderId,
        unreadCount: unread
      });
      this.conversationsSubject.next(conversations);
    } else {
      this.refreshConversations().subscribe();
    }
  }

  private onTyping(event: TypingEvent): void {
    const me = this.auth.currentUser();
    if (!me || event.userId === me.id || this.activeIdSubject.value !== event.conversationId) {
      return;
    }
    const others = this.typingSubject.value.filter((item) => item.userId !== event.userId);
    this.typingSubject.next(event.typing ? [...others, event] : others);
  }

  private onPresence(event: PresenceEvent): void {
    this.presence.set(event.userId, event.online);
    this.conversationsSubject.next(
      this.conversationsSubject.value.map((conversation) => this.withLivePresence(conversation))
    );
    this.peopleSubject.next(
      this.peopleSubject.value.map((user) =>
        user.id === event.userId ? { ...user, online: event.online } : user
      )
    );
  }

  private upsertConversation(conversation: Conversation): void {
    const items = this.conversationsSubject.value.filter((item) => item.id !== conversation.id);
    this.conversationsSubject.next([conversation, ...items]);
  }

  private withLivePresence(conversation: Conversation): Conversation {
    return {
      ...conversation,
      participants: conversation.participants.map((user) => ({
        ...user,
        online: this.presence.get(user.id) ?? user.online
      }))
    };
  }
}
