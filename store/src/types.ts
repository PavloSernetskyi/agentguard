export type Product = { id: string; name: string; category: string; price: number; illustration: string; color: string; description: string; rating: number; reviews: {author: string; rating: number; text: string}[] };
export type Customer = {id: string; name: string};
export type Cart = {items: {product: Product; quantity: number}[]; total: number};
export type Order = {id: string; date: string; status: string; address: string; total: number; items: {product_id: string; name: string; quantity: number; unit_price: number}[]};
export const money = (cents: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(cents / 100);
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch('/api' + path, {method, credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}
