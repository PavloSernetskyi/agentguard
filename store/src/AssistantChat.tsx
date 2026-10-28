import {FormEvent, useEffect, useRef, useState} from 'react';
import {ArrowRight, Bot, X} from 'lucide-react';
import {api, Cart, Customer} from './types';

type ChatMessage = {role: 'user' | 'assistant'; text: string};
type AssistantResponse = {
  conversation_id: string;
  reply: string;
  ui_actions: ({type: 'navigate'; path: string} | {type: 'cart_updated'})[];
};

type Props = {
  customer: Customer | null;
  onClose: () => void;
  onSignIn: () => void;
  onCartUpdated: (cart: Cart) => void;
};

export function AssistantChat({customer, onClose, onSignIn, onCartUpdated}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setConversationId(undefined);
    setDraft('');
    setError('');
  }, [customer?.id]);

  useEffect(() => {
    transcript.current?.scrollTo({top: transcript.current.scrollHeight, behavior: 'smooth'});
  }, [messages, busy]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    if (!customer) {
      onSignIn();
      return;
    }

    setMessages(current => [...current, {role: 'user', text: message}]);
    setDraft('');
    setError('');
    setBusy(true);
    try {
      const response = await api<AssistantResponse>('/assistant/messages', 'POST', {
        message,
        ...(conversationId ? {conversation_id: conversationId} : {}),
      });
      setConversationId(response.conversation_id);
      setMessages(current => [...current, {role: 'assistant', text: response.reply}]);
      for (const action of response.ui_actions) {
        if (action.type === 'navigate' && /^\/products\/[A-Za-z0-9_-]{1,64}$/.test(action.path)) {
          location.hash = action.path;
        } else if (action.type === 'cart_updated') {
          onCartUpdated(await api<Cart>('/cart'));
        }
      }
    } catch (requestError) {
      const message = (requestError as Error).message;
      setError(message === 'Sign in to continue' ? 'Your session expired. Please sign in again.' : message);
      if (message === 'Sign in to continue') onSignIn();
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="modal assistant-modal assistant-chat" role="dialog" aria-modal="true" aria-labelledby="assistant-title" onKeyDown={event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }} onClick={event => event.stopPropagation()}>
      <button className="close" autoFocus aria-label="Close assistant" onClick={onClose}><X/></button>
      <div className="assistant-modal-icon"><Bot size={27}/></div>
      <div className="eyebrow">YOUR ARCHERY PRO SHOPPING GUIDE</div>
      <h2 id="assistant-title">Ask Archery Pro</h2>
      {!customer ? <div className="assistant-sign-in">
        <p>Sign in to chat and use your own cart and order history.</p>
        <button className="primary" onClick={onSignIn}>Sign in to continue <ArrowRight size={17}/></button>
      </div> : <>
        <div className="assistant-transcript" ref={transcript} aria-live="polite" aria-label="Conversation">
          {!messages.length && <p className="assistant-intro">Ask about products, ask me to open a product page, or explicitly ask me to add an item to your cart. I can only see your account’s cart and orders.</p>}
          {messages.map((message, index) => <p className={`assistant-message ${message.role}`} key={index}>{message.text}</p>)}
          {busy && <p className="assistant-message assistant" role="status">Looking that up…</p>}
        </div>
        {error && <p className="assistant-error" role="alert">{error}</p>}
        <form className="assistant-form" onSubmit={sendMessage}>
          <label className="sr-only" htmlFor="assistant-message">Message Ask Archery Pro</label>
          <input id="assistant-message" value={draft} maxLength={2000} onChange={event => setDraft(event.target.value)} placeholder="Ask about range gear…" disabled={busy}/>
          <button type="submit" className="primary" disabled={busy || !draft.trim()} aria-label="Send message"><ArrowRight size={18}/></button>
        </form>
        <small>Fictional products only. Checkout and payments are not handled by the assistant.</small>
      </>}
    </section>
  </div>;
}
