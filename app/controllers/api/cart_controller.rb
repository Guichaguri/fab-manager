# frozen_string_literal: true

# API Controller for manage user's cart
class API::CartController < API::ApiController
  include API::OrderConcern

  before_action :current_order, except: %i[create]
  before_action :ensure_order, except: %i[create]

  def create
    authorize :cart, :create?
    @order = Order.find_by(token: order_token, state: 'cart')
    if @order.nil?
      if current_user&.member?
        @order = Order.where(statistic_profile_id: current_user.statistic_profile.id,
                             state: 'cart').last
      end
      if current_user&.privileged?
        @order = Order.where(operator_profile_id: current_user.invoicing_profile.id,
                             state: 'cart').last
      end
    end
    if @order
      @order.update(statistic_profile_id: current_user.statistic_profile.id) if @order.statistic_profile_id.nil? && current_user&.member?
      @order.update(operator_profile_id: current_user.invoicing_profile.id) if @order.operator_profile_id.nil? && current_user&.privileged?
    end
    @order ||= Cart::CreateService.new.call(current_user)
    render 'api/orders/show'
  end

  def add_item
    authorize @current_order, policy_class: CartPolicy
    @order = Cart::AddItemService.new.call(@current_order, orderable, cart_params[:quantity])
    render 'api/orders/show'
  end

  def remove_item
    authorize @current_order, policy_class: CartPolicy
    @order = Cart::RemoveItemService.new.call(@current_order, orderable)
    render 'api/orders/show'
  end

  def set_quantity
    authorize @current_order, policy_class: CartPolicy
    @order = Cart::SetQuantityService.new.call(@current_order, orderable, cart_params[:quantity])
    render 'api/orders/show'
  end

  private

  def orderable
    Product.find(cart_params[:orderable_id])
  end
end
