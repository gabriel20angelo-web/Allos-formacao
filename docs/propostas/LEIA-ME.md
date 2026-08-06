# Propostas não aplicadas

O que está nesta pasta **não rodou em lugar nenhum** e não está numerado como
migration de propósito: arquivo com número de migration dentro de
`supabase/migrations/` é um convite para alguém rodar sem ler.

## `proposta-painel-pessoas-em-sql.sql`

Faz em SQL o que `src/lib/pessoas/agregar.ts` faz em TypeScript: views
(`pessoa_presencas`, `pessoas_ficha`) e funções (`pessoas_nucleo`,
`pessoas_nucleo_serie`, `pessoas_sumidas`, `pessoas_coorte_estreia`,
`condutores_desempenho`, `pessoas_painel`) que devolvem o painel inteiro num
`jsonb`.

A tela de hoje não usa nada disso, e o motivo de não ter usado é simples: a
versão em TypeScript já estava escrita, paginada e testada quando esta chegou,
e duas implementações da mesma conta é a receita conhecida para elas divergirem.

Vale ler se um dia a agregação ficar lenta. A ideia central é boa e é a que
resolve o teto de mil linhas de forma definitiva: **função que devolve `jsonb`
devolve UMA linha, e a lista inteira viaja dentro dela**, então o corte
silencioso do PostgREST deixa de existir em vez de precisar ser lembrado.

## `proposta-importacao-seletivo.sql`

Tabelas para importar o processo seletivo: `seletivo_importacoes` (guarda o CSV
cru, para reprocessar sem pedir de novo), `seletivo_candidaturas`,
`seletivo_tentativas` (uma linha por tentativa, que é o que permite contar
quantas vezes a pessoa tentou) e `seletivo_decisoes` (o rastro do que foi
decidido à mão, com o antes, para poder desfazer).

Está esperando o CSV novo. O de 06/08/2026 não tinha e-mail nem telefone, e
sem pelo menos um dos dois o casamento seria por nome, que é justamente o que
a 089 existe para impedir. 32% dos nomes daquele arquivo têm duas palavras.

Quando o arquivo novo chegar: conferir se as colunas do CSV batem com o que o
importador espera, renumerar para a migration seguinte e aplicar.
