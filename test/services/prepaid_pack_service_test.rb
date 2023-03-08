# frozen_string_literal: true

require 'test_helper'

class PrepaidPackServiceTest < ActiveSupport::TestCase
  setup do
    @acamus = User.find_by(username: 'acamus')
    @machine = Machine.first
  end

  test 'get user packs' do
    packs = PrepaidPackService.user_packs(@acamus, @machine)
    p = StatisticProfilePrepaidPack.where(statistic_profile_id: @acamus.statistic_profile.id)
    assert_not_empty packs
    assert_equal packs.length, 1
    assert_equal p.length, 2
    assert_equal packs.first.id, p.last.id
  end

  test 'total number of prepaid minutes available' do
    minutes_available = PrepaidPackService.minutes_available(@acamus, @machine)
    assert_equal minutes_available, 600
  end

  test 'update user pack minutes' do
    availabilities_service = Availabilities::AvailabilitiesService.new(@acamus)

    slots = availabilities_service.machines([@machine], @acamus, { start: Time.current, end: 1.day.from_now })
    reservation = Reservation.create(
      reservable_id: @machine.id,
      reservable_type: Machine.name,
      slots: [slots[0], slots[1]],
      statistic_profile_id: @acamus.statistic_profile.id
    )

    PrepaidPackService.update_user_minutes(@acamus, reservation)
    minutes_available = PrepaidPackService.minutes_available(@acamus, @machine)
    assert_equal minutes_available, 480
  end

  test 'member has multiple active packs' do
    availabilities_service = Availabilities::AvailabilitiesService.new(@acamus)

    # user with current pack reserve 8 slots (on 10 available in the pack)
    slots = availabilities_service.machines([@machine], @acamus, { start: Time.current, end: 10.days.from_now })
    reservation = Reservation.create(
      reservable_id: @machine.id,
      reservable_type: Machine.name,
      slots: [slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7]],
      statistic_profile_id: @acamus.statistic_profile.id
    )

    PrepaidPackService.update_user_minutes(@acamus, reservation)
    minutes_available = PrepaidPackService.minutes_available(@acamus, @machine)
    assert_equal 120, minutes_available

    # user buy a new pack
    prepaid_pack = PrepaidPack.first
    StatisticProfilePrepaidPack.create!(prepaid_pack: prepaid_pack, statistic_profile: @acamus.statistic_profile)

    minutes_available = PrepaidPackService.minutes_available(@acamus, @machine)
    assert_equal 720, minutes_available

    # user books a new reservation of 4 slots
    reservation = Reservation.create(
      reservable_id: @machine.id,
      reservable_type: Machine.name,
      slots: [slots[8], slots[9], slots[10], slots[11]],
      statistic_profile_id: @acamus.statistic_profile.id
    )

    PrepaidPackService.update_user_minutes(@acamus, reservation)
    minutes_available = PrepaidPackService.minutes_available(@acamus, @machine)
    assert_equal 480, minutes_available
  end
end
