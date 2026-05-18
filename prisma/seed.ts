import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, minimumOrderValue: 0 }
  });

  await prisma.loyaltyRules.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      pointsPerReal: 1,
      cashbackPercent: 3,
      vipThresholdPoints: 1200,
      inactiveDays: 45
    }
  });

  const products = [
    {
      name: "Brigadeiro tradicional",
      description: "Brigadeiro cremoso artesanal, feito com chocolate e finalizado com granulado.",
      price: 4.5,
      image: "/products/brigadeiro-tradicional.svg",
      active: true,
      flavorLimit: 0,
      flavors: []
    },
    {
      name: "Caixa com 9 brigadeiros",
      description: "Caixa presenteavel com 9 brigadeiros sortidos.",
      price: 42,
      image: "/products/caixa-9.svg",
      active: true,
      flavorLimit: 9,
      flavors: ["Tradicional", "Gourmet", "Ninho", "Beijinho", "Churros", "Meio amargo"]
    },
    {
      name: "Bolo gelado",
      description: "Fatia gelada, cremosa e embalada individualmente.",
      price: 16,
      image: "/products/bolo-gelado.svg",
      active: true,
      flavorLimit: 0,
      flavors: []
    }
  ];

  for (const product of products) {
    const existing = await prisma.product.findFirst({ where: { name: product.name } });
    if (!existing) {
      await prisma.product.create({ data: product });
    }
  }

  const adminUser = await prisma.appUser.findUnique({ where: { email: "admin@ibejinhos.com" } });
  if (!adminUser) {
    await prisma.appUser.create({
      data: {
        name: "Ibejinhos",
        email: "admin@ibejinhos.com",
        role: "admin",
        active: true
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
