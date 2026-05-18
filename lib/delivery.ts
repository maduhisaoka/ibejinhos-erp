export const allowedNeighborhoods = [
  "moema",
  "vila olimpia",
  "itaim bibi",
  "campo belo",
  "indianopolis",
  "vila nova conceicao",
  "brooklin",
  "planalto paulista",
  "saude",
  "paraiso"
];

const neighborhoodDistancesKm: Record<string, number> = {
  moema: 1.2,
  indianopolis: 1.8,
  "vila nova conceicao": 2.6,
  "campo belo": 3.1,
  "vila olimpia": 3.4,
  brooklin: 4.1,
  "planalto paulista": 4.2,
  saude: 4.6,
  "itaim bibi": 4.7,
  paraiso: 5
};

export function normalizeNeighborhood(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isDeliveryAvailable(neighborhood: string) {
  return allowedNeighborhoods.includes(normalizeNeighborhood(neighborhood));
}

function readPublicNumber(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getNeighborhoodDistanceKm(neighborhood: string) {
  return neighborhoodDistancesKm[normalizeNeighborhood(neighborhood)] ?? null;
}

export function calculateDeliveryFee(neighborhood: string, cep?: string) {
  const normalizedCep = cep?.replace(/\D/g, "") ?? "";
  const distanceKm = normalizedCep.length === 8 ? getNeighborhoodDistanceKm(neighborhood) : null;

  if (!distanceKm) {
    return {
      distanceKm: null,
      deliveryFee: 0,
      needsConfirmation: true
    };
  }

  const gasPrice = readPublicNumber("NEXT_PUBLIC_GAS_PRICE_PER_LITER", 6.2);
  const kmPerLiter = readPublicNumber("NEXT_PUBLIC_VEHICLE_KM_PER_LITER", 28);
  const serviceFee = readPublicNumber("NEXT_PUBLIC_DELIVERY_SERVICE_FEE", 6);
  const minimumFee = readPublicNumber("NEXT_PUBLIC_MIN_DELIVERY_FEE", 8);
  const roundTripFuelCost = (distanceKm * 2 * gasPrice) / kmPerLiter;
  const deliveryFee = Math.max(minimumFee, serviceFee + roundTripFuelCost);

  return {
    distanceKm,
    deliveryFee: Number(deliveryFee.toFixed(2)),
    needsConfirmation: false
  };
}
