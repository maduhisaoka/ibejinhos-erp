import { onlyDigits } from "@/lib/format";

export type CepAddress = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

export async function validateCep(cep: string): Promise<CepAddress | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.erro) return null;

    return {
      cep: data.cep ?? cep,
      street: data.logradouro ?? "",
      neighborhood: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? ""
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
