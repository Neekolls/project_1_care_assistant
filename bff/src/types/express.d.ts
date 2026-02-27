import { UserRow } from "../db/repos/users.repo";

declare global {
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

export {};