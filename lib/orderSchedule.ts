const saturdayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo"
});

export const orderScheduleMessage =
  "Pedidos feitos até quarta-feira às 18h. As entregas acontecem aos sábados.";

export function isTestOrderAccessEnabled() {
  return process.env.NEXT_PUBLIC_ALLOW_TEST_ORDERS === "true" || process.env.NODE_ENV === "development";
}

function getSaoPauloDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  return {
    weekdayName: parts.find((part) => part.type === "weekday")?.value ?? "Sun",
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    dayOfMonth: Number(parts.find((part) => part.type === "day")?.value),
    hour: Number(parts.find((part) => part.type === "hour")?.value)
  };
}

export function isOrderWindowOpen(date = new Date()) {
  if (isTestOrderAccessEnabled()) {
    return true;
  }

  const { weekdayName, hour } = getSaoPauloDateParts(date);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);

  if (weekday < 3) {
    return true;
  }

  if (weekday === 3) {
    return hour < 18;
  }

  return false;
}

export function getNextDeliveryDate(date = new Date()) {
  const { year, month, dayOfMonth, weekdayName, hour } = getSaoPauloDateParts(date);
  const saoPauloNow = new Date(year, month - 1, dayOfMonth);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);
  let daysUntilSaturday = (6 - day + 7) % 7;
  if (day > 3 || (day === 3 && hour >= 18)) {
    daysUntilSaturday += 7;
  }
  saoPauloNow.setDate(saoPauloNow.getDate() + daysUntilSaturday);
  return saoPauloNow;
}

export function getFormattedNextDeliveryDate(date = new Date()) {
  return saturdayFormatter.format(getNextDeliveryDate(date));
}

export function getClosedOrderMessage() {
  return "Os pedidos desta semana já foram encerrados. Recebemos pedidos até quarta-feira às 18h para entrega no sábado.";
}
