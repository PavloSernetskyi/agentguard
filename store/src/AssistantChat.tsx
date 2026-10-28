import {FormEvent, useEffect, useRef, useState} from 'react';
import {ArrowRight, Bot, ShoppingBag, X} from 'lucide-react';
import {Cart, Customer, money} from './types';
import {api, apiWithMetadata, ApiError} from './http';

type Recommendation = {
  id: string;
  name: string;
  category: string;
  price_cents: number;
  description: string;
  use_case?: string | null;
  draw_weight_lb?: {min: number; max: number} | null;
};
type ChatMessage = {role: 'user' | 'assistant'; text: string; products?: Recommendation[]; requestId?: string | null};
type AssistantResponse = {
  conversation_id: string;
  reply: string;
  ui_actions: (
    | {type: 'navigate'; path: string}
    | {type: 'cart_updated'}
    | {type: 'show_products'; products: Recommendation[]}
  )[];
};

type Props = {
  customer: Customer | null;
  onClose: () => void;
  onSignIn: () => void;
  onCartUpdated: (cart: Cart) => void;
  onAddProduct: (productId: string) => void;
};

export function AssistantChat({customer, onClose, onSignIn, onCartUpdated, onAddProduct}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const transcript = useRef<HTMLDivElement>(null);
  const pending = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const currentCustomer = useRef(customer?.id);
  currentCustomer.current = customer?.id;

  useEffect(() => {
    generation.current++;
    pending.current?.abort();
    pending.current = null;
    setMessages([]);
    setConversationId(undefined);
    setDraft('');
    setError('');
    setErrorRequestId(null);
    setBusy(false);
    return () => {
      generation.current++;
      pending.current?.abort();
      pending.current = null;
    };
  }, [customer?.id]);

  useEffect(() => {
    transcript.current?.scrollTo({top: transcript.current.scrollHeight, behavior: 'smooth'});
  }, [messages, busy]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy || pending.current) return;
    if (!customer) {
      onSignIn();
      return;
    }

    const controller = new AbortController();
    pending.current = controller;
    const requestGeneration = generation.current;
    const customerId = customer.id;
    const active = () => !controller.signal.aborted && generation.current === requestGeneration && currentCustomer.current === customerId;
    setMessages(current => [...current, {role: 'user', text: message}]);
    setDraft('');
    setError('');
    setErrorRequestId(null);
    setBusy(true);
    try {
      const {data: response, requestId} = await apiWithMetadata<AssistantResponse>('/assistant/messages', 'POST', {
        message,
        ...(conversationId ? {conversation_id: conversationId} : {}),
      }, {signal: controller.signal});
      if (!active()) return;
      setConversationId(response.conversation_id);
      const recommendations = response.ui_actions.find(action => action.type === 'show_products');
      setMessages(current => [...current, {
        role: 'assistant',
        text: response.reply,
        requestId,
        products: recommendations?.type === 'show_products' ? recommendations.products : undefined,
      }]);
      for (const action of response.ui_actions) {
        if (!active()) return;
        if (action.type === 'navigate' && /^\/products\/[A-Za-z0-9_-]{1,64}$/.test(action.path)) {
          location.hash = action.path;
        } else if (action.type === 'cart_updated') {
          const cart = await api<Cart>('/cart', 'GET', undefined, {signal: controller.signal});
          if (!active()) return;
          onCartUpdated(cart);
        }
      }
    } catch (requestError) {
      if (!active()) return;
      const message = (requestError as Error).message;
      setError(message === 'Sign in to continue' ? 'Your session expired. Please sign in again.' : message);
      setErrorRequestId(requestError instanceof ApiError ? requestError.requestId : null);
      if (message === 'Sign in to continue') onSignIn();
    } finally {
      if (active()) {
        pending.current = null;
        setBusy(false);
      }
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
          {messages.map((message, index) => <div className={`assistant-message ${message.role}`} key={index}>
            <p>{message.text}</p>
            {message.requestId && <details className="assistant-reference"><summary>Support reference</summary><code>{message.requestId}</code></details>}
            {message.products?.length ? <div className="assistant-recommendations" aria-label="Product recommendations">
              {message.products.map(product => <article className="assistant-product-card" key={product.id}>
                <div>
                  <span className="product-category">{product.category}</span>
                  <strong>{product.name}</strong>
                  <span className="assistant-product-meta">
                    {product.draw_weight_lb && `Draw weight: ${product.draw_weight_lb.min === product.draw_weight_lb.max
                      ? `${product.draw_weight_lb.min} lb`
                      : `${product.draw_weight_lb.min}–${product.draw_weight_lb.max} lb`}`}
                    {product.use_case && ` · ${product.use_case}`}
                  </span>
                  <span className="assistant-product-price">{money(product.price_cents)}</span>
                </div>
                <div className="assistant-product-actions">
                  <a href={`#/products/${encodeURIComponent(product.id)}`} onClick={onClose}>View details</a>
                  <button type="button" onClick={() => onAddProduct(product.id)}><ShoppingBag size={14}/> Add to cart</button>
                </div>
              </article>)}
            </div> : null}
          </div>)}
          {busy && <p className="assistant-message assistant" role="status">Looking that up…</p>}
        </div>
        {error && <div className="assistant-error" role="alert"><p>{error}</p>{errorRequestId && <details className="assistant-reference"><summary>Support reference</summary><code>{errorRequestId}</code></details>}</div>}
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
