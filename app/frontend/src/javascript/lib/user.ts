import { User, UserRole } from '../models/user';

export default class UserLib {
  private user: User;

  constructor (user: User) {
    this.user = user;
  }

  /**
   * Check if the current user has privileged access for resources concerning the provided customer
   */
  isPrivileged = (customer: User): boolean => {
    if (this.user.role === UserRole.Admin) return true;

    if (this.user.role === UserRole.Manager) {
      return (this.user.id !== customer.id);
    }

    return false;
  };

  /**
   * Filter social networks from the user's profile
   */
  getUserSocialNetworks = (customer: User): {name: string, url: string}[] => {
    const userNetworks = [];
    const supportedNetworks = ['facebook', 'twitter', 'viadeo', 'linkedin', 'instagram', 'youtube', 'vimeo', 'dailymotion', 'github', 'echosciences', 'pinterest', 'lastfm', 'flickr'];

    for (const [name, url] of Object.entries(customer.profile)) {
      supportedNetworks.includes(name) && userNetworks.push({ name, url });
    }
    return userNetworks;
  };
}
