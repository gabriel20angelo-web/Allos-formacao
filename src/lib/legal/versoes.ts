// Versões vigentes dos documentos legais.
//
// Vive fora das rotas de propósito: o App Router só admite exports conhecidos
// (GET, POST, dynamic...) em route.ts, então constante compartilhada quebra o
// build se morar lá dentro.
//
// Ao subir a versão dos Termos, mude aqui e em src/app/termos/page.tsx: o
// registro de aceite passa a exigir um novo aceite da versão nova.

export const VERSAO_TERMOS = "1.0";
export const VERSAO_COOKIES = "1.0";
