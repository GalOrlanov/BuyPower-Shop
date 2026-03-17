import { Notification } from '../models/Notification.model';
import { NotificationType } from '../types';

/** Create a notification for a user */
export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> => {
  await Notification.create({ userId, type, title, message, data });

  // TODO: Send push notification via Firebase
  // TODO: Send email notification if user has email notifications enabled
};

/** Notify all participants of a group purchase */
export const notifyGroupPurchaseParticipants = async (
  participantUserIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> => {
  const notifications = participantUserIds.map((userId) => ({
    userId,
    type,
    title,
    message,
    data,
  }));

  await Notification.insertMany(notifications);
};
