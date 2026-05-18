import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartContext";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Ibejinhos Delivery",
  description: "Docinhos artesanais em Moema e arredores."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <CartProvider>
          <Header />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
