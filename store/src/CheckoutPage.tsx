import {ArrowLeft, ArrowRight, CheckCircle2, Package, ShieldCheck} from 'lucide-react';
import {Cart, Customer, Order, money} from './types';
import {ProductPhoto} from './ProductPhoto';

type Props = {
  customer: Customer;
  cart: Cart;
  step: 'delivery' | 'review';
  placedOrder: Order | null;
  busy: boolean;
  onStep: (step: 'delivery' | 'review') => void;
  onPlace: () => void | Promise<void>;
};

export function CheckoutPage({customer, cart, step, placedOrder, busy, onStep, onPlace}: Props) {
  if (placedOrder) return <section className="checkout-confirmation"><CheckCircle2 size={48}/><div className="eyebrow">FICTIONAL ORDER RECORDED</div><h1>Thanks, {customer.name}.</h1><p>Your synthetic order <b>{placedOrder.id}</b> is in My orders. No payment was taken and nothing will ship.</p><div className="checkout-confirmation-actions"><a className="primary" href={'#/orders/'+placedOrder.id}>View order details <ArrowRight size={17}/></a><a href="#/">Continue browsing</a></div></section>;
  if (!cart.items.length) return <section className="empty"><Package size={42}/><h1>Your cart is empty</h1><p>Add fictional gear before starting checkout.</p><a className="primary" href="#/">Browse products <ArrowRight size={17}/></a></section>;

  const count = cart.items.reduce((sum, row) => sum + row.quantity, 0);
  const address = customer.address || `${customer.name}, 100 Example Lane, Fiction City, ZZ 00000`;
  return <section className="checkout-page">
    <a className="back" href="#/cart"><ArrowLeft size={16}/> Back to cart</a>
    <div className="eyebrow">SYNTHETIC CHECKOUT</div><h1>Review your range bag</h1>
    <p className="muted">This walkthrough creates a fictional order for the signed-in shopper. No payment or delivery occurs.</p>
    <div className="checkout-steps"><span className={step==='delivery'?'current':'done'}>01 · Delivery preview</span><span className={step==='review'?'current':''}>02 · Review order</span><span>03 · Confirmation</span></div>
    <div className="checkout-layout"><div className="checkout-main">
      {step==='delivery' ? <div className="checkout-panel"><div className="panel-icon"><Package size={22}/></div><h2>Fictional delivery details</h2><p>All checkout details are supplied by the demo account. There are no address or payment fields.</p><div className="fake-address"><small>DEMO ADDRESS</small><strong>{address}</strong></div><div className="checkout-notice"><ShieldCheck size={18}/> This is a school-project simulation. No real purchase, charge or shipment.</div><button className="primary" onClick={()=>onStep('review')}>Continue to review <ArrowRight size={17}/></button></div> : <div className="checkout-panel"><h2>Items in this fictional order</h2>{cart.items.map(({product,quantity})=><div className="checkout-item" key={product.id}><ProductPhoto product={product}/><div><strong>{product.name}</strong><small>{quantity} × {money(product.price)}</small></div><b>{money(product.price*quantity)}</b></div>)}<div className="checkout-notice"><ShieldCheck size={18}/> Clicking below records a synthetic order and clears this demo cart.</div><div className="checkout-panel-actions"><button className="text-button" onClick={()=>onStep('delivery')}>Back to delivery</button><button className="primary" disabled={busy} onClick={onPlace}>{busy?'Recording...':'Place fictional order'} <ArrowRight size={17}/></button></div></div>}
    </div><aside className="summary"><h2>Order summary</h2><p><span>Items ({count})</span><b>{money(cart.total)}</b></p><p><span>Shipping & tax</span><span>Not applicable</span></p><div className="total"><b>Fictional total</b><b>{money(cart.total)}</b></div><small>No payment information is collected or processed.</small></aside></div>
  </section>;
}
