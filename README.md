# Coletor de alinhamentos via WhatsApp

Bot silencioso que pode coletar mensagens de alinhamento em grupos e preencher somente o histórico da aba `Modelo alinhamento` no Google Sheets.

## Planilha e cadastro

A equipe cadastra previamente a embarcação na coluna A (`Vessel`), a identificação/tag do ativo na coluna B (`Equipment / Tag`) e a classe do equipamento na coluna C (`Equipment Class`). Vessel + Equipment / Tag precisa identificar exatamente uma linha. O bot localiza os campos de histórico pelos títulos da segunda linha e escreve somente esses campos; não altera o cadastro nem tolerâncias.

## Modo de conversa contínua com Gemini

O recurso é opt-in e fica desligado por padrão. Para ativá-lo, configure `GEMINI_CONVERSATION_ENABLED=true` e `GEMINI_API_KEY`; `GEMINI_MODEL=gemini-3.1-flash-lite` é opcional. `ALLOWED_GROUP_JIDS` também é opcional: vazio permite todos os grupos em que o bot participa; uma lista de JIDs separada por vírgulas restringe a coleta a esses grupos.

Cada grupo mantém uma sessão independente. Uma mensagem com a palavra inteira `alinhamento` inicia a coleta naquele grupo. O bot guarda mensagens relacionadas por até 15 minutos de inatividade. Só depois desse gatilho, enquanto a sessão daquele grupo estiver ativa, as mensagens desse grupo são enviadas ao Gemini para classificação, inclusive mensagens paralelas. Conversas de outros grupos não são misturadas. Ao encerrar, o Gemini tenta extrair um único registro. Se detectar troca clara de equipamento, fecha o registro anterior e abre outro. Mensagens paralelas, ambiguidades e falhas de evidência não são gravadas automaticamente.

Com `ALLOWED_GROUP_JIDS` vazio, qualquer grupo em que o bot participe pode iniciar uma coleta ao escrever `alinhamento`; mensagens de grupos sem uma sessão ativa não são enviadas ao Gemini. As sessões ficam em `alignment-sessions.json` com permissão restrita; itens ambíguos ou falhas ficam em `pending-alignment.jsonl`, também protegidos e fora do Git.

O modelo não pode completar valores ausentes ou mudar unidades. Cada valor extraído precisa corresponder literalmente a uma citação de uma mensagem. A gravação só ocorre quando embarcação, equipamento e ao menos um campo de histórico têm evidência literal e o cadastro da planilha encontra uma linha única. A planilha é consultada antes da gravação; alterações simultâneas por outra pessoa ainda podem exigir conferência.

## Modo simples

Com `GEMINI_CONVERSATION_ENABLED` ausente ou diferente de `true`, o modo Gemini não é usado. O código mantém o fluxo simples: tenta registrar uma mensagem individual somente quando ela própria contém `alinhamento` e os campos rotulados. Mensagens pendentes ficam para análise manual. O bot nunca responde no WhatsApp.

## Google Cloud e execução

Use Node.js 18 ou superior, instale as dependências com `npm install` e configure `SPREADSHEET_ID` no ambiente do serviço. A aba deve chamar-se `Modelo alinhamento`, ter duas linhas de cabeçalho e os cadastros a partir da linha 3; o bot consulta até a linha 1000.

Anexe à VM uma conta de serviço com acesso de Editor à planilha e use Application Default Credentials, sem chave privada JSON. A VM precisa do escopo OAuth `https://www.googleapis.com/auth/spreadsheets`; se também precisar das APIs do Cloud, mantenha `https://www.googleapis.com/auth/cloud-platform` junto. Ative a API Google Sheets no projeto.

Inicie `npm start` e vincule o WhatsApp pelo QR Code. A sessão WhatsApp fica em `auth_info_baileys/` e os IDs processados ficam em `processed-message-ids.json`; não compartilhe esses arquivos. `ALLOWED_GROUP_JIDS` pode ficar vazio para permitir todos os grupos da conta conectada ou receber uma lista separada por vírgulas para restringir os grupos, tanto no modo simples quanto no Gemini.

## Dados locais excluídos do Git

`auth_info_baileys/`, `processed-message-ids.json`, `alignment-sessions.json` e `pending-alignment.jsonl` podem conter sessão, mensagens ou outros dados operacionais. Mantenha-os protegidos na VM e fora do repositório. Nunca salve a chave Gemini no GitHub.
