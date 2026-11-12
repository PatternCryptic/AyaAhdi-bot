# Coletor de alinhamentos via WhatsApp

Bot silencioso que pode coletar mensagens de alinhamento em grupos e preencher somente o histórico da aba `Modelo alinhamento` no Google Sheets.

## Planilha e cadastro

A equipe cadastra previamente a embarcação na coluna A (`Vessel`) e o equipamento na coluna B (`Equipment Class`). A combinação precisa identificar exatamente uma linha. O bot escreve apenas os campos de histórico nas colunas E:M; não altera o cadastro nem tolerâncias.

## Modo de conversa contínua com Gemini

O recurso é opt-in e fica desligado por padrão. Para ativá-lo, configure `GEMINI_CONVERSATION_ENABLED=true`, `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.1-flash-lite` e uma lista explícita de grupos em `ALLOWED_GROUP_JIDS`. O processo recusa iniciar o modo Gemini se a chave ou a lista de grupos estiver ausente.

Uma mensagem com a palavra inteira `alinhamento` inicia uma sessão naquele grupo. O bot guarda mensagens relacionadas por até 15 minutos de inatividade. O Gemini classifica as mensagens recebidas no grupo enquanto a sessão está ativa e, ao encerrar, tenta extrair um único registro. Se detectar troca clara de equipamento, fecha o registro anterior e abre outro. Mensagens paralelas, ambiguidades e falhas de evidência não são gravadas automaticamente.

Ao habilitar o modo, o texto das mensagens do grupo permitido durante a sessão é enviado ao Gemini para classificação, inclusive mensagens que depois sejam consideradas paralelas. Faça os primeiros testes somente com mensagens fictícias e não habilite em grupos corporativos até que o uso desse serviço esteja aprovado pela empresa. As sessões ficam em `alignment-sessions.json` com permissão restrita; itens ambíguos ou falhas ficam em `pending-alignment.jsonl`, também protegidos e fora do Git.

O modelo não pode completar valores ausentes ou mudar unidades. Cada valor extraído precisa corresponder literalmente a uma citação de uma mensagem. A gravação só ocorre quando embarcação, equipamento e ao menos um campo de histórico têm evidência literal e o cadastro da planilha encontra uma linha única. A planilha é consultada antes da gravação; alterações simultâneas por outra pessoa ainda podem exigir conferência.

## Modo simples

Com `GEMINI_CONVERSATION_ENABLED` ausente ou diferente de `true`, o modo Gemini não é usado. O código mantém o fluxo simples: tenta registrar uma mensagem individual somente quando ela própria contém `alinhamento` e os campos rotulados. Mensagens pendentes ficam para análise manual. O bot nunca responde no WhatsApp.

## Google Cloud e execução

Use Node.js 18 ou superior, instale as dependências com `npm install` e configure `SPREADSHEET_ID` no ambiente do serviço. A aba deve chamar-se `Modelo alinhamento`, ter duas linhas de cabeçalho e os cadastros a partir da linha 3; o bot consulta até a linha 1000.

Anexe à VM uma conta de serviço com acesso de Editor à planilha e use Application Default Credentials, sem chave privada JSON. A VM precisa do escopo OAuth `https://www.googleapis.com/auth/spreadsheets`; se também precisar das APIs do Cloud, mantenha `https://www.googleapis.com/auth/cloud-platform` junto. Ative a API Google Sheets no projeto.

Inicie `npm start` e vincule o WhatsApp pelo QR Code. A sessão WhatsApp fica em `auth_info_baileys/` e os IDs processados ficam em `processed-message-ids.json`; não compartilhe esses arquivos. `ALLOWED_GROUP_JIDS` é opcional no modo simples e, quando vazio, permite todos os grupos da conta conectada. No modo Gemini, a lista é obrigatória e deve conter somente o grupo de teste autorizado.

## Dados locais excluídos do Git

`auth_info_baileys/`, `processed-message-ids.json`, `alignment-sessions.json` e `pending-alignment.jsonl` podem conter sessão, mensagens ou outros dados operacionais. Mantenha-os protegidos na VM e fora do repositório. Nunca salve a chave Gemini no GitHub.
