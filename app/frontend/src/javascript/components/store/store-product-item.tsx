import React from 'react';
import { useTranslation } from 'react-i18next';
import _ from 'lodash';
import { FabButton } from '../base/fab-button';
import { Product } from '../../models/product';
import { Order } from '../../models/order';
import FormatLib from '../../lib/format';
import CartAPI from '../../api/cart';

interface StoreProductItemProps {
  product: Product,
  cart: Order,
  onSuccessAddProductToCart: (cart: Order) => void
}

/**
 * This component shows a product item in store
 */
export const StoreProductItem: React.FC<StoreProductItemProps> = ({ product, cart, onSuccessAddProductToCart }) => {
  const { t } = useTranslation('public');

  /**
   * Return main image of Product, if the product has not any image, show default image
   */
  const productImageUrl = (product: Product) => {
    const productImage = _.find(product.product_images_attributes, { is_main: true });
    if (productImage) {
      return productImage.attachment_url;
    }
    return 'https://via.placeholder.com/300';
  };

  /**
   * Return product's stock status
   */
  const productStockStatus = (product: Product) => {
    if (product.stock.external === 0) {
      return <span>{t('app.public.store_product_item.out_of_stock')}</span>;
    }
    if (product.low_stock_threshold && product.stock.external < product.low_stock_threshold) {
      return <span>{t('app.public.store_product_item.limited_stock')}</span>;
    }
    return <span>{t('app.public.store_product_item.available')}</span>;
  };

  /**
   * Add the product to cart
   */
  const addProductToCart = (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    CartAPI.addItem(cart, product.id, 1).then(onSuccessAddProductToCart);
  };

  /**
   * Goto show product page
   */
  const showProduct = (product: Product): void => {
    window.location.href = `/#!/store/p/${product.slug}`;
  };

  return (
    <div className="store-product-item" onClick={() => showProduct(product)}>
      <div className='itemInfo-image'>
        <img src={productImageUrl(product)} alt='' className='itemInfo-thumbnail' />
      </div>
      <p className="itemInfo-name">{product.name}</p>
      <div className=''>
        <span>
          <div>{FormatLib.price(product.amount)}</div>
          {productStockStatus(product)}
        </span>
        {product.stock.external > 0 &&
          <FabButton className="edit-btn" onClick={addProductToCart}>
            <i className="fas fa-cart-arrow-down" /> {t('app.public.store_product_item.add')}
          </FabButton>
        }
      </div>
    </div>
  );
};
