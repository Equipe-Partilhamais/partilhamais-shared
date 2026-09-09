// Infraestrutura dos VETORES DOURADOS (golden) do motor de cálculo.
//
// Um vetor dourado é o resultado CONGELADO de uma combinação de entradas. O teste refaz a
// mesma combinação e compara com o que está gravado: se um número mudou, alguém mudou o
// imposto de um caso que já foi entregue a cliente — intencionalmente ou não.
//
// FORMATO: JSONL (um vetor por linha), e não um JSON indentado. Numa matriz de milhares de
// casos é o formato que faz o `git diff` mostrar exatamente QUAIS combinações mudaram: uma
// linha alterada = um vetor alterado. Com JSON indentado o mesmo diff viraria centenas de
// linhas de chaves e vírgulas.
//
// Este módulo não importa `vitest`: o gerador (scripts/) usa as mesmas funções de comparação
// para conferir o arquivo que acabou de escrever.

import { formatCurrency } from '../utils/formatters';

export type ValorGolden =
    | string
    | number
    | boolean
    | null
    | ValorGolden[]
    | { [campo: string]: ValorGolden };

export interface VetorGolden {
    /** Chave estável e legível da combinação. É por ela que os vetores são pareados. */
    id: string;
    [campo: string]: ValorGolden;
}

/** Linha de cabeçalho do arquivo (comentário para humanos, ignorada na leitura). */
const PREFIXO_COMENTARIO = '#';

export const serializarVetores = (vetores: VetorGolden[], cabecalho: string[] = []): string => {
    const linhas = cabecalho.map(linha => `${PREFIXO_COMENTARIO} ${linha}`);
    vetores.forEach(vetor => linhas.push(JSON.stringify(vetor)));
    return `${linhas.join('\n')}\n`;
};

export const desserializarVetores = (conteudo: string): VetorGolden[] =>
    conteudo
        .split('\n')
        .map(linha => linha.trim())
        .filter(linha => linha !== '' && !linha.startsWith(PREFIXO_COMENTARIO))
        .map((linha, indice) => {
            try {
                return JSON.parse(linha) as VetorGolden;
            } catch (erro) {
                throw new Error(
                    `Vetor dourado inválido na linha ${indice + 1} do arquivo: ${(erro as Error).message}`
                );
            }
        });

export interface DivergenciaGolden {
    id: string;
    /** Caminho do campo dentro do vetor, ex.: `memoria[1].tax`. */
    campo: string;
    esperado: ValorGolden;
    obtido: ValorGolden;
}

const ehObjeto = (valor: ValorGolden): valor is { [campo: string]: ValorGolden } =>
    typeof valor === 'object' && valor !== null && !Array.isArray(valor);

const compararValor = (
    id: string,
    campo: string,
    esperado: ValorGolden,
    obtido: ValorGolden,
    saida: DivergenciaGolden[]
): void => {
    if (Array.isArray(esperado) || Array.isArray(obtido)) {
        const a = Array.isArray(esperado) ? esperado : [];
        const b = Array.isArray(obtido) ? obtido : [];
        if (!Array.isArray(esperado) || !Array.isArray(obtido) || a.length !== b.length) {
            saida.push({ id, campo: `${campo}.length`, esperado: a.length, obtido: b.length });
            return;
        }
        a.forEach((item, i) => compararValor(id, `${campo}[${i}]`, item, b[i], saida));
        return;
    }

    if (ehObjeto(esperado) || ehObjeto(obtido)) {
        if (!ehObjeto(esperado) || !ehObjeto(obtido)) {
            saida.push({ id, campo, esperado, obtido });
            return;
        }
        const chaves = Array.from(new Set([...Object.keys(esperado), ...Object.keys(obtido)]));
        chaves.forEach(chave =>
            compararValor(
                id,
                campo ? `${campo}.${chave}` : chave,
                esperado[chave] === undefined ? null : esperado[chave],
                obtido[chave] === undefined ? null : obtido[chave],
                saida
            )
        );
        return;
    }

    // Igualdade ESTRITA, nunca aproximada: o vetor existe para acusar 1 centavo de diferença,
    // e um `toBeCloseTo` deixaria passar exatamente o que ele deveria pegar.
    if (esperado !== obtido) saida.push({ id, campo, esperado, obtido });
};

/** Campos monetários — a mensagem de falha mostra o valor em reais além do número cru. */
const CAMPOS_EM_REAIS = new Set([
    'imposto',
    'impostoOriginal',
    'valorDesconto',
    'base',
    'tax',
    'valor',
    'monte',
    'quinhao',
    'acervoLiquido',
]);

const nomeDoCampo = (campo: string): string => {
    const ultimo = campo.split('.').pop() || campo;
    return ultimo.replace(/\[\d+\]$/, '');
};

const descreverValor = (campo: string, valor: ValorGolden): string => {
    if (typeof valor === 'number' && CAMPOS_EM_REAIS.has(nomeDoCampo(campo))) {
        return `${formatCurrency(valor)} (${valor})`;
    }
    return JSON.stringify(valor);
};

export const descreverDivergencia = (divergencia: DivergenciaGolden, rotulo: string): string => {
    const { campo, esperado, obtido } = divergencia;
    const linhas = [
        rotulo,
        `      campo     ${campo}`,
        `      congelado ${descreverValor(campo, esperado)}`,
        `      obtido    ${descreverValor(campo, obtido)}`,
    ];
    if (typeof esperado === 'number' && typeof obtido === 'number') {
        const delta = obtido - esperado;
        const emReais = CAMPOS_EM_REAIS.has(nomeDoCampo(campo)) ? ` = ${formatCurrency(delta)}` : '';
        linhas.push(`      diferença ${delta > 0 ? '+' : ''}${delta}${emReais}`);
    }
    return linhas.join('\n');
};

export interface RelatorioGolden {
    divergencias: DivergenciaGolden[];
    /** Combinações que existem no arquivo e a matriz não gera mais. */
    ausentes: string[];
    /** Combinações novas da matriz, sem vetor congelado. */
    novas: string[];
}

export const compararComGolden = (
    congelados: VetorGolden[],
    obtidos: VetorGolden[]
): RelatorioGolden => {
    const porId = new Map(congelados.map(vetor => [vetor.id, vetor]));
    const idsObtidos = new Set(obtidos.map(vetor => vetor.id));

    const divergencias: DivergenciaGolden[] = [];
    const novas: string[] = [];

    obtidos.forEach(obtido => {
        const congelado = porId.get(obtido.id);
        if (!congelado) {
            novas.push(obtido.id);
            return;
        }
        compararValor(obtido.id, '', congelado, obtido, divergencias);
    });

    const ausentes = congelados.map(v => v.id).filter(id => !idsObtidos.has(id));

    return { divergencias, ausentes, novas };
};

/** Quantas divergências a mensagem detalha antes de resumir o resto. */
const MAX_DETALHADAS = 15;
const MAX_LISTADAS = 10;

/**
 * Mensagem de falha do golden. Diz QUAL combinação mudou e DE QUANTO PARA QUANTO — numa
 * matriz de milhares de casos, "esperado != recebido" não permite agir.
 *
 * Devolve `null` quando está tudo igual.
 */
export const relatarGolden = (
    nome: string,
    relatorio: RelatorioGolden,
    total: number,
    descrever: (id: string) => string,
    comoRegerar: string
): string | null => {
    const { divergencias, ausentes, novas } = relatorio;
    if (divergencias.length === 0 && ausentes.length === 0 && novas.length === 0) return null;

    const partes: string[] = [];

    if (divergencias.length > 0) {
        const ids = Array.from(new Set(divergencias.map(d => d.id)));
        partes.push(
            `${nome}: ${ids.length} de ${total} vetor(es) mudaram de valor ` +
                `(${divergencias.length} campo(s) divergente(s)).`
        );
        divergencias
            .slice(0, MAX_DETALHADAS)
            .forEach(d => partes.push(descreverDivergencia(d, `  » ${descrever(d.id)}`)));
        if (divergencias.length > MAX_DETALHADAS) {
            partes.push(`  ... e mais ${divergencias.length - MAX_DETALHADAS} campo(s) divergente(s).`);
        }
    }

    if (novas.length > 0) {
        partes.push(
            `${nome}: ${novas.length} combinação(ões) da matriz não têm vetor congelado ` +
                `(a matriz cresceu — regerar é o esperado).`
        );
        novas.slice(0, MAX_LISTADAS).forEach(id => partes.push(`  + ${descrever(id)}`));
        if (novas.length > MAX_LISTADAS) partes.push(`  ... e mais ${novas.length - MAX_LISTADAS}.`);
    }

    if (ausentes.length > 0) {
        partes.push(
            `${nome}: ${ausentes.length} vetor(es) congelado(s) não são mais gerados pela matriz ` +
                `(a matriz encolheu — confirme que a perda de cobertura é intencional).`
        );
        ausentes.slice(0, MAX_LISTADAS).forEach(id => partes.push(`  - ${descrever(id)}`));
        if (ausentes.length > MAX_LISTADAS) partes.push(`  ... e mais ${ausentes.length - MAX_LISTADAS}.`);
    }

    partes.push('');
    partes.push(
        `Se a mudança de comportamento for INTENCIONAL, regere os vetores com \`${comoRegerar}\` ` +
            'e revise o diff do arquivo de vetores — é lá que a mudança fica visível, vetor a vetor.'
    );

    return partes.join('\n');
};

/**
 * Meio centavo. Abaixo disso a diferença é ruído de ponto flutuante da ordem de 1e-9
 * (soma de parcelas convertidas por unidade fiscal, por exemplo); acima disso o dinheiro
 * realmente não fecha.
 */
export const TOLERANCIA_INVARIANTE = 0.005;

export const fechaCom = (a: number, b: number): boolean => Math.abs(a - b) <= TOLERANCIA_INVARIANTE;

export const descreverDiferenca = (esperado: number, obtido: number): string =>
    `${formatCurrency(obtido)} contra ${formatCurrency(esperado)} (diferença ${formatCurrency(obtido - esperado)})`;
