# frozen_string_literal: true

unless NotificationType.find_by(name: 'notify_member_training_authorization_expired')
  NotificationType.create!(
    name: 'notify_member_training_authorization_expired',
    category: 'trainings',
    is_configurable: false
  )
end

unless NotificationType.find_by(name: 'notify_member_training_invalidated')
  NotificationType.create!(
    name: 'notify_member_training_invalidated',
    category: 'trainings',
    is_configurable: false
  )
end
