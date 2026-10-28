import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AssistantChat} from './AssistantChat';
import {api, apiWithMetadata, ApiError} from './http';

vi.mock('./http', async importOriginal => ({...await importOriginal<typeof import('./http')>(), api: vi.fn(), apiWithMetadata: vi.fn()}));
const requestId = '10000000-0000-4000-8000-000000000001';
const response = {data: {conversation_id: '20000000-0000-4000-8000-000000000001', reply: 'Your own orders are ready.', ui_actions: []}, requestId};
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
  it('shows the server request reference alongside safely rendered reply text', async () => {
    vi.mocked(apiWithMetadata).mockResolvedValue({...response, data: {...response.data, reply: '<img src=x onerror=alert(1)>'}});
    render(<AssistantChat {...props()}/>);
    send();
    await screen.findByText('<img src=x onerror=alert(1)>');
    expect(screen.getByText(requestId)).toBeTruthy();
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
});
