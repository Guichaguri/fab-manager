# frozen_string_literal: true

# Provides helper methods for Subscription actions
class Subscriptions::Subscribe
  attr_accessor :user_id, :operator_profile_id

  def initialize(operator_profile_id, user_id = nil)
    @user_id = user_id
    @operator_profile_id = operator_profile_id
  end

  ##
  # @param subscription {Subscription}
  # @param payment_details {Hash} as generated by Price.compute
  # @param payment_intent_id {String} from stripe
  # @param schedule {Boolean}
  # @param payment_method {String} only for schedules
  ##
  def pay_and_save(subscription, payment_details: nil, payment_intent_id: nil, schedule: false, payment_method: nil)
    return false if user_id.nil?

    subscription.statistic_profile_id = StatisticProfile.find_by(user_id: user_id).id
    subscription.init_save
    user = User.find(user_id)

    payment = if schedule
                generate_schedule(subscription: subscription,
                                  total: payment_details[:before_coupon],
                                  operator_profile_id: operator_profile_id,
                                  user: user,
                                  payment_method: payment_method,
                                  coupon_code: payment_details[:coupon])
              else
                generate_invoice(subscription, operator_profile_id, payment_details, payment_intent_id)
              end
    payment.save
    WalletService.debit_user_wallet(payment, user, subscription)
    true
  end

  def extend_subscription(subscription, new_expiration_date, free_days)
    return subscription.free_extend(new_expiration_date, @operator_profile_id) if free_days

    new_sub = Subscription.create(
      plan_id: subscription.plan_id,
      statistic_profile_id: subscription.statistic_profile_id,
      expiration_date: new_expiration_date
    )
    if new_sub.save
      schedule = subscription.payment_schedule
      details = Price.compute(true, new_sub.user, nil, [], plan_id: subscription.plan_id)
      payment = if schedule
                  generate_schedule(subscription: new_sub,
                                    total: details[:before_coupon],
                                    operator_profile_id: operator_profile_id,
                                    user: new_sub.user,
                                    payment_method: schedule.payment_method)
                else
                  generate_invoice(subscription, operator_profile_id, details)
                end
      payment.save
      UsersCredits::Manager.new(user: new_sub.user).reset_credits
      return new_sub
    end
    false
  end

  private

  ##
  # Generate the invoice for the given subscription
  ##
  def generate_schedule(subscription: nil, total: nil, operator_profile_id: nil, user: nil, payment_method: nil, coupon_code: nil)
    operator = InvoicingProfile.find(operator_profile_id)&.user
    coupon = Coupon.find_by(code: coupon_code) unless coupon_code.nil?

    PaymentScheduleService.new.create(
      subscription,
      total,
      coupon: coupon,
      operator: operator,
      payment_method: payment_method,
      user: user
    )
  end

  ##
  # Generate the invoice for the given subscription
  ##
  def generate_invoice(subscription, operator_profile_id, payment_details, payment_intent_id = nil)
    InvoicesService.create(
      payment_details,
      operator_profile_id,
      subscription: subscription,
      payment_intent_id: payment_intent_id
    )
  end

end
