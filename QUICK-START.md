# Início rápido — Coletor de alinhamentos

## 1. Requisitos

- Node.js 18 ou superior.
- Google Sheets API ativada no projeto Google Cloud.
- Uma conta de serviço criada no seu projeto e compartilhada na planilha com permissão de Editor.

## 2. Preparar o projeto

```bash
npm install
cp .env.example .env
```

No Windows, copie `.env.example` para `.env` pelo Explorador de Arquivos ou PowerShell.

Edite `.env`:

```env
SPREADSHEET_ID=ID_DA_SUA_PLANILHA
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
SHEETS_RANGE=Página1!A:H
ALLOWED_GROUP_JIDS=
```

Coloque localmente o JSON da chave da sua própria conta de serviço no caminho configurado. O arquivo `credentials.json` é ignorado pelo Git; não o publique.

Na aba `Página1`, use estes cabeçalhos na primeira linha:

`Data/hora | Grupo | ID do grupo | Remetente | ID do remetente | Medidas | Mensagem original | ID da mensagem`

## 3. Conectar o WhatsApp

```bash
npm start
```

Escaneie o QR Code com a conta de WhatsApp que participa do grupo. O processo fica em escuta sem enviar respostas.

## 4. Filtro opcional por grupo

Se `ALLOWED_GROUP_JIDS` ficar vazio, o bot registra mensagens que contenham a palavra inteira `alinhamento` em qualquer grupo em que a conta conectada esteja.

Para limitar a um grupo, informe seu JID em `ALLOWED_GROUP_JIDS`. As mensagens seguintes só entram se elas mesmas também contiverem “alinhamento”. O bot não associa mensagens de acompanhamento.

## Observações

- O campo de medidas registra valores explícitos com unidade, como `6 mm`; outros dados permanecem preservados na mensagem original.
- A sessão WhatsApp é guardada em `auth_info_baileys/`; mantenha essa pasta junto da hospedagem para evitar novo pareamento.
- Não use credenciais antigas encontradas no repositório. A exclusão do arquivo no branch atual não revoga a chave nem remove cópias do histórico Git; o proprietário deve revogá-la no Google Cloud.
