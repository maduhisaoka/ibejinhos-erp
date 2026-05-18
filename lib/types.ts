export type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  active: boolean;
  flavorLimit: number;
  flavors: string[];
};

export type CartItem = Product & {
  quantity: number;
  selectedFlavors: Record<string, number>;
};

export type Customer = {
  name: string;
  cpf: string;
  password: string;
  email: string;
  whatsapp: string;
  birthdayDay: string;
  birthdayMonth: string;
  registrationStreet: string;
  registrationNumber: string;
  registrationComplement: string;
  registrationNeighborhood: string;
  registrationCep: string;
  deliverySameAsRegistration: boolean;
  recipientName: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  cep: string;
};

export type PaymentMethod = "Pix" | "Credito";

export type OrderStatus = "preparando" | "finalizado";

export type Order = {
  id: number;
  orderNumber: string;
  customerName: string;
  cpf: string;
  whatsapp: string;
  email: string;
  birthdayDay: number | null;
  birthdayMonth: number | null;
  registrationStreet: string;
  registrationNumber: string;
  registrationComplement: string;
  registrationNeighborhood: string;
  registrationCep: string;
  deliverySameAsRegistration: boolean;
  recipientName: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  cep: string;
  items: CartItem[];
  subtotal: number;
  deliveryDistanceKm: number | null;
  deliveryFee: number;
  discount: number;
  loyaltyOrderCount: number;
  total: number;
  paymentMethod: PaymentMethod;
  receiptPath: string | null;
  status: OrderStatus;
  delivered: boolean;
  createdAt: string;
};

export type LoyaltySummary = {
  previousOrders: number;
  currentOrderCount: number;
  cycleOrderCount: number;
  nextCycleOrderCount: number;
  qualifiesForDiscount: boolean;
  ordersUntilDiscount: number;
  discountRate: number;
  rewardLabel: string;
  rewardDescription: string;
};

export type StoreSettings = {
  minimumOrderValue: number;
};

export type RegisteredCustomer = {
  id: number;
  name: string;
  cpf: string;
  whatsapp: string;
  email: string;
  birthdayDay: number | null;
  birthdayMonth: number | null;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  cep: string;
  createdAt: string;
};
