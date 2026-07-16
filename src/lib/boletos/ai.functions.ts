import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "../ai-gateway.server";

const SYSTEM_PROMPT = `Você é um assistente especialista em documentos financeiros brasileiros.
Sua tarefa é extrair dados de um boleto, conta de concessionária ou guia de arrecadação a partir de UMA imagem.

REGRAS OBRIGATÓRIAS:
- Extraia SOMENTE o que estiver visível na imagem.
- Se um campo não estiver visível ou legível, retorne null. NUNCA invente, deduza ou complete valores parciais (CPF/CNPJ ocultos, endereços cortados, etc).
- Não confunda beneficiário (quem recebe) com pagador (quem paga).
- BENEFICIÁRIO (quem recebe): extraia SEMPRE dos campos da estrutura bancária do boleto, nesta ordem de prioridade: (1) "Beneficiário", (2) "Cedente", (3) "Beneficiário/Cedente", (4) "Nome do beneficiário", (5) "Razão social do beneficiário". Em boletos Sicoob o rótulo costuma ser "Cedente" — use o valor logo à frente ou na linha seguinte a esse rótulo.
- NUNCA use o texto do topo/cabeçalho do documento (nome fantasia, logotipo, identificação comercial impressa fora da tabela bancária) como beneficiário. Se existir esse texto no topo e ele for DIFERENTE do campo Beneficiário/Cedente, coloque-o em "cabecalho_documento" e mantenha o beneficiário correto do campo bancário.
- Se houver conflito entre cabeçalho superior e o campo Cedente/Beneficiário, o campo bancário SEMPRE vence.
- Não confunda código de barras (numérico, 44 dígitos) com linha digitável (47 ou 48 dígitos, geralmente formatada).
- Boletos BANCÁRIOS têm linha digitável de 47 dígitos e código de barras de 44 dígitos.
- Guias de ARRECADAÇÃO (concessionárias, tributos, FGTS, DAE, DARF, etc) têm linha digitável de 48 dígitos começando com 8 e código de barras de 44 dígitos começando com 8.
- GPS (Guia da Previdência Social - INSS): NÃO possui código de barras nem linha digitável. Identifique quando o documento tiver título "GUIA DA PREVIDÊNCIA SOCIAL" ou "GPS" e preencha o objeto "gps" com: código de pagamento (geralmente 4 dígitos, ex: 2100), competência (MM/AAAA), identificador (CNPJ/CEI/NIT do contribuinte), valor do INSS, valor de outras entidades, ATM/Multa e Juros, e total (valor a pagar). Nesses casos defina "tipo_documento": "gps".
- Se houver mais de uma sequência numérica longa na página, escolha a que aparece IMEDIATAMENTE abaixo/acima do código de barras impresso (rótulos: "linha digitável", "representação numérica", "código para pagamento").
- Copie os números EXATAMENTE como aparecem — inclusive linha digitável com pontuação original. NUNCA "corrija" DVs.
- Datas em formato ISO YYYY-MM-DD; valores como números decimais (ex: 60.00).
- Para cada campo relevante, atribua um score de confiança de 0 a 1.
- Se o documento não parece um boleto/guia, retorne { "nao_reconhecido": true }.

Retorne APENAS um objeto JSON válido. Sem markdown, sem comentários.`;

const InputSchema = z.object({
  imageBase64: z.string().min(100),
  mime: z.string().min(3),
  textoOcrDisponivel: z.string().optional().nullable(),
});

export const extractBoletoData = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      throw new Error("LOVABLE_API_KEY ausente no servidor.");
    }
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const userText =
      "Extraia todos os campos deste documento (boleto/guia). Retorne JSON com esta estrutura (use null para o que faltar):\n" +
      `{
  "nao_reconhecido": false,
  "tipo_documento": "boleto_bancario|conta_energia|conta_agua|conta_telefone|arrecadacao|outro|null",
  "banco": { "codigo": "3 dígitos ou null", "nome": "string ou null" },
  "linha_digitavel": "string exata como aparece, ou null",
  "codigo_barras": "44 dígitos se visível abaixo do código de barras impresso, ou null",
  "beneficiario": { "nome": null, "documento": null, "tipo_documento": "CPF|CNPJ|null", "endereco": null },
  "cabecalho_documento": "texto do topo do documento quando diferente do beneficiário do campo bancário, ou null",
  "pagador": { "nome": null, "documento": null, "tipo_documento": "CPF|CNPJ|null", "endereco": null, "cidade": null, "estado": null, "cep": null },
  "vencimento": "YYYY-MM-DD ou null",
  "valor_documento": "número ou null",
  "valor_cobrado": "número ou null",
  "data_documento": "YYYY-MM-DD ou null",
  "data_processamento": "YYYY-MM-DD ou null",
  "numero_documento": null,
  "nosso_numero": null,
  "agencia_codigo_beneficiario": null,
  "carteira": null,
  "especie": null,
  "aceite": null,
  "instrucoes": ["string", ...],
  "juros": null,
  "multa": null,
  "desconto": null,
  "outras_deducoes": null,
  "outros_acrescimos": null,
  "referencia": null,
  "numero_instalacao": null,
  "nota_fiscal": null,
  "chave_nota_fiscal": null,
  "informacoes_adicionais": null,
  "gps": { "codigo_pagamento": null, "competencia": "MM/AAAA ou null", "identificador": null, "valor_inss": null, "valor_outras_entidades": null, "atm_multa_juros": null, "valor_total": null },
  "confianca": { "geral": 0.0, "codigo_barras": 0.0, "linha_digitavel": 0.0, "valor": 0.0, "vencimento": 0.0 }
}` +
      (data.textoOcrDisponivel
        ? `\n\nTexto extraído automaticamente do documento (referência, pode conter erros): """${data.textoOcrDisponivel.slice(0, 8000)}"""`
        : "");

    try {
      const result = await generateText({
        model,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              {
                type: "image",
                image: `data:${data.mime};base64,${data.imageBase64}`,
              },
            ],
          },
        ],
      });

      const text = result.text.trim();
      // Extrai JSON (o modelo às vezes envolve em ```json)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { ok: false as const, error: "Resposta da IA não contém JSON." };
      }
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return { ok: true as const, data: parsed };
      } catch (e) {
        return { ok: false as const, error: "JSON inválido da IA.", raw: text };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Códigos de rate limit / créditos
      if (msg.includes("429")) return { ok: false as const, error: "Muitas requisições. Tente novamente em alguns instantes." };
      if (msg.includes("402")) return { ok: false as const, error: "Créditos de IA esgotados. Adicione créditos ao workspace." };
      return { ok: false as const, error: msg };
    }
  });