import { createContext, useContext, useState } from "react";

interface CurrentUser {
  id: number;
  name: string;
  email: string;
  tribeId: number | null;
  quizCompleted: boolean;
  avatarInitials: string | null;
  avatarColor: string | null;
}

interface UserCtx {
  user: CurrentUser | null;
  setUser: (u: CurrentUser | null) => void;
}

const UserContext = createContext<UserCtx>({ user: null, setUser: () => {} });

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);
