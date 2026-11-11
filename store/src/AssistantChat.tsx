import {FormEvent, useEffect, useRef, useState} from 'react';
import {ArrowRight, Bot, Package, PanelRightClose, RotateCcw, ShoppingBag} from 'lucide-react';
import {Cart, Customer, Product, money} from './types';
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
type OrderPreview = {
  id: string;
  date: string;
  status: string;
  total_cents: number;
  address?: string;
  items: {product_id: string; name: string; quantity: number; unit_price_cents: number}[];
};
type ChatMessage = {role: 'user' | 'assistant'; text: string; products?: Recommendation[]; order?: OrderPreview; language?: 'en' | 'es'; format?: 'card' | 'json'; requestId?: string | null};
type AssistantResponse = {
  conversation_id: string;
  reply: string;
  security_profile: 'protected' | 'vulnerable-demo';
  ui_actions: (
    | {type: 'navigate'; path: string}
    | {type: 'cart_updated'}
    | {type: 'show_products'; products: Recommendation[]}
    | {type: 'show_order'; order: OrderPreview; language: 'en' | 'es'; format?: 'card' | 'json'}
    | {type: 'search_catalog'; query: string}
  )[];
};

type Props = {
  open?: boolean;
  customer: Customer | null;
  products?: Product[];
  onClose: () => void;
  onSignIn: () => void;
  onCartUpdated: (cart: Cart) => void;
  onAddProduct: (productId: string) => void;
  onSearchCatalog?: (query: string) => void;
};

function formatJsonReply(value: string) {
  try { return JSON.stringify(JSON.parse(value), null, 2); }
  catch { return value; }
}

export function AssistantChat({open = true, customer, products = [], onClose, onSignIn, onCartUpdated, onAddProduct, onSearchCatalog}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const transcript = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
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

  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>('#assistant-message, .assistant-sign-in button, .assistant-collapse')?.focus();
  }, [open]);

  function resetConversation() {
    generation.current++;
    pending.current?.abort();
    pending.current = null;
    setMessages([]);
    setConversationId(undefined);
    setDraft('');
    setError('');
    setErrorRequestId(null);
    setBusy(false);
    panel.current?.querySelector<HTMLInputElement>('#assistant-message')?.focus();
  }

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
      const orderPreview = response.ui_actions.find(action => action.type === 'show_order');
      setMessages(current => [...current, {
        role: 'assistant',
        text: orderPreview?.type === 'show_order' && orderPreview.format !== 'json'
          ? orderPreview.language === 'es' ? `Aquí están los detalles del pedido ${orderPreview.order.id}.` : `Here are the details for order ${orderPreview.order.id}.`
          : response.reply,
        requestId,
        products: recommendations?.type === 'show_products' ? recommendations.products : undefined,
        order: orderPreview?.type === 'show_order' ? orderPreview.order : undefined,
        language: orderPreview?.type === 'show_order' ? orderPreview.language : undefined,
        format: orderPreview?.type === 'show_order' ? orderPreview.format : undefined,
      }]);
      for (const action of response.ui_actions) {
        if (!active()) return;
        if (action.type === 'navigate' && (
          /^\/products\/[A-Za-z0-9_-]{1,64}$/.test(action.path) ||
          action.path === '/orders' ||
          (customer && action.path.startsWith(`/orders/ord-${customer.id}-`) && /^\/orders\/ord-[a-z0-9_-]{1,64}$/.test(action.path))
        )) {
          location.hash = action.path;
        } else if (action.type === 'search_catalog' && typeof action.query === 'string' && action.query.length <= 100) {
          onSearchCatalog?.(action.query);
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

  const productImages = new Map(products.map(product => [product.id, product.image]));

  return <aside id="assistant-sidebar" ref={panel} className="assistant-sidebar" aria-labelledby="assistant-title" aria-hidden={!open} inert={!open} onKeyDown={event => {
    if (event.key === 'Escape') onClose();
  }}>
      <div className="assistant-sidebar-header">
        <div className="assistant-sidebar-brand"><span className="assistant-modal-icon"><Bot size={23}/></span><span><small>YOUR SHOPPING GUIDE</small><h2 id="assistant-title">Ask Archery Pro</h2></span></div>
        <div className="assistant-header-actions">
          {customer && <button className="assistant-reset" type="button" aria-label="New conversation" title="Start a new conversation" onClick={resetConversation}><RotateCcw size={15}/><span>New chat</span></button>}
          <button className="assistant-collapse" type="button" aria-label="Collapse assistant" title="Collapse assistant" onClick={onClose}><PanelRightClose size={20}/></button>
        </div>
      </div>
      <div className="assistant-sidebar-body">
      {!customer ? <div className="assistant-sign-in">
        <p>Sign in to chat and use your own cart and order history.</p>
        <button className="primary" onClick={onSignIn}>Sign in to continue <ArrowRight size={17}/></button>
      </div> : <>
        <div className="assistant-transcript" ref={transcript} aria-live="polite" aria-label="Conversation">
          {!messages.length && <p className="assistant-intro">Ask about products, ask me to open a product page, or explicitly ask me to add an item to your cart. This classroom shop uses synthetic customer data.</p>}
          {messages.map((message, index) => <div className={`assistant-message ${message.role}`} key={index}>
            {message.format === 'json' ? <pre className="assistant-json">{formatJsonReply(message.text)}</pre> : <p>{message.text}</p>}
            {message.requestId && <details className="assistant-reference"><summary>Support reference</summary><code>{message.requestId}</code></details>}
            {message.order && <article className="assistant-order-card" aria-label={`Order ${message.order.id}`}>
              <div className="assistant-order-heading"><div><small>{message.language === 'es' ? 'PEDIDO' : 'ORDER'}</small><strong>{message.order.id}</strong></div><span className="assistant-order-status">{message.order.status}</span></div>
              <div className="assistant-order-meta"><span>{message.language === 'es' ? 'Fecha' : 'Placed'} <strong>{message.order.date}</strong></span><span>{message.language === 'es' ? 'Total' : 'Total'} <strong>{money(message.order.total_cents)}</strong></span></div>
              <div className="assistant-order-items"><small>{message.language === 'es' ? 'ARTÍCULOS' : 'ITEMS'}</small>{message.order.items.map((item, itemIndex) => <div className="assistant-order-item" key={`${item.product_id}-${itemIndex}`}>
                {productImages.get(item.product_id) ? <img src={`/images/${productImages.get(item.product_id)}`} alt="" loading="lazy"/> : <span className="assistant-order-placeholder"><Package size={21}/></span>}
                <div><strong>{item.name}</strong><span>{item.quantity} × {money(item.unit_price_cents)}</span></div>
              </div>)}</div>
              {message.order.address && <div className="assistant-order-address"><small>{message.language === 'es' ? 'DIRECCIÓN DE ENTREGA' : 'DELIVERY ADDRESS'}</small><span>{message.order.address}</span></div>}
            </article>}
            {message.products?.length ? <div className="assistant-recommendations" aria-label="Product recommendations">
              {message.products.map(product => <article className="assistant-product-card" key={product.id}>
                <div className="assistant-product-main">
                  {productImages.get(product.id) && <img className="assistant-product-image" src={`/images/${productImages.get(product.id)}`} alt="" loading="lazy"/>}
                  <div className="assistant-product-copy">
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
                </div>
                <div className="assistant-product-actions">
                  <a href={`#/products/${encodeURIComponent(product.id)}`}>View details</a>
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
      </div>
  </aside>;
}
