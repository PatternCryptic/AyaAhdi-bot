# Coletor de alinhamentos via WhatsApp

Bot silencioso para registrar no Google Sheets somente mensagens de grupos que contenham a palavra **alinhamento**. Esta V1 guarda a mensagem encontrada, sem responder e sem associar mensagens enviadas depois.

## O que é registrado

A aba configurada recebe uma linha por mensagem, com as colunas A:H:

1. Data/hora da mensagem (UTC)
2. Nome do grupo
3. Identificador do grupo
4. Nome exibido do remetente
5. Identificador do remetente
6. Medidas escritas explicitamente com unidade (por exemplo, `6 mm`)
7. Mensagem original completa
8. Identificador da mensagem (deduplicação)

O bot não tenta inferir equipamento, lado, posição ou resultado. Esses detalhes continuam preservados no texto original para análise manual. Uma mensagem sem medida explícita deixa essa coluna vazia. A palavra é reconhecida sem diferenciar maiúsculas/minúsculas.

## Configuração

Requisitos: Node.js 18 ou superior, um projeto Google Cloud com Google Sheets API ativada, uma conta de serviço e a planilha compartilhada com o e-mail dessa conta.

1. Instale as dependências: `npm install`.
2. Copie `.env.example` para `.env` e configure `SPREADSHEET_ID` e `SHEETS_RANGE`.
3. Baixe a chave JSON da sua própria conta de serviço e coloque-a localmente como `credentials.json` (ou configure outro caminho em `GOOGLE_APPLICATION_CREDENTIALS`). Esse arquivo é ignorado pelo Git. Nunca o envie ao repositório nem cole em mensagens.
4. Na planilha, prepare a aba configurada com estes cabeçalhos na primeira linha: `Data/hora | Grupo | ID do grupo | Remetente | ID do remetente | Medidas | Mensagem original | ID da mensagem`.
5. Opcionalmente, preencha `ALLOWED_GROUP_JIDS` com o identificador do grupo permitido. Se vazio, qualquer grupo em que a conta conectada esteja e que contenha a palavra será considerado.
6. Inicie com `npm start` e escaneie o QR Code com o WhatsApp que participa do grupo.

## Comportamento e limites da V1

- Processa somente mensagens novas recebidas de grupos, com a palavra inteira `alinhamento`.
- Não lê mensagens seguintes como continuação, não responde nem envia comandos.
- Ignora mensagens antigas sincronizadas e mensagens enviadas pela própria conta.
- Guarda os IDs recentes processados em `processed-message-ids.json`, arquivo local ignorado pelo Git.
- A sessão WhatsApp fica em `auth_info_baileys/`, também ignorada pelo Git.
- Para evitar duplicidade quando o processo reiniciar, o arquivo local de IDs deve ser mantido junto da hospedagem.

## Segurança

Chaves de serviço e sessão do WhatsApp são segredos. Use somente credenciais da sua própria conta de serviço. Se uma chave antiga de terceiros foi publicada no repositório, removê-la do branch atual não invalida cópias nem o histórico do Git; o proprietário dessa chave precisa revogá-la no Google Cloud.
