# frozen_string_literal: true

# This take will ensure data integrity for availbilities.
# For an unknown reason, some slots are associated with unexisting availabilities. This script will try to re-create them
namespace :fablab do
  desc 'regenerate missing availabilities'
  task fix_availabilities: :environment do |_task, _args|
    ActiveRecord::Base.transaction do
      Slot.find_each do |slot|
        next unless slot.availability.nil?

        other_slots = Slot.where(availability_id: slot.availability_id)
        reservations = SlotsReservation.where(slot_id: other_slots.map(&:id))

        a = Availability.new(
          id: slot.availability_id,
          start_at: other_slots.group('id').select('min(start_at) as min').first[:min],
          end_at: other_slots.group('id').select('max(end_at) as max').first[:max],
          available_type: available_type(reservations),
          machine_ids: machines_ids(reservations, slot.availability_id),
          space_ids: space_ids(reservations, slot.availability_id),
          training_ids: training_ids(reservations, slot.availability_id)
        )
        raise StandardError, "unable to save availability for slot #{slot.id}: #{a.errors.full_messages}" unless a.save(validate: false)
      end
    end
  end

  private

  # @param reservations [ActiveRecord::Relation<SlotsReservation>]
  def available_type(reservations)
    return 'unknown' if reservations.count.zero?

    type = reservations.first&.reservation&.reservable_type
    case type
    when 'Training', 'Space', 'Event'
      type&.downcase
    else
      'machines'
    end
  end

  # @param reservations [ActiveRecord::Relation<SlotsReservation>]
  # @param availability_id [Number]
  def machines_ids(reservations, availability_id)
    type = reservations.first&.reservation&.reservable_type
    return [] unless type == 'Machine'

    ma = MachinesAvailability.where(availability_id: availability_id).map(&:machine_id)
    return ma unless ma.empty?

    rv = reservations.map(&:reservation).map(&:reservable_id)
    return rv unless rv.empty?

    []
  end

  # @param reservations [ActiveRecord::Relation<SlotsReservation>]
  # @param availability_id [Number]
  def space_ids(reservations, availability_id)
    type = reservations.first&.reservation&.reservable_type
    return [] unless type == 'Space'

    sa = SpacesAvailability.where(availability_id: availability_id).map(&:machine_id)
    return sa unless sa.empty?

    rv = reservations.map(&:reservation).map(&:reservable_id)
    return rv unless rv.empty?

    []
  end

  # @param reservations [ActiveRecord::Relation<SlotsReservation>]
  # @param availability_id [Number]
  def training_ids(reservations, availability_id)
    type = reservations.first&.reservation&.reservable_type
    return [] unless type == 'Training'

    ta = TrainingsAvailability.where(availability_id: availability_id).map(&:machine_id)
    return ta unless ta.empty?

    rv = reservations.map(&:reservation).map(&:reservable_id)
    return rv unless rv.empty?

    []
  end
end
