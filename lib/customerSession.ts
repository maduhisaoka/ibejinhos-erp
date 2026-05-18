"use client";

import type { RegisteredCustomer } from "@/lib/types";

export type CustomerSession = RegisteredCustomer;

const storageKey = "ibejinhos-customer";
const passwordStorageKey = "ibejinhos-customer-password";

export function getCustomerSession() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as CustomerSession;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function setCustomerSession(customer: CustomerSession, password?: string) {
  window.localStorage.setItem(storageKey, JSON.stringify(customer));
  if (password) {
    window.localStorage.setItem(passwordStorageKey, password);
  }
}

export function clearCustomerSession() {
  window.localStorage.removeItem(storageKey);
  window.localStorage.removeItem(passwordStorageKey);
}

export function getCustomerSessionPassword() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(passwordStorageKey) ?? "";
}
