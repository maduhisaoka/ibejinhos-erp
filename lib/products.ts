import type { Product } from "@/lib/types";

export const seedProducts: Omit<Product, "id">[] = [
  {
    name: "Brigadeiro tradicional",
    description: "O clássico cremoso, enrolado no granulado e feito com chocolate de verdade.",
    price: 4.5,
    image: "/products/brigadeiro-tradicional.svg",
    active: true,
    flavorLimit: 0,
    flavors: []
  },
  {
    name: "Brigadeiro gourmet",
    description: "Massa macia com chocolate nobre e finalização delicada para presentear ou se mimar.",
    price: 6.5,
    image: "/products/brigadeiro-gourmet.svg",
    active: true,
    flavorLimit: 0,
    flavors: []
  },
  {
    name: "Caixinha com 4 brigadeiros",
    description: "Seleção artesanal com quatro sabores queridinhos da Ibejinhos.",
    price: 24,
    image: "/products/caixa-4.svg",
    active: true,
    flavorLimit: 4,
    flavors: ["Tradicional", "Gourmet", "Ninho", "Beijinho", "Churros", "Meio amargo"]
  },
  {
    name: "Caixinha com 9 brigadeiros",
    description: "Uma caixa charmosa para dividir carinho, comemorar ou adoçar a tarde.",
    price: 48,
    image: "/products/caixa-9.svg",
    active: true,
    flavorLimit: 9,
    flavors: ["Tradicional", "Gourmet", "Ninho", "Beijinho", "Churros", "Meio amargo"]
  },
  {
    name: "Bolo gelado",
    description: "Fatia úmida, embrulhada com afeto, perfeita para aquele docinho depois do almoço.",
    price: 14,
    image: "/products/bolo-gelado.svg",
    active: true,
    flavorLimit: 0,
    flavors: []
  },
  {
    name: "Bolo de brigadeiro",
    description: "Bolo fofinho com recheio generoso de brigadeiro e cobertura cremosa.",
    price: 86,
    image: "/products/bolo-brigadeiro.svg",
    active: true,
    flavorLimit: 0,
    flavors: []
  },
  {
    name: "Kit presenteável",
    description: "Combinação especial de doces gourmet em embalagem delicada para surpreender.",
    price: 72,
    image: "/products/kit-presente.svg",
    active: true,
    flavorLimit: 6,
    flavors: ["Tradicional", "Gourmet", "Ninho", "Beijinho", "Churros", "Meio amargo", "Bolo gelado"]
  }
];
