import type {Product} from './types';

function weightLabel(product: Product) {
  const weight = product.draw_weight_lb;
  if (!weight) return '';
  return (weight.min === weight.max ? String(weight.min) : `${weight.min}–${weight.max}`) + ' lb';
}

export function ProductMeta({product, detailed = false}: {product: Product; detailed?: boolean}) {
  if (!product.draw_weight_lb) return null;
  if (!detailed) return <div className="product-meta"><span>{weightLabel(product)} draw</span><span>{product.use_case}</span></div>;
  return <div className="product-specs"><div><small>DRAW WEIGHT</small><strong>{weightLabel(product)}</strong></div><div><small>STYLE</small><strong>{product.use_case}</strong></div><p>These are fictional product specifications. For hunting use, check your location's current equipment rules; crossbow draw weights are not directly comparable to hand-drawn bows.</p></div>;
}
