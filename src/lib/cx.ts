import { clsx, type ClassValue } from "clsx";

/**
 * Class joiner without tailwind-merge (~8 KB gz) for client components on JS-budgeted pages.
 * Use only where callers never pass classes that conflict with the component's own classes;
 * otherwise use `cn` from ./cn (server components can always use `cn` at no bundle cost).
 */
export function cx(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
