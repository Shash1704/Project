'use client';

import { SessionGate, useMe } from '@/lib/session';
import { useChat, openConversation, sendMessage } from '@/lib/store';
import { ChatCard } from '@/components/ds/chat-card';
import { Bubble } from '@/components/ds/bubble';
import { Composer } from '@/components/ds/composer';
import { ConversationTopBar, ConversationTitle } from '@/components/ds/top-bar';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, useRef } from 'react';
import type { CardColor } from '@pulse/ui/tokens';
import type { DeliveryStatus } from '@/components/ds/ticks';

const mockPalette: CardColor[] = ['coral', 'mustard', 'sage', 'periwinkle', 'butter'];
function getCardColor(id: string): CardColor {
  const sum = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return mockPalette[sum % mockPalette.length]!;
}

function HomeContent() {
  const me = useMe();
  const conversations = useChat(s => s.conversations);
  const activeId = useChat(s => s.active);
  const activeChat = activeId ? conversations[activeId] : null;
  const messages = useChat(s => (activeId ? s.messages[activeId] : []));
  const listLoaded = useChat(s => s.listLoaded);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const chatList = useMemo(() => {
    return Object.values(conversations).sort((a, b) => {
      const aTime = a.lastMessageAt || '';
      const bTime = b.lastMessageAt || '';
      return bTime.localeCompare(aTime);
    });
  }, [conversations]);

  return (
    <main className="flex h-[100dvh] bg-ink">
      <aside className="flex w-[380px] flex-col border-r border-white/10 p-screen text-white overflow-hidden">
        <h1 className="text-display-desktop mb-8">
          My
          <br />
          Chats
        </h1>
        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 gap-gap auto-rows-max">
          {!listLoaded ? (
             <p className="text-caption text-white/60 col-span-2">Loading chats...</p>
          ) : chatList.length === 0 ? (
            <p className="text-caption text-white/60 col-span-2">No chats yet.</p>
          ) : (
            chatList.map(c => (
              <ChatCard 
                key={c.id} 
                id={c.id} 
                name={c.title} 
                color={getCardColor(c.id)}
                unread={c.unread} 
                muted={c.muted}
                variant={c.pinned ? 'pinned' : c.kind === 'group' ? 'group' : 'text'}
                preview={c.lastMessage?.body || ''}
                items={[]} 
                avatarSeed={c.avatarSeed}
                onOpen={() => openConversation(c.id)}
                layoutId={`chat-${c.id}`}
              />
            ))
          )}
        </div>
      </aside>
      
      <section className="flex-1 bg-cream flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          {activeChat ? (
            <motion.div 
              key={activeChat.id}
              layoutId={`chat-${activeChat.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col"
            >
              <ConversationTopBar 
                title={activeChat.title}
                scrollRef={scrollRef}
              />
              
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-screen flex flex-col gap-2 pb-32 pt-2">
                 <ConversationTitle title={activeChat.title} layoutId={`chat-title-${activeChat.id}`} />
                 {messages?.map(m => {
                   const st = m.local === 'pending' ? 'pending' : (m.local === 'failed' ? undefined : (m.status as DeliveryStatus));
                   return (
                     <Bubble 
                       key={m.id}
                       outgoing={m.senderId === me?.id}
                       status={st}
                       time={new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                     >
                       {m.body || ''}
                     </Bubble>
                   );
                 })}
                 {(!messages || messages.length === 0) && (
                   <p className="text-center text-caption text-muted mt-10">No messages yet. Say hi!</p>
                 )}
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 bg-cream">
                <Composer 
                  value={draft}
                  onChange={setDraft}
                  onSend={() => {
                    sendMessage(activeChat.id, { kind: 'text', body: draft });
                    setDraft('');
                  }}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col items-center justify-center space-y-4 text-ink"
            >
              <h2 className="text-display">Welcome, {me?.name}!</h2>
              <p className="text-body text-ink/60">Select a chat to start messaging.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}

export default function HomePage() {
  return (
    <SessionGate fallback={<div className="flex h-[100dvh] items-center justify-center bg-ink text-white">Loading...</div>}>
      <HomeContent />
    </SessionGate>
  );
}
