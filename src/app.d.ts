declare global {
  namespace App {
    interface Locals {
      user: { id: string } | null;
      accountUnavailable?: boolean;
    }
  }
}
export {};
