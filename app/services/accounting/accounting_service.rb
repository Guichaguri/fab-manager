# frozen_string_literal: false

# module definition
module Accounting; end

# Provides the routine to build the accounting data and save them in DB
class Accounting::AccountingService
  attr_reader :currency, :journal_code

  def initialize
    @currency = ENV.fetch('INTL_CURRENCY') { '' }
    @journal_code = Setting.get('accounting_journal_code') || ''
  end

  def build(start_date, end_date)
    # build accounting lines
    lines = []
    invoices = Invoice.where('created_at >= ? AND created_at <= ?', start_date, end_date).order('created_at ASC')
    invoices.each do |i|
      Rails.logger.debug { "processing invoice #{i.id}..." } unless Rails.env.test?
      lines << generate_lines(i)
    end
    AccountingLine.create!(lines)
  end

  private

  def generate_lines(invoice)
    lines = client_lines(invoice) + items_lines(invoice)

    vat = vat_line(invoice)
    lines << vat unless vat.nil?

    lines
  end

  # Generate the lines associated with the provided invoice, for the sales accounts
  def items_lines(invoice)
    lines = []
    %w[Subscription Reservation WalletTransaction StatisticProfilePrepaidPack OrderItem Error].each do |object_type|
      items = invoice.invoice_items.filter { |ii| ii.object_type == object_type }
      items.each do |item|
        lines << line(
          invoice,
          'item',
          Accounting::AccountingCodeService.sales_account(item),
          Accounting::AccountingCodeService.sales_account(item, type: :label),
          item.net_amount,
          analytical_code: Accounting::AccountingCodeService.sales_account(item, section: :analytical_section)
        )
      end
    end
    lines
  end

  # Generate the "client" lines, which contains the debit to the client account, all taxes included
  def client_lines(invoice)
    lines = []
    invoice.payment_means.each do |details|
      lines << line(
        invoice,
        'client',
        Accounting::AccountingCodeService.client_account(details[:means]),
        Accounting::AccountingCodeService.client_account(details[:means], type: :label),
        details[:amount],
        debit_method: :debit_client,
        credit_method: :credit_client
      )
    end
    lines
  end

  # Generate the "VAT" line, which contains the credit to the VAT account, with total VAT amount only
  def vat_line(invoice)
    vat_rate_groups = VatHistoryService.new.invoice_vat(invoice)
    total_vat = vat_rate_groups.values.pluck(:total_vat).sum
    # we do not render the VAT row if it was disabled for this invoice
    return nil if total_vat.zero?

    line(
      invoice,
      'vat',
      Accounting::AccountingCodeService.vat_account,
      Accounting::AccountingCodeService.vat_account(type: :label),
      total_vat
    )
  end

  # Generate a row of the export, filling the configured columns with the provided values
  def line(invoice, line_type, account_code, account_label, amount, analytical_code: '', debit_method: :debit, credit_method: :credit)
    {
      line_type: line_type,
      journal_code: journal_code,
      date: invoice.created_at,
      account_code: account_code,
      account_label: account_label,
      analytical_code: analytical_code,
      invoice_id: invoice.id,
      invoicing_profile_id: invoice.invoicing_profile_id,
      debit: method(debit_method).call(invoice, amount),
      credit: method(credit_method).call(invoice, amount),
      currency: currency,
      summary: summary(invoice)
    }
  end

  # Fill the value of the "debit" column: if the invoice is a refund, returns the given amount, returns 0 otherwise
  def debit(invoice, amount)
    invoice.is_a?(Avoir) ? amount : 0
  end

  # Fill the value of the "credit" column: if the invoice is a refund, returns 0, otherwise, returns the given amount
  def credit(invoice, amount)
    invoice.is_a?(Avoir) ? 0 : amount
  end

  # Fill the value of the "debit" column for the client row: if the invoice is a refund, returns 0, otherwise, returns the given amount
  def debit_client(invoice, amount)
    credit(invoice, amount)
  end

  # Fill the value of the "credit" column, for the client row: if the invoice is a refund, returns the given amount, returns 0 otherwise
  def credit_client(invoice, amount)
    debit(invoice, amount)
  end

  # Create a text from the given invoice, matching the accounting software rules for the labels
  def summary(invoice)
    reference = invoice.reference

    items = invoice.subscription_invoice? ? [I18n.t('accounting_summary.subscription_abbreviation')] : []
    if invoice.main_item.object_type == 'Reservation'
      items.push I18n.t("accounting_summary.#{invoice.main_item.object.reservable_type}_reservation_abbreviation")
    end
    items.push I18n.t('accounting_summary.wallet_abbreviation') if invoice.main_item.object_type == 'WalletTransaction'
    items.push I18n.t('accounting_summary.shop_order_abbreviation') if invoice.main_item.object_type == 'OrderItem'

    "#{reference}, #{items.join(' + ')}"
  end
end
