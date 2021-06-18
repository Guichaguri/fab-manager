import React, { BaseSyntheticEvent, useEffect, useState } from 'react';
import { PendingTrainingModal } from './pending-training-modal';
import MachineAPI from '../../api/machine';
import { Machine } from '../../models/machine';
import { User } from '../../models/user';
import { RequiredTrainingModal } from './required-training-modal';

interface ReserveButtonProps {
  currentUser?: User,
  machineId: number,
  onLoadingStart?: () => void,
  onLoadingEnd?: () => void,
  onError: (message: string) => void,
  onReserveMachine: (machineId: number) => void,
  onLoginRequested: () => Promise<User>,
  onEnrollRequested: (trainingId: number) => void,
  className?: string
}

/**
 * Button component that makes the training verification before redirecting the user to the reservation calendar
 */
export const ReserveButton: React.FC<ReserveButtonProps> = ({ currentUser, machineId, onLoginRequested, onLoadingStart, onLoadingEnd, onError, onReserveMachine, onEnrollRequested, className, children }) => {

  const [machine, setMachine] = useState<Machine>(null);
  const [user, setUser] = useState<User>(currentUser);
  const [pendingTraining, setPendingTraining] = useState<boolean>(false);
  const [trainingRequired, setTrainingRequired] = useState<boolean>(false);

  // refresh the machine after the user has logged
  useEffect(() => {
    if (user !== currentUser) getMachine();
  }, [user]);
  // check the trainings after we retrieved the machine data
  useEffect(() => checkTraining(), [machine]);

  /**
   * Callback triggered when the user clicks on the 'reserve' button.
   */
  const handleClick = (): void => {
    getMachine();
  };

  /**
   * We load the full machine data, including data on the current user status for this machine.
   * Then we check if the user has passed the training for it (if it's needed)
   */
  const getMachine = (): void => {
    if (onLoadingStart) onLoadingStart();

    MachineAPI.get(machineId)
      .then(data => {
        setMachine(data);
        if (onLoadingEnd) onLoadingEnd();
      })
      .catch(error => {
        onError(error);
        if (onLoadingEnd) onLoadingEnd();
      });
  };

  /**
   * Open/closes the alert modal informing the user about his pending training
   */
  const togglePendingTrainingModal = (): void => {
    setPendingTraining(!pendingTraining);
  };

  /**
   * Open/closes the alert modal informing the user about his pending training
   */
  const toggleRequiredTrainingModal = (): void => {
    setTrainingRequired(!trainingRequired);
  };

  /**
   * Check that the current user has passed the required training before allowing him to book
   */
  const checkTraining = (): void => {
    // do nothing if the machine is still not loaded
    if (!machine) return;

    // if there's no user currently logged, trigger the logging process
    if (!user) {
      onLoginRequested()
        .then(user => setUser(user))
        .catch(error => onError(error));
      return;
    }

    // if the currently logged user has completed the training for this machine, or this machine does not require
    // a prior training, just let him reserve.
    // Moreover, if all associated trainings are disabled, let the user reserve too.
    if (machine.current_user_is_trained || machine.trainings.length === 0 ||
        machine.trainings.map(t => t.disabled).reduce((acc, val) => acc && val, true)) {
      return onReserveMachine(machineId);
    }

    // if the currently logged user booked a training for this machine, tell him that he must wait
    // for an admin to validate the training before he can book the reservation
    if (machine.current_user_next_training_reservation) {
      return setPendingTraining(true);
    }

    // if the currently logged user doesn't have booked the required training, tell him to register
    // for a training session first
    setTrainingRequired(true);
  };

  return (
    <span>
      <button onClick={handleClick} className={className}>
        {children}
      </button>
      <PendingTrainingModal isOpen={pendingTraining}
                            toggleModal={togglePendingTrainingModal}
                            nextReservation={machine?.current_user_next_training_reservation?.slots_attributes[0]?.start_at}  />
      <RequiredTrainingModal isOpen={trainingRequired}
                             toggleModal={toggleRequiredTrainingModal}
                             user={user}
                             machine={machine}
                             onEnrollRequested={onEnrollRequested} />
    </span>

  );
}
