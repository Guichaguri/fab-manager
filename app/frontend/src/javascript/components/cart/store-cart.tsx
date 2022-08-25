import React, { useState } from 'react';
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

declare const Application: IApplication;

interface StoreCartProps {
  onError: (message: string) => void,
  currentUser?: User,
}

/**
 * This component shows user's cart
 */
const StoreCart: React.FC<StoreCartProps> = ({ onError, currentUser }) => {
  const { t } = useTranslation('public');

  const { cart, setCart } = useCart(currentUser);
  const [paymentModal, setPaymentModal] = useState<boolean>(false);

  /**
   * Remove the product from cart
   */
  const removeProductFromCart = (item) => {
    return (e: React.BaseSyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
      CartAPI.removeItem(cart, item.orderable_id).then(data => {
        setCart(data);
      });
    };
  };

  /**
   * Change product quantity
   */
  const changeProductQuantity = (item) => {
    return (e: React.BaseSyntheticEvent) => {
      CartAPI.setQuantity(cart, item.orderable_id, e.target.value).then(data => {
        setCart(data);
      });
    };
  };

  /**
   * Checkout cart
   */
  const checkout = () => {
    setPaymentModal(true);
  };

  /**
   * Open/closes the payment modal
   */
  const togglePaymentModal = (): void => {
    setPaymentModal(!paymentModal);
  };

  /**
   * Open/closes the payment modal
   */
  const handlePaymentSuccess = (data: Order): void => {
    console.log(data);
    setPaymentModal(false);
  };

  /**
   * Change cart's customer by admin/manger
   */
  const handleChangeMember = (userId: number): void => {
    CartAPI.setCustomer(cart, userId).then(data => {
      setCart(data);
    });
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

  return (
    <div className="store-cart">
      {cart && cartIsEmpty() && <p>{t('app.public.store_cart.cart_is_empty')}</p>}
      {cart && cart.order_items_attributes.map(item => (
        <div key={item.id}>
          <div>{item.orderable_name}</div>
          <div>{FormatLib.price(item.amount)}</div>
          <div>{item.quantity}</div>
          <select value={item.quantity} onChange={changeProductQuantity(item)}>
            {Array.from({ length: 100 }, (_, i) => i + 1).map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <div>{FormatLib.price(item.quantity * item.amount)}</div>
          <FabButton className="delete-btn" onClick={removeProductFromCart(item)}>
            <i className="fa fa-trash" />
          </FabButton>
        </div>
      ))}
      {cart && !cartIsEmpty() && <p>Totale: {FormatLib.price(cart.amount)}</p>}
      {cart && !cartIsEmpty() && isPrivileged() && <MemberSelect defaultUser={cart.user} onSelected={handleChangeMember} />}
      {cart && !cartIsEmpty() &&
        <FabButton className="checkout-btn" onClick={checkout} disabled={!cart.user || cart.order_items_attributes.length === 0}>
          {t('app.public.store_cart.checkout')}
        </FabButton>
      }
      {cart && !cartIsEmpty() && cart.user && <div>
        <PaymentModal isOpen={paymentModal}
          toggleModal={togglePaymentModal}
          afterSuccess={handlePaymentSuccess}
          onError={onError}
          cart={{ customer_id: cart.user.id, items: [], payment_method: PaymentMethod.Card }}
          order={cart}
          operator={currentUser}
          customer={cart.user}
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

Application.Components.component('storeCart', react2angular(StoreCartWrapper, ['onError', 'currentUser']));
