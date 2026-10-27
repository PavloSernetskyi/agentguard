import type {Product} from './types';

export function ProductPhoto({product}: {product: Product}) {
  return <img
    className="product-photo"
    src={`/images/${product.image}`}
    alt={product.name}
    loading="eager"
    decoding="async"
  />;
}
