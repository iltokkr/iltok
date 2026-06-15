import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';
import { FiBell } from 'react-icons/fi';
import styles from '@/styles/BoardChat.module.css';

// AuthProvider 와 동일한 anon 클라이언트 (세션은 localStorage 공유 → RLS 인증 그대로 적용됨)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ChatMessage {
  id: number;
  message: string;
  created_at: string;
}

const MESSAGE_LIMIT = 30;

// 채널 이름/소개 — 필요하면 여기만 바꾸면 됩니다.
const CHANNEL_NAME = '114114KR 운영자';
const CHANNEL_DESC = '소식·공지 채널';

// 이모지 반응 종류 — 바꾸고 싶으면 여기만 수정
const REACTIONS = ['👍', '❤️', '😂', '😮'];

// chatId -> emoji -> { count, mine(내가 눌렀는지) }
type ReactionMap = Record<number, Record<string, { count: number; mine: boolean }>>;

// 본문 속 URL 을 자동으로 링크로 변환
function linkify(text: string): React.ReactNode {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={styles.link}>
        {part}
      </a>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

// 시간 표시: 년·월·일 + 시:분 (최신 여부를 바로 알 수 있게 항상 날짜 포함)
function formatTime(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const time = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  return `${yyyy}.${mm}.${dd} ${time}`;
}

const BoardChat: React.FC = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<ReactionMap>({});
  const [clientId, setClientId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  // 브라우저별 익명 식별자 (반응 1인 1회 보장용)
  useEffect(() => {
    let id = localStorage.getItem('bc_client_id');
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `c_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem('bc_client_id', id);
    }
    setClientId(id);
  }, []);

  // 메시지 로드 (새로고침/진입 시)
  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('board_chat')
      .select('id, message, created_at')
      .order('created_at', { ascending: false })
      .limit(MESSAGE_LIMIT);

    if (!error && data) {
      // 화면엔 오래된 것 → 최신 순(아래로 쌓임)으로 표시
      setMessages([...data].reverse());
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // 방장 여부 확인
  useEffect(() => {
    let active = true;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      if (active) setIsAdmin(!!data?.is_admin);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  // 메시지 추가/로드 시 맨 아래로 스크롤
  useEffect(() => {
    if (listRef.current && !collapsed) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, collapsed]);

  // 이모지 반응 로드 (메시지/로그인 변경 시 집계)
  useEffect(() => {
    const ids = messages.map((m) => m.id);
    if (ids.length === 0) {
      setReactions({});
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('board_chat_reaction')
        .select('chat_id, emoji, client_id')
        .in('chat_id', ids);
      if (!active || error || !data) return;
      const map: ReactionMap = {};
      for (const r of data as { chat_id: number; emoji: string; client_id: string }[]) {
        const byEmoji = (map[r.chat_id] ||= {});
        const cell = (byEmoji[r.emoji] ||= { count: 0, mine: false });
        cell.count += 1;
        if (clientId && r.client_id === clientId) cell.mine = true;
      }
      setReactions(map);
    })();
    return () => {
      active = false;
    };
  }, [messages, clientId]);

  // 반응 토글 (로그인 불필요 — 브라우저별 client_id 기준)
  const toggleReaction = useCallback(
    async (chatId: number, emoji: string) => {
      if (!clientId) return;
      const mine = !!reactions[chatId]?.[emoji]?.mine;

      // 낙관적 업데이트
      setReactions((prev) => {
        const next: ReactionMap = { ...prev };
        const byEmoji = { ...(next[chatId] || {}) };
        const cell = { ...(byEmoji[emoji] || { count: 0, mine: false }) };
        if (mine) {
          cell.count = Math.max(0, cell.count - 1);
          cell.mine = false;
        } else {
          cell.count += 1;
          cell.mine = true;
        }
        byEmoji[emoji] = cell;
        next[chatId] = byEmoji;
        return next;
      });

      if (mine) {
        await supabase
          .from('board_chat_reaction')
          .delete()
          .eq('chat_id', chatId)
          .eq('client_id', clientId)
          .eq('emoji', emoji);
      } else {
        await supabase
          .from('board_chat_reaction')
          .insert({ chat_id: chatId, client_id: clientId, user_id: user?.id ?? null, emoji });
      }
    },
    [clientId, user, reactions]
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);

    const { data, error } = await supabase
      .from('board_chat')
      .insert({ message: text })
      .select('id, message, created_at')
      .single();

    if (!error && data) {
      setMessages((prev) => [...prev, data]);
      setInput('');
    } else if (error) {
      alert('전송에 실패했습니다. 권한 또는 네트워크를 확인해주세요.');
      console.error('board_chat insert error:', error);
    }
    setSending(false);
  }, [input, sending]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('이 메시지를 삭제할까요?')) return;
    const { error } = await supabase.from('board_chat').delete().eq('id', id);
    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } else {
      alert('삭제에 실패했습니다.');
      console.error('board_chat delete error:', error);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 전송 / Shift+Enter 줄바꿈
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section className={styles.channel} aria-label="방장 채널">
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <FiBell className={styles.bellIcon} aria-hidden="true" />
          <span className={styles.name}>114114KR</span>
          <span className={styles.desc}>{CHANNEL_DESC}</span>
        </div>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? '펼치기' : '접기'}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </header>

      {!collapsed && (
        <>
          <div className={styles.list} ref={listRef}>
            {messages.length === 0 ? (
              <p className={styles.empty}>
                {isAdmin ? '아직 올라온 소식이 없어요. 첫 메시지를 남겨보세요!' : '아직 올라온 소식이 없어요.'}
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={styles.msg}>
                  <span className={styles.sender}>{CHANNEL_NAME}</span>
                  <div className={styles.row}>
                    <div className={styles.bubble}>
                      <div className={styles.bubbleText}>{linkify(m.message)}</div>
                    </div>
                    <div className={styles.meta}>
                      <span className={styles.time}>{formatTime(m.created_at)}</span>
                      {isAdmin && (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(m.id)}
                          aria-label="메시지 삭제"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={styles.reactions}>
                    {REACTIONS.map((emoji) => {
                      const cell = reactions[m.id]?.[emoji];
                      const count = cell?.count ?? 0;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          className={`${styles.reactionBtn} ${cell?.mine ? styles.reactionActive : ''}`}
                          onClick={() => toggleReaction(m.id, emoji)}
                          aria-label={`${emoji} 반응`}
                        >
                          <span className={styles.reactionEmoji}>{emoji}</span>
                          {count > 0 && <span className={styles.reactionCount}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {isAdmin && (
            <div className={styles.composer}>
              <textarea
                className={styles.input}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메세지를 입력해주세요."
                rows={1}
              />
              <button
                type="button"
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={sending || !input.trim()}
              >
                보내기
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default BoardChat;
