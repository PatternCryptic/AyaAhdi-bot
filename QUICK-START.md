# Início rápido — Bot de alinhamentos

Este serviço usa uma VM do Compute Engine e autenticação ADC. Não armazene chave de conta de serviço no repositório.

## Planilhas

- Registros (`SPREADSHEET_ID`): `1oc2u-thAhflrqEb3m6hxux8Yg6jEE6wGY-zFQyBRR38`, aba `Modelo alinhamento`.
- Configuração (`CONFIG_SPREADSHEET_ID`): `1E27LdQunE0QVAAT7pnEo0GOvORov090ioIshE3jLCuY`, abas `Taxonomia`, `Glossario`, `Configurações` e `masterlist`.

A conta `bot-whatsapp-sheets` precisa ser leitora da configuração e editora dos registros. Mantenha os arquivos separados porque as permissões são por arquivo.

## Ambiente

Configure `SPREADSHEET_ID`, `CONFIG_SPREADSHEET_ID`, `GEMINI_CONVERSATION_ENABLED=true` e `GEMINI_API_KEY` por variáveis de ambiente/segredos do serviço. Opcionalmente escolha `GEMINI_MODEL`; o padrão é `gemini-3.1-flash-lite`. A VM deve usar a conta de serviço anexada por ADC.

Instale dependências com `npm install`, valide com `npm test` e inicie com `npm start`. Quando ativo, o bot acompanha sessões separadas em todos os grupos de que participa, pergunta em uma única mensagem os campos que faltam, atualiza a pergunta após respostas e fecha a sessão após 15 minutos sem resposta relacionada.

Antes de ativar uma nova versão, confira os cabeçalhos da aba `Modelo alinhamento`. O bot acrescenta linhas; a chave de sessão fica em `Comments` para evitar duplicatas. O conteúdo de `Comments` também preserva observações que não tenham coluna própria.

Mantenha `auth_info_baileys/`, `alignment-sessions.json`, `pending-alignment.jsonl` e `processed-message-ids.json` privados e fora do Git.

