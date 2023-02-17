# frozen_string_literal: true

require 'integrity/checksum'

# Will generate a ZIP archive file containing all invoicing data for the given period.
# This file will be asynchronously generated by sidekiq and a notification will be sent to the requesting user when it's done.
class ArchiveWorker
  include Sidekiq::Worker

  def perform(accounting_period_id)
    period = AccountingPeriod.find(accounting_period_id)
    invoices = period.invoices.includes(:invoice_items).order(created_at: :asc)
    schedules = period.payment_schedules.includes(:payment_schedule_items, :payment_schedule_objects).order(created_at: :asc)
    previous_file = period.previous_period&.archive_file
    last_archive_checksum = previous_file ? Integrity::Checksum.file(previous_file) : nil
    json_data = to_json_archive(period, invoices, schedules, previous_file, last_archive_checksum)
    current_archive_checksum = Integrity::Checksum.text(json_data)
    date = Time.current.iso8601
    chained = Integrity::Checksum.text("#{current_archive_checksum}#{last_archive_checksum}#{date}")

    Zip::OutputStream.open(period.archive_file) do |io|
      io.put_next_entry(period.archive_json_file)
      io.write(json_data)
      io.put_next_entry('checksum.sha256')
      io.write("#{current_archive_checksum}\t#{period.archive_json_file}")
      io.put_next_entry('chained.sha256')
      io.write("#{chained}\t#{date}")
    end

    NotificationCenter.call type: :notify_admin_archive_complete,
                            receiver: User.where(id: period.closed_by)&.first,
                            attached_object: period
  end

  private

  def to_json_archive(period, invoices, schedules, previous_file, last_checksum)
    code_checksum = Integrity::Checksum.code
    ApplicationController.new.view_context.render(
      partial: 'archive/accounting',
      locals: {
        invoices: period.invoices_with_vat(invoices),
        schedules: schedules,
        period_total: period.period_total,
        perpetual_total: period.perpetual_total,
        period_footprint: period.footprint,
        code_checksum: code_checksum,
        last_archive_checksum: last_checksum,
        previous_file: previous_file,
        software_version: Version.current,
        date: Time.current.iso8601
      },
      formats: [:json],
      handlers: [:jbuilder]
    )
  end
end
