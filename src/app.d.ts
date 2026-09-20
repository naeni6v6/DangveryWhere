declare global {
  namespace App {
    interface Locals {
      user: { id: string; username: string | null; nickname: string } | null;
      accountUnavailable?: boolean;
    }
  }
}
export {};
