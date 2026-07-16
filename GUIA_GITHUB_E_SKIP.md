# Guia de publicação no GitHub e importação no SKIP

## Publicação recomendada: GitHub Desktop

1. Extraia este ZIP em uma pasta permanente do computador.
2. Instale e abra o GitHub Desktop.
3. Entre na sua conta do GitHub.
4. No GitHub Desktop, use **File > Add Local Repository** e selecione a pasta extraída.
5. Caso o programa informe que a pasta ainda não é um repositório Git, escolha **Create a Repository** nessa pasta.
6. Use como nome: `federal-invest-trustee`.
7. Faça o primeiro commit com a mensagem: `Importação inicial do projeto Federal Invest`.
8. Clique em **Publish repository**.
9. Mantenha marcada a opção **Keep this code private**.
10. Abra o repositório no navegador e confirme que `.env` não aparece na lista de arquivos.

## Importação no SKIP

1. Abra a opção de importar/conectar projeto pelo GitHub.
2. Autorize o acesso do SKIP à conta do GitHub.
3. Se possível, permita acesso somente ao repositório `federal-invest-trustee`.
4. Selecione a branch `main`.
5. Cadastre as variáveis de ambiente no painel de Secrets/Environment Variables do SKIP.
6. Peça ao SKIP para analisar o projeto antes de realizar alterações.

## Variáveis necessárias

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`

Não envie os valores dessas variáveis no chat nem os salve no GitHub.
