# frozen_string_literal: true

# Check the access policies for API::EventsController
class EventPolicy < ApplicationPolicy
  # Defines the scope of the events index, depending on the role of the current user
  class Scope < Scope
    def resolve
      if user.nil? || (user && !user.admin? && !user.manager?)
        scope.includes(:event_image, :event_files, :availability, :category, :event_price_categories, :age_range, :events_event_themes, :event_themes)
             .where('availabilities.start_at >= ?', DateTime.current)
             .order('availabilities.start_at ASC')
             .references(:availabilities)
      else
        scope.includes(:event_image, :event_files, :availability, :category, :event_price_categories, :age_range, :events_event_themes, :event_themes)
             .references(:availabilities)
      end
    end
  end

  def create?
    user.admin? || user.manager?
  end

  def update?
    create?
  end

  def destroy?
    create?
  end
end
