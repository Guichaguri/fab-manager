# frozen_string_literal: true

# List all Availability's slots for the given resources
class Availabilities::AvailabilitiesService
  # @param current_user [User]
  # @param level [String] 'slot' | 'availability'
  def initialize(current_user, level = 'slot')
    @current_user = current_user
    @maximum_visibility = {
      year: Setting.get('visibility_yearly').to_i.months.since,
      other: Setting.get('visibility_others').to_i.months.since
    }
    @minimum_visibility = Setting.get('reservation_deadline').to_i.minutes.since
    @level = level
  end

  # @param window [Hash] the time window the look through: {start: xxx, end: xxx}
  # @option window [ActiveSupport::TimeWithZone] :start
  # @option window [ActiveSupport::TimeWithZone] :end
  # @param ids [Hash{Symbol->ActionController::Parameters | Array<Integer>}]
  # @param events [Boolean] should events be included in the results?
  def index(window, ids, events: false)
    machines_availabilities = Setting.get('machines_module') ? machines(Machine.where(id: ids[:machines]), @current_user, window) : []
    spaces_availabilities = Setting.get('spaces_module') ? spaces(Space.where(id: ids[:spaces]), @current_user, window) : []
    trainings_availabilities = Setting.get('trainings_module') ? trainings(Training.where(id: ids[:trainings]), @current_user, window) : []
    events_availabilities = if events && Setting.get('events_in_calendar')
                              events(Event.all, @current_user, window)
                            else
                              []
                            end

    [].concat(trainings_availabilities).concat(events_availabilities).concat(machines_availabilities).concat(spaces_availabilities)
  end

  # list all slots for the given machines, with visibility relative to the given user
  # @param machines [ActiveRecord::Relation<Machine>]
  # @param user [User]
  # @param window [Hash] the time window the look through: {start: xxx, end: xxx}
  # @option window [ActiveSupport::TimeWithZone] :start the beginning of the time window
  # @option window [ActiveSupport::TimeWithZone] :end the end of the time window
  def machines(machines, user, window)
    ma_availabilities = Availability.includes(:machines_availabilities)
                                    .where('machines_availabilities.machine_id': machines.map(&:id))
    availabilities = availabilities(ma_availabilities, 'machines', user, window[:start], window[:end])

    if @level == 'slot'
      availabilities.map(&:slots).flatten
    else
      availabilities
    end
  end

  # list all slots for the given space, with visibility relative to the given user
  # @param spaces [ActiveRecord::Relation<Space>]
  # @param user [User]
  # @param window [Hash] the time window the look through: {start: xxx, end: xxx}
  # @option window [ActiveSupport::TimeWithZone] :start
  # @option window [ActiveSupport::TimeWithZone] :end
  def spaces(spaces, user, window)
    sp_availabilities = Availability.includes('spaces_availabilities')
                                    .where('spaces_availabilities.space_id': spaces.map(&:id))
    availabilities = availabilities(sp_availabilities, 'space', user, window[:start], window[:end])

    if @level == 'slot'
      availabilities.map(&:slots).flatten
    else
      availabilities
    end
  end

  # list all slots for the given training(s), with visibility relative to the given user
  # @param trainings [ActiveRecord::Relation<Training>]
  # @param user [User]
  # @param window [Hash] the time window the look through: {start: xxx, end: xxx}
  # @option window [ActiveSupport::TimeWithZone] :start
  # @option window [ActiveSupport::TimeWithZone] :end
  def trainings(trainings, user, window)
    tr_availabilities = Availability.includes('trainings_availabilities')
                                    .where('trainings_availabilities.training_id': trainings.map(&:id))
    availabilities = availabilities(tr_availabilities, 'training', user, window[:start], window[:end])

    if @level == 'slot'
      availabilities.map(&:slots).flatten
    else
      availabilities
    end
  end

  # list all slots for the given event(s), with visibility relative to the given user
  # @param events [ActiveRecord::Relation<Event>]
  # @param user [User]
  # @param window [Hash] the time window the look through: {start: xxx, end: xxx}
  # @option window [ActiveSupport::TimeWithZone] :start
  # @option window [ActiveSupport::TimeWithZone] :end
  def events(events, user, window)
    ev_availabilities = Availability.includes('event').where('events.id': events.map(&:id))
    availabilities = availabilities(ev_availabilities, 'event', user, window[:start], window[:end])

    if @level == 'slot'
      availabilities.map(&:slots).flatten
    else
      availabilities
    end
  end

  protected

  # @param user [User]
  def subscription_year?(user)
    user&.subscription && user.subscription.plan.interval == 'year' && user.subscription.expired_at >= Time.current
  end

  # members must have validated at least 1 training and must have a valid yearly subscription to view
  # the trainings further in the futur. This is used to prevent users with a rolling subscription to take
  # their first training in a very long delay.
  # @param user [User]
  def show_more_trainings?(user)
    user&.trainings&.size&.positive? && subscription_year?(user)
  end

  # @param availabilities [ActiveRecord::Relation<Availability>]
  # @param type [String]
  # @param user [User]
  # @param range_start [ActiveSupport::TimeWithZone]
  # @param range_end [ActiveSupport::TimeWithZone]
  # @return ActiveRecord::Relation<Availability>
  def availabilities(availabilities, type, user, range_start, range_end)
    # who made the request?
    # 1) an admin (he can see all availabilities from 1 month ago to anytime in the future)
    if @current_user&.admin? || @current_user&.manager?
      window_start = [range_start, 1.month.ago].max
      availabilities.includes(:tags, :slots)
                    .joins(:slots)
                    .where('availabilities.start_at <= ? AND availabilities.end_at >= ? AND available_type = ?', range_end, window_start, type)
                    .where('slots.start_at > ? AND slots.end_at < ?', window_start, range_end)
    # 2) an user (he cannot see past availabilities neither those further than 1 (or 3) months in the future)
    else
      end_at = @maximum_visibility[:other]
      end_at = @maximum_visibility[:year] if subscription_year?(user) && type != 'training'
      end_at = @maximum_visibility[:year] if show_more_trainings?(user) && type == 'training'
      window_end = [end_at, range_end].min
      window_start = [range_start, @minimum_visibility].max
      availabilities.includes(:tags, :slots)
                    .joins(:slots)
                    .where('availabilities.start_at <= ? AND availabilities.end_at >= ? AND available_type = ?', window_end, window_start, type)
                    .where('slots.start_at > ? AND slots.end_at < ?', window_start, window_end)
                    .where('availability_tags.tag_id' => user&.tag_ids&.concat([nil]))
                    .where(lock: false)
    end
  end
end
