import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { react2angular } from 'react2angular';
import { Loader } from '../base/loader';
import { IApplication } from '../../models/application';
import { FabButton } from '../base/fab-button';
import useCart from '../../hooks/use-cart';
import FormatLib from '../../lib/format';
import CartAPI from '../../api/cart';
import { User } from '../../models/user';
import { PaymentModal } from '../payment/stripe/payment-modal';
import { PaymentMethod } from '../../models/payment';
import { Order } from '../../models/order';
import { MemberSelect } from '../user/member-select';
import { CouponInput } from '../coupon/coupon-input';
import { Coupon } from '../../models/coupon';
import noImage from '../../../../images/no_image.png';
import Switch from 'react-switch';
import OrderLib from '../../lib/order';
import { CaretDown, CaretUp } from 'phosphor-react';
import SettingAPI from '../../api/setting';
import { SettingName } from '../../models/setting';

declare const Application: IApplication;

interface StoreCartProps {
  onSuccess: (message: string) => void,
  onError: (message: string) => void,
  userLogin: () => void,
  currentUser?: User
}

/**
 * This component shows user's cart
 */
const StoreCart: React.FC<StoreCartProps> = ({ onSuccess, onError, currentUser, userLogin }) => {
  const { t } = useTranslation('public');

  const { cart, setCart } = useCart(currentUser);
  const [itemsQuantity, setItemsQuantity] = useState<{ id: number; quantity: number; }[]>([]);
  const [paymentModal, setPaymentModal] = useState<boolean>(false);
  const [settings, setSettings] = useState<Map<SettingName, string>>(null);

  useEffect(() => {
    SettingAPI.query(['store_withdrawal_instructions', 'fablab_name'])
      .then(res => setSettings(res))
      .catch(onError);
  }, []);

  useEffect(() => {
    const quantities = cart?.order_items_attributes.map(i => {
      return { id: i.id, quantity: i.quantity };
    });
    setItemsQuantity(quantities);
  }, [cart]);

  /**
   * Remove the product from cart
   */
  const removeProductFromCart = (item) => {
    return (e: React.BaseSyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
      CartAPI.removeItem(cart, item.orderable_id).then(data => {
        setCart(data);
      }).catch(onError);
    };
  };

  /**
   * Change product quantity
   */
  const changeProductQuantity = (e: React.BaseSyntheticEvent, item) => {
    CartAPI.setQuantity(cart, item.orderable_id, e.target.value)
      .then(data => {
        setCart(data);
      })
      .catch(() => onError(t('app.public.store_cart.stock_limit')));
  };
  /** Increment/decrement product quantity  */
  const handleInputNumber = (item, direction: 'up' | 'down') => {
    CartAPI.setQuantity(cart, item.orderable_id, direction === 'up' ? item.quantity + 1 : item.quantity - 1)
      .then(data => {
        setCart(data);
      })
      .catch(() => onError(t('app.public.store_cart.stock_limit')));
  };

  /**
   * Checkout cart
   */
  const checkout = () => {
    if (!currentUser) {
      userLogin();
    } else {
      if (!cart.user) {
        onError(t('app.public.store_cart.select_user'));
      } else {
        setPaymentModal(true);
      }
    }
  };

  /**
   * Open/closes the payment modal
   */
  const togglePaymentModal = (): void => {
    setPaymentModal(!paymentModal);
  };

  /**
   * Handle payment
   */
  const handlePaymentSuccess = (data: Order): void => {
    if (data.state === 'paid') {
      setPaymentModal(false);
      window.location.href = '/#!/store';
      onSuccess(t('app.public.store_cart.checkout_success'));
    } else {
      onError(t('app.public.store_cart.checkout_error'));
    }
  };

  /**
   * Change cart's customer by admin/manger
   */
  const handleChangeMember = (user: User): void => {
    setCart({ ...cart, user: { id: user.id, role: 'member' } });
  };

  /**
   * Check if the current operator has administrative rights or is a normal member
   */
  const isPrivileged = (): boolean => {
    return (currentUser?.role === 'admin' || currentUser?.role === 'manager');
  };

  /**
   * Check if the current cart is empty ?
   */
  const cartIsEmpty = (): boolean => {
    return cart && cart.order_items_attributes.length === 0;
  };

  /**
   * Toggle product offer
   */
  const toggleProductOffer = (item) => {
    return (checked: boolean) => {
      CartAPI.setOffer(cart, item.orderable_id, checked).then(data => {
        setCart(data);
      }).catch(onError);
    };
  };

  /**
   * Apply coupon to current cart
   */
  const applyCoupon = (coupon?: Coupon): void => {
    if (coupon !== cart.coupon) {
      setCart({ ...cart, coupon });
    }
  };

  /**
   * Text instructions for the customer
   */
  const withdrawalInstructions = (): string => {
    const instructions = settings?.get('store_withdrawal_instructions');
    if (instructions) {
      return instructions;
    }
    return t('app.public.store_cart.please_contact_FABLAB', { FABLAB: settings?.get('fablab_name') });
  };

  return (
    <div className='store-cart'>
      <div className="store-cart-list">
        {cart && cartIsEmpty() && <p>{t('app.public.store_cart.cart_is_empty')}</p>}
        {cart && cart.order_items_attributes.map(item => (
          <article key={item.id} className='store-cart-list-item'>
            <div className='picture'>
              <img alt='' src={item.orderable_main_image_url || noImage} />
            </div>
            <div className="ref">
              <span>{t('app.public.store_cart.reference_short')} {item.orderable_ref || ''}</span>
              <p>{item.orderable_name}</p>
              {item.quantity_min > 1 &&
                <span className='min'>{t('app.public.store_cart.minimum_purchase')}{item.quantity_min}</span>
              }
            </div>
            <div className="actions">
              <div className='price'>
                <p>{FormatLib.price(item.amount)}</p>
                <span>/ {t('app.public.store_cart.unit')}</span>
              </div>
              <div className='quantity'>
                <input type='number'
                  onChange={e => changeProductQuantity(e, item)}
                  min={item.quantity_min}
                  max={item.orderable_external_stock}
                  value={itemsQuantity?.find(i => i.id === item.id)?.quantity || 1}
                />
                <button onClick={() => handleInputNumber(item, 'up')}><CaretUp size={12} weight="fill" /></button>
                <button onClick={() => handleInputNumber(item, 'down')}><CaretDown size={12} weight="fill" /></button>
              </div>
              <div className='total'>
                <span>{t('app.public.store_cart.total')}</span>
                <p>{FormatLib.price(OrderLib.itemAmount(item))}</p>
              </div>
              <FabButton className="main-action-btn" onClick={removeProductFromCart(item)}>
                <i className="fa fa-trash" />
              </FabButton>
            </div>
            {isPrivileged() &&
              <div className='offer'>
                <label>
                  <span>{t('app.public.store_cart.offer_product')}</span>
                  <Switch
                  checked={item.is_offered || false}
                  onChange={toggleProductOffer(item)}
                  width={40}
                  height={19}
                  uncheckedIcon={false}
                  checkedIcon={false}
                  handleDiameter={15} />
                </label>
              </div>
            }
          </article>
        ))}
      </div>

      <div className="group">
        <div className='store-cart-info'>
          <h3>{t('app.public.store_cart.pickup')}</h3>
          <p dangerouslySetInnerHTML={{ __html: withdrawalInstructions() }} />
        </div>

        {cart && !cartIsEmpty() &&
          <div className='store-cart-coupon'>
            <CouponInput user={cart.user as User} amount={cart.total} onChange={applyCoupon} />
          </div>
        }
      </div>

      <aside>
        {cart && !cartIsEmpty() && isPrivileged() &&
          <div> <MemberSelect onSelected={handleChangeMember} defaultUser={cart.user as User} /></div>
        }

        {cart && !cartIsEmpty() && <>
          <div className="checkout">
            <h3>{t('app.public.store_cart.checkout_header')}</h3>
            <span>{t('app.public.store_cart.checkout_products_COUNT', { COUNT: cart?.order_items_attributes.length })}</span>
            <div className="list">
              <p>{t('app.public.store_cart.checkout_products_total')} <span>{FormatLib.price(OrderLib.totalBeforeOfferedAmount(cart))}</span></p>
              {OrderLib.hasOfferedItem(cart) &&
                <p className='gift'>{t('app.public.store_cart.checkout_gift_total')} <span>-{FormatLib.price(OrderLib.offeredAmount(cart))}</span></p>
              }
              {cart.coupon &&
                <p>{t('app.public.store_cart.checkout_coupon')} <span>-{FormatLib.price(OrderLib.couponAmount(cart))}</span></p>
              }
            </div>
            <p className='total'>{t('app.public.store_cart.checkout_total')} <span>{FormatLib.price(OrderLib.paidTotal(cart))}</span></p>
          </div>
          <FabButton className='checkout-btn' onClick={checkout}>
            {t('app.public.store_cart.checkout')}
          </FabButton>
        </>}
      </aside>

      {cart && !cartIsEmpty() && cart.user && <div>
        <PaymentModal isOpen={paymentModal}
          toggleModal={togglePaymentModal}
          afterSuccess={handlePaymentSuccess}
          onError={onError}
          cart={{ customer_id: cart.user.id, items: [], payment_method: PaymentMethod.Card }}
          order={cart}
          operator={currentUser}
          customer={cart.user as User}
          updateCart={() => 'dont need update shopping cart'} />
      </div>}
    </div>
  );
};

const StoreCartWrapper: React.FC<StoreCartProps> = (props) => {
  return (
    <Loader>
      <StoreCart {...props} />
    </Loader>
  );
};

Application.Components.component('storeCart', react2angular(StoreCartWrapper, ['onSuccess', 'onError', 'currentUser', 'userLogin']));
