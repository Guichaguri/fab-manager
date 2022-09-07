import { useState, useEffect } from 'react';
import { Order } from '../models/order';
import CartAPI from '../api/cart';
import { getCartToken, setCartToken } from '../lib/cart-token';
import { User } from '../models/user';

export default function useCart (user?: User) {
  const [cart, setCart] = useState<Order>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function createCart () {
      const currentCartToken = getCartToken();
      const data = await CartAPI.create(currentCartToken);
      setCart(data);
      setLoading(false);
      setCartToken(data.token);
    }
    setLoading(true);
    try {
      createCart();
    } catch (e) {
      setLoading(false);
      setError(e);
    }
  }, []);

  const reloadCart = async () => {
    setLoading(true);
    const currentCartToken = getCartToken();
    const data = await CartAPI.create(currentCartToken);
    setCart(data);
    setLoading(false);
  };

  useEffect(() => {
    if (user && cart && (!cart.statistic_profile_id || !cart.operator_profile_id)) {
      reloadCart();
    }
  }, [user]);

  return { loading, cart, error, setCart, reloadCart };
}
