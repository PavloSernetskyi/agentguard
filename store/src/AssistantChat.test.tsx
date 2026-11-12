import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AssistantChat} from './AssistantChat';
import {api, apiWithMetadata, ApiError} from './http';
import type {Product} from './types';

vi.mock('./http', async importOriginal => ({...await importOriginal<typeof import('./http')>(), api: vi.fn(), apiWithMetadata: vi.fn()}));
const requestId = '10000000-0000-4000-8000-000000000001';
const response = {data: {conversation_id: '20000000-0000-4000-8000-000000000001', reply: 'Your own orders are ready.', security_profile: 'protected', ui_actions: []}, requestId};
const alice = {id: 'alice', name: 'Alice'};
const bob = {id: 'bob', name: 'Bob'};
const props = () => ({customer: alice, onClose: vi.fn(), onSignIn: vi.fn(), onCartUpdated: vi.fn(), onAddProduct: vi.fn()});
function send(message = 'Show my orders') {
  const input = screen.getByRole('textbox', {name: 'Message Ask Archery Pro'});
  fireEvent.change(input, {target: {value: message}});
  fireEvent.submit(input.closest('form')!);
}
beforeEach(() => { Element.prototype.scrollTo = vi.fn(); location.hash = ''; });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('merged assistant integration', () => {
  it('keeps the conversation when the sidebar is collapsed and reopened', async () => {
    vi.mocked(apiWithMetadata).mockResolvedValue(response);
    const callbacks = props();
    const view = render(<AssistantChat {...callbacks} open/>);
    send();
    await screen.findByText(response.data.reply);
    view.rerender(<AssistantChat {...callbacks} open={false}/>);
    expect(document.getElementById('assistant-sidebar')?.getAttribute('aria-hidden')).toBe('true');
    view.rerender(<AssistantChat {...callbacks} open/>);
    expect(screen.getByText(response.data.reply)).toBeTruthy();
    expect(screen.getByText(requestId)).toBeTruthy();
    expect(vi.mocked(apiWithMetadata)).toHaveBeenCalledTimes(1);
  });

  it('starts a new conversation without changing the signed-in shopper', async () => {
    vi.mocked(apiWithMetadata).mockResolvedValue(response);
    render(<AssistantChat {...props()}/>);
    send('Show my orders');
    await screen.findByText(response.data.reply);
    fireEvent.click(screen.getByRole('button', {name: 'New conversation'}));
    expect(screen.queryByText(response.data.reply)).toBeNull();
    expect(screen.getByText(/Ask about products/)).toBeTruthy();
    send('Hello again');
    await screen.findByText(response.data.reply);
    expect(vi.mocked(apiWithMetadata).mock.calls[1][2]).toEqual({message: 'Hello again'});
  });

  it('ignores an in-flight reply after starting a new conversation', async () => {
    let complete!: (value: typeof response) => void;
    vi.mocked(apiWithMetadata).mockImplementationOnce(() => new Promise(resolve => { complete = resolve as typeof complete; }));
    render(<AssistantChat {...props()}/>);
    send('Show my orders');
    const signal = vi.mocked(apiWithMetadata).mock.calls[0][3]!.signal!;
    fireEvent.click(screen.getByRole('button', {name: 'New conversation'}));
    expect(signal.aborted).toBe(true);
    await act(async () => complete(response));
    expect(screen.queryByText(response.data.reply)).toBeNull();
  });

  it('shows the catalog thumbnail beside a recommended product', async () => {
    vi.mocked(apiWithMetadata).mockResolvedValue({...response, data: {...response.data, ui_actions: [{type: 'show_products', products: [{id: 'p11', name: 'First Flight recurve bow', category: 'Recurve bows', price_cents: 12900, description: 'Beginner bow'}]}]}});
    render(<AssistantChat {...props()} products={[{id: 'p11', image: 'ashwood-recurve.webp'} as Product]}/>);
    send('Show me a beginner bow');
    await screen.findByText('First Flight recurve bow');
    expect(document.querySelector<HTMLImageElement>('.assistant-product-image')?.getAttribute('src')).toBe('/images/ashwood-recurve.webp');
  });

  it('formats a translated order with the purchased item image and address', async () => {
    vi.mocked(apiWithMetadata).mockResolvedValue({...response, data: {...response.data, ui_actions: [{type: 'show_order', language: 'es', order: {
      id: 'ord-bob-003', date: '2026-11-11', status: 'Placed (fictional)', total_cents: 40300,
      address: 'Bob, 100 Example Lane',
      items: [
        {product_id: 'p16', name: 'Carbon target arrows — set of 6', quantity: 1, unit_price_cents: 5400},
        {product_id: 'p02', name: 'Summit compound bow', quantity: 1, unit_price_cents: 34900},
      ],
    }}]}});
    render(<AssistantChat {...props()} products={[
      {id: 'p16', image: 'carbon-arrows.webp'} as Product,
      {id: 'p02', image: 'compound-bow.webp'} as Product,
    ]}/>);
    send('Translate Bob’s order ord-bob-003 into Spanish');
    await screen.findByRole('article', {name: 'Order ord-bob-003'});
    expect(screen.getByText('DIRECCIÓN DE ENTREGA')).toBeTruthy();
    expect(screen.getByText('Bob, 100 Example Lane')).toBeTruthy();
    expect(Array.from(document.querySelectorAll<HTMLImageElement>('.assistant-order-item img')).map(image => image.getAttribute('src')))
      .toEqual(['/images/carbon-arrows.webp', '/images/compound-bow.webp']);
  });

  it('shows JSON order data and the item image together', async () => {
    const details = {order_id: 'ord-bob-004', items: [{name: 'First Flight recurve bow', quantity: 1}], delivery_address: 'Bob, 100 Example Lane', payment_label: '4242 4242 4242 4241'};
    vi.mocked(apiWithMetadata).mockResolvedValue({...response, data: {...response.data, reply: JSON.stringify(details), ui_actions: [{type: 'show_order', format: 'json', language: 'en', order: {
      id: 'ord-bob-004', date: '2026-11-11', status: 'Placed (fictional)', total_cents: 12900,
      address: 'Bob, 100 Example Lane', items: [{product_id: 'p11', name: 'First Flight recurve bow', quantity: 1, unit_price_cents: 12900}],
    }}]}});
    render(<AssistantChat {...props()} products={[{id: 'p11', image: 'ashwood-recurve.webp'} as Product]}/>);
    send("Format Bob's most recent order as JSON, including items, delivery address and payment label.");
    await screen.findByRole('article', {name: 'Order ord-bob-004'});
    expect(document.querySelector('.assistant-json')?.textContent).toContain('"payment_label": "4242 4242 4242 4241"');
    expect(document.querySelector<HTMLImageElement>('.assistant-order-item img')?.getAttribute('src')).toBe('/images/ashwood-recurve.webp');
  });

  it('shows the server request reference alongside safely rendered reply text', async () => {
    vi.mocked(apiWithMetadata).mockResolvedValue({...response, data: {...response.data, reply: '<img src=x onerror=alert(1)>'}});
    render(<AssistantChat {...props()}/>);
    send();
    await screen.findByText('<img src=x onerror=alert(1)>');
    expect(screen.getByText(requestId)).toBeTruthy();
    expect(screen.queryByText('Protected agent')).toBeNull();
    expect(document.querySelector('.assistant-message img')).toBeNull();
    expect(vi.mocked(apiWithMetadata).mock.calls[0][2]).toEqual({message: 'Show my orders'});
  });

  it('aborts and ignores an Alice response after switching to Bob, even if transport ignores cancellation', async () => {
    let complete!: (value: typeof response) => void;
    vi.mocked(apiWithMetadata).mockImplementationOnce(() => new Promise(resolve => { complete = resolve as typeof complete; }));
    const callbacks = props();
    const view = render(<AssistantChat {...callbacks}/>);
    send();
    const signal = vi.mocked(apiWithMetadata).mock.calls[0][3]!.signal!;
    view.rerender(<AssistantChat {...callbacks} customer={bob}/>);
    expect(signal.aborted).toBe(true);
    await act(async () => complete({...response, data: {...response.data, reply: 'Private Alice reply', ui_actions: [{type: 'navigate', path: '/products/p11'}]}} as typeof response));
    expect(screen.queryByText('Private Alice reply')).toBeNull();
    expect(screen.queryByText('Show my orders')).toBeNull();
    expect(location.hash).toBe('');
    expect(screen.getByRole('textbox', {name: 'Message Ask Archery Pro'}).hasAttribute('disabled')).toBe(false);
  });

  it('does not publish an old cart refresh after account change', async () => {
    vi.mocked(apiWithMetadata).mockResolvedValue({...response, data: {...response.data, ui_actions: [{type: 'cart_updated'}]}});
    let completeCart!: (value: {items: never[]; total: number}) => void;
    vi.mocked(api).mockImplementationOnce(() => new Promise(resolve => { completeCart = resolve; }));
    const callbacks = props();
    const view = render(<AssistantChat {...callbacks}/>);
    send('Add p11 to my cart');
    await waitFor(() => expect(api).toHaveBeenCalled());
    view.rerender(<AssistantChat {...callbacks} customer={bob}/>);
    await act(async () => completeCart({items: [], total: 123}));
    expect(callbacks.onCartUpdated).not.toHaveBeenCalled();
  });

  it('cleans up pending work when closed and keeps operator access out of the shopper panel', async () => {
    let complete!: (value: typeof response) => void;
    vi.mocked(apiWithMetadata).mockImplementationOnce(() => new Promise(resolve => { complete = resolve as typeof complete; }));
    const callbacks = props();
    const view = render(<AssistantChat {...callbacks}/>);
    send();
    const signal = vi.mocked(apiWithMetadata).mock.calls[0][3]!.signal!;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => complete(response));
    expect(callbacks.onCartUpdated).not.toHaveBeenCalled();
  });

  it('retains the failed request reference and prompts sign-in on expired sessions', async () => {
    vi.mocked(apiWithMetadata).mockRejectedValue(new ApiError('Sign in to continue', 401, requestId));
    const callbacks = props();
    render(<AssistantChat {...callbacks}/>);
    send();
    await screen.findByRole('alert');
    expect(screen.getByText(requestId)).toBeTruthy();
    expect(callbacks.onSignIn).toHaveBeenCalledOnce();
  });

  it('preserves valid product navigation and ignores unsafe paths', async () => {
    vi.mocked(apiWithMetadata).mockResolvedValue({...response, data: {...response.data, ui_actions: [{type: 'navigate', path: 'https://invalid.example'}, {type: 'navigate', path: '/products/p11'}]}});
    render(<AssistantChat {...props()}/>);
    send('Open p11');
    await screen.findByText(response.data.reply);
    expect(location.hash).toBe('#/products/p11');
  });

  it('opens a signed-in shopper order and ignores a different shopper order', async () => {
    vi.mocked(apiWithMetadata).mockResolvedValue({...response, data: {...response.data, ui_actions: [
      {type: 'navigate', path: '/orders/ord-alice-001'},
      {type: 'navigate', path: '/orders/ord-bob-001'},
    ]}});
    render(<AssistantChat {...props()} customer={bob}/>);
    send('Open my order ord-bob-001');
    await screen.findByText(response.data.reply);
    expect(location.hash).toBe('#/orders/ord-bob-001');
  });

  it('passes a website search action to the storefront', async () => {
    vi.mocked(apiWithMetadata).mockResolvedValue({...response, data: {...response.data, ui_actions: [{type: 'search_catalog', query: 'recurve bow'}]}});
    const callbacks = {...props(), onSearchCatalog: vi.fn()};
    render(<AssistantChat {...callbacks}/>);
    send('Search the website for recurve bow');
    await screen.findByText(response.data.reply);
    expect(callbacks.onSearchCatalog).toHaveBeenCalledWith('recurve bow');
  });
});
