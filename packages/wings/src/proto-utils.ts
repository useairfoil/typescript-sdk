import { Ticket } from "@airfoil/flight";
import { Any, type MessageFns } from "./proto/utils";

export function createAny<T, V extends string, M extends MessageFns<T, V>>(
  typ: M,
  ...args: Parameters<M["create"]>
): Any {
  return Any.create({
    typeUrl: `type.googleapis.com/${typ.$type}`,
    value: typ.encode(typ.create(...args)).finish(),
  });
}

export function createTicket(inner: Any) {
  return Ticket.create({
    ticket: Any.encode(inner).finish(),
  });
}
