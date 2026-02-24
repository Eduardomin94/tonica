import { Resend } from "resend";

export function makeTransporter() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Falta RESEND_API_KEY en .env");
  }

  return new Resend(process.env.RESEND_API_KEY);
}