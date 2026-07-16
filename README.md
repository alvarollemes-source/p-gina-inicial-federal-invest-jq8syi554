# Federal Invest Trustee

Plataforma de gestão operacional e financeira da Federal Invest, desenvolvida em React, TypeScript, TanStack Start e Supabase.

## Principais módulos

- Autenticação, usuários, funções e permissões
- Empresas
- Upload, leitura, validação e histórico de boletos
- Pagamentos e pagamentos manuais
- Documentos financeiros
- Geração e acompanhamento de CNAB
- Retornos bancários e configurações bancárias
- Conversor XLS para OFX
- Separação de comprovantes em PDF
- Relatórios, dashboard e logs

## Configuração

1. Instale as dependências com `bun install`.
2. Copie `.env.example` para `.env` somente no ambiente local.
3. Configure as variáveis no provedor de hospedagem/SKIP. Não publique `.env`.
4. Execute `bun run dev` para desenvolvimento.

## Segurança

- O repositório deve permanecer privado.
- Nunca envie `SUPABASE_SERVICE_ROLE_KEY` ou `LOVABLE_API_KEY` para o GitHub.
- Consulte `AGENTS.md` antes de alterar o histórico Git, pois o projeto possui integração com Lovable.
