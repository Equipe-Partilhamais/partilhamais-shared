import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    // Os testes dourados percorrem a matriz inteira de ITCD (4.896 combinações) várias vezes.
    // Com os arquivos rodando em paralelo, o prazo padrão de 5 s estourava numa estação comum
    // sem nenhuma falha de asserção — o teste passava sozinho em 1,6 s. Prazo de lentidão não
    // é resultado de cálculo; um teste que trava de verdade continua reprovando em 60 s.
    testTimeout: 60_000,
  },
});
