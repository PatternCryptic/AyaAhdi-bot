# Coletor de alinhamentos via WhatsApp

Bot silencioso que processa mensagens de grupos contendo a palavra inteira **alinhamento** e preenche o histórico na aba `Modelo alinhamento` do Google Sheets.

## Cadastro e mensagem

A equipe cadastra previamente a embarcação na coluna A (Vessel) e o equipamento na coluna B (Equipment Class). A combinação deve identificar uma única linha. O bot só escreve valores explicitamente informados nas colunas E:M e não altera os dados do cadastro nem tolerâncias.

Exemplo de mensagem:

```text
ALINHAMENTO
Embarcação: BRAM BAHIA
Equipamento: Main Propulsion Elect. Motor No.1
Data: 11/11/2026
Motivação: manutenção
Executor: equipe de manutenção
Método: laser
Axial vertical: -0,03 mm
Axial horizontal: 0,02 mm
Radial vertical: 0,13 mm
Radial horizontal: 0,00 mm
Coupling GAP: 189,46 mm
```

Use apenas os campos conhecidos. Cada campo deve começar em uma linha e ter um rótulo seguido de dois pontos. Embarcação e equipamento devem corresponder ao cadastro; a comparação ignora diferenças de maiúsculas, acentos e espaços repetidos. O bot não interpreta texto livre, não infere dados e não avalia tolerâncias.

Se não houver uma única linha correspondente, se algum campo solicitado já estiver preenchido ou se a API falhar, a mensagem fica em `pending-alignment.jsonl` na VM, para análise manual. Pendências não são reprocessadas automaticamente. O bot não responde no WhatsApp. O arquivo contém mensagens e deve ser protegido e mantido fora do Git. O controle de campos preenchidos consulta a planilha antes da escrita; alterações simultâneas por outras pessoas durante essa operação podem gerar conflito.

## Google Cloud e execução

Use Node.js 18 ou superior, instale as dependências com `npm install` e configure `SPREADSHEET_ID` no ambiente do serviço. A aba precisa chamar-se `Modelo alinhamento`, com duas linhas de cabeçalho e os cadastros a partir da linha 3; o bot consulta até a linha 1000.

Anexe à VM uma conta de serviço com acesso de Editor à planilha. Use Application Default Credentials, sem chave privada JSON. A VM precisa do escopo OAuth `https://www.googleapis.com/auth/spreadsheets`; se também precisar das APIs do Cloud, mantenha `https://www.googleapis.com/auth/cloud-platform` junto. Ative a API Google Sheets no projeto.

Inicie `npm start` e vincule o WhatsApp pelo QR Code. A sessão fica em `auth_info_baileys/` e os IDs processados em `processed-message-ids.json`; não compartilhe esses arquivos. `ALLOWED_GROUP_JIDS` é opcional: vazio permite mensagens de todos os grupos da conta conectada. O bot ignora mensagens antigas sincronizadas e mensagens enviadas pela própria conta.

## Limites

O processamento do histórico foi verificado com testes locais de identificação de linha e mapeamento. O teste completo com uma linha real cadastrada e mensagem de grupo ainda precisa ser realizado. A hospedagem deve preservar os arquivos locais e ser monitorada para operação contínua.
