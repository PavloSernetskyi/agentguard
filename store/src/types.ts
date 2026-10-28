export type Product = { id: string; name: string; category: string; price: number; image: string; use_case?: string | null; draw_weight_lb?: {min: number; max: number} | null; description: string; rating: number; reviews: {author: string; rating: number; text: string}[] };
export type Customer = {id: string; name: string; address?: string};
export type Cart = {items: {product: Product; quantity: number}[]; total: number};
export type Order = {id: string; date: string; status: string; address: string; total: number; items: {product_id: string; name: string; quantity: number; unit_price: number}[]};
export const money = (cents: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(cents / 100);
export {api} from './http';
