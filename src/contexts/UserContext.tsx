import { createContext } from 'react';

export interface UserProfile {
  userType: string | null;
  userId: string | null;
  isUserLoading: boolean;
}

export const UserContext = createContext<UserProfile | undefined>(undefined);
