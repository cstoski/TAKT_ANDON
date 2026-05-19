# TaktTime-Andon - Arquitetura Técnica Detalhada

## 🏗️ Visão Geral da Arquitetura

O sistema TaktTime-Andon é uma aplicação **Node.js em tempo real** que funciona como um **Andon Digital** para monitorar produção. Arquitetura em 4 camadas:

```
┌─────────────────────────────────────┐
│   INTERFACE WEB (Frontend)          │
│   HTML5 + JavaScript + WebSocket    │
└─────────────────────────────────────┘
           ↑         ↓
┌─────────────────────────────────────┐
│   CAMADA DE TRANSPORTE              │
│   HTTP + WebSocket + XXTEA          │
└─────────────────────────────────────┘
           ↑         ↓
┌─────────────────────────────────────┐
│   LÓGICA DE NEGÓCIO                 │
│   Eventos, PLC, Relatórios          │
└─────────────────────────────────────┘
           ↑         ↓
┌─────────────────────────────────────┐
│   PERSISTÊNCIA                      │
│   Oracle DB + SURA + Arquivo        │
└─────────────────────────────────────┘
```

---

## 🔴 Camada 1: Interface Web (Frontend)

### Arquivos Principais

#### `html/index.html`
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="TTUI.css">
  <manifest href="manifest.json">
</head>
<body>
  <!-- DOM para UI renderizada por TTUI.js -->
</body>
<script src="xxtea-custom.js"></script>
<script src="sha-512.js"></script>
<script src="transport3.js"></script>
<script src="TTEvents.js"></script>
<script src="TTUI.js"></script>
</html>
```

#### `html/TTUI.js` - Framework UI Principal

**Responsabilidades**:
1. **Inicialização**: Configura DOM elements e state
2. **Renderização**: Exibe telas (Welcome, Dashboard, etc)
3. **Input Handler**: Captura ações do usuário
4. **State Management**: Mantém cache de dados locais
5. **Timer Idle**: Inatividade de 10 minutos

**Estrutura de Estado**:
```javascript
state = {
  caches: {},           // Cache local
  currentScreen: 0,     // Tela atual
  shifts: 2,            // Turnos
  stoppages: 6,         // Tipos de parada
  user: null,           // Usuário logado
}
```

**Telas Disponíveis**:
- `showScreen_Welcome`: Tela inicial
- Dashboard Shifts: Status de turnos
- Dashboard Stoppages: Paradas registradas
- Status PLC: Health check

**Constantes Configuráveis**:
```javascript
one_minute_ms = 60 * 1000
one_hour_ms = 60 * 60 * 1000
one_day_ms = 60 * 60 * 24 * 1000
idleTimeoutPeriod = 10 * one_minute_ms  // 10 minutos
eventQueryTimeout = 60 * one_second_ms  // 60 segundos
```

#### `html/TTEvents.js` - Processador de Eventos

**Função**: Processa eventos em tempo real do servidor

**Tipos de Eventos**:
1. **Eventos de Produção**: Status de máquinas
2. **Eventos de Turno**: Mudanças de turno
3. **Eventos de Parada**: Registros de parada
4. **Eventos de Usuário**: Ações na interface

**Pipeline**:
```
Evento Recebido
    ↓
TTEvents.process()
    ↓
Validação SHA-512
    ↓
Descriptografia XXTEA
    ↓
Renderização UI
    ↓
Cache Local
```

#### `html/transport3.js` - Camada de Transporte

**Protocolos Suportados**:
- HTTP GET/POST
- WebSocket (real-time)
- HTTPS (seguro)

**Fluxo de Comunicação**:
```javascript
// Cliente → Servidor
request = {
  method: 'POST',
  path: '/secure',
  encrypted: true,
  data: {/*payload*/}
}

// Servidor → Cliente
response = {
  status: 200,
  encrypted: true,
  data: {/*resultado*/},
  hash: SHA512
}
```

**Cache Inteligente**:
- Armazena respostas
- TTL configurável
- Fallback offline

#### `html/xxtea-custom.js` - Criptografia XXTEA

**Algoritmo**: XXTEA (eXtended Tiny Encryption Algorithm)

**Características**:
- Chave: 128 bits (16 bytes)
- Bloco: 64 bits (8 bytes)
- Rodadas: 32 por bloco
- Modo: ECB (Electronic Codebook)

**Uso**:
```javascript
encrypted = XXTEA.encrypt(data, key)
decrypted = XXTEA.decrypt(encrypted, key)
```

#### `html/sha-512.js` - Hash Seguro

**Função**: Validar integridade de mensagens

**Uso**:
```javascript
hash = SHA512(payload)
// Validar resposta
if (SHA512(response) === expectedHash) { /*OK*/ }
```

#### `html/TTUI.css` - Estilos

**Características**:
- Design responsivo
- Tema escuro para fábrica
- Ícones e cores para status
- Animações de transição

#### `html/manifest.json` - PWA Config

```json
{
  "name": "TaktTime Andon",
  "short_name": "TaktTime",
  "description": "Andon system for Perkins",
  "start_url": "/",
  "display": "fullscreen",
  "theme_color": "#1f1f1f",
  "background_color": "#ffffff"
}
```

---

## 🟢 Camada 2: Lógica de Negócio (Backend)

### `index.js` - Aplicação Principal

**Responsabilidades**:
1. **Inicialização**: Setup de servidor e módulos
2. **Orquestração**: Coordena PLC, DB, Email
3. **Processamento**: Valida e processa eventos
4. **Persistência**: Salva em DB e arquivo
5. **Alertas**: Envia notificações

**Fluxo Principal**:
```
Inicia Node.js
    ↓
Carrega módulos (plc, sharkpool, sura, etc)
    ↓
Lê settings.json
    ↓
Conecta ao PLC
    ↓
Conecta ao Oracle DB
    ↓
Inicia servidor HTTP (porta 8080)
    ↓
Aguarda eventos
    ↓ (quando evento chega do PLC)
Processa evento
    ├─ SURA.write() → arquivo
    ├─ sharkpool.execute() → DB
    ├─ trylist.save() → snapshot
    ├─ nodemailer.send() → email
    └─ transport.broadcast() → cliente
```

**Estrutura de Evento**:
```javascript
event = {
  id: 123,              // ID único
  r: "STATION_01",      // Estação (room)
  t: 2,                 // Tipo (0=shift, 1=break, 2=production)
  v: 1,                 // Versão do evento
  st: Date.now(),       // Start time
  e: undefined,         // End time (null se ativo)
  l: "LINE_A",          // Linha (location)
  w: 1,                 // Turno (week, work shift)
  b: "MOTOR",           // Component
  s: "STOPPED",         // Status
  j: "MAINTENANCE",     // Job/Reason
  u: "USER_001"         // Usuário
}
```

### `plc.js` - Driver PLC

**Protocolo**: Siemens S7 (via `nodes7`)

**Configuração**:
```javascript
connections = {
  "192.168.1.100:102": {
    conn: nodes7Connection,
    map: {
      "S01B01": "I1.0,BYTE0",    // Station 1, Button 1 → Address I1.0
      "S01B02": "I1.1,BYTE0",
      "S02B01": "Q0.0,BYTE0"
    }
  }
}
```

**Métodos**:
- `Register()`: Registra estações
- `add()`: Adiciona item ao mapa
- `addItems()`: Adiciona múltiplos items
- `retryConnect()`: Reconexão automática

**Retry Logic**:
```javascript
retryInterval = 10000  // 10 segundos
Máximo de tentativas = indefinido
Backoff = linear (10s, 10s, 10s, ...)
```

### `log.js` - Sistema de Logging

**Integração Windows**:
```javascript
wlog = new nodeWindows.EventLogger(name)
```

**Níveis**:
- Nível 1: Info (informações)
- Nível 2: Warn (aviso)
- Nível 3: Error (erro crítico)

**Threshold**:
```javascript
errorThreshhold = 10        // Máximo 10 erros
errorPeriod = 60            // Em 60 segundos
```

**Se exceder**: Cria alerta crítico no Event Viewer

### `service.js` - Gerenciador de Serviço

**Instalação**:
```bash
node service.js install
```

**Configurações**:
```javascript
{
  name: 'Perkins TaktTime 2',
  description: 'Andon system for Perkins Curitiba',
  script: './index.js',
  nodeOptions: ['--harmony', '--max_old_space_size=4096']
}
```

**Operações Windows**:
- Service name: `Perkins TaktTime 2`
- Startup: Automático
- Recovery: Restart on failure
- Memory limit: 4GB

### `report.js` - Gerador de Relatórios

**Função**: Cria relatórios Excel com dados de produção

**Templates**: 
- `Report_Template_31.xlsm` (Período: Diário)
- `Report_Template_32.xlsm` (Período: Semanal)
- `Report_Template_33.xlsm` (Período: Mensal)

**Processo**:
```
Query Oracle DB
    ↓
Agrupa dados por período
    ↓
Preenche template Excel
    ↓
Salva em /reports/archive/
```

**Nomenclatura**:
```
YYYY-MM-DD_HH-MM-YYYY-MM-DD_HH-MM-{timestamp}-{base64id}.xlsm
Exemplo: 2026-05-18_00-00-2026-05-19_23-59-1716038400000-MC4xMjM0NTY3ODk.xlsm
```

---

## 🔵 Camada 3: Persistência

### `sharkpool.js` - Connection Pool

**Design Pattern**: Object Pool

**Características**:
- Multithread safety
- Timeout por query
- Retry automático
- Backoff exponencial

**Estrutura**:
```javascript
pool = {
  connections: [],    // Array de conexões
  queue: [],          // Fila de queries
  options: {
    maxConnections: 10,
    executeTimeout: 60000
  }
}
```

**Fluxo de Query**:
```
execute(query, params)
    ↓
Fila query
    ↓ (se há conexão disponível)
Executa query
    ↓
Timeout? → Erro/Retry
    ↓
Resultado
    ↓
Retorna conexão ao pool
```

**Retry Logic**:
```json
"DBRetryDelay": 15000,
"DBBatchDelay": 2000,
"DBRetryBatchSize": 40,
"DBRetryBackoffDivisor": 8
```

### `sura.js` - Source Unified Readable Archive

**Propósito**: Armazenar eventos comprimido e eficientemente

**Formato Binary**:
```
[Seek(5)] [ID(13)] [Seek(5)] [Delim(1)] [Data...]
├─ Seek: Pointer próximo registro
├─ ID: Identificador único (13 bytes)
├─ Data: Payload event comprimido
└─ Delim: Marca fim de registro
```

**Operações**:
- `write()`: Escreve evento
- `read()`: Lê evento por ID
- `query()`: Busca múltiplos eventos
- `clean()`: Limpeza periódica

**Exemplo Uso**:
```javascript
const EVENT = new Sura('perkins-plc-events', './logs')
EVENT.write({ id, r, t, v, st, l, w, b, s, j, u })
```

### `trylist.js` - Snapshot Manager

**Propósito**: Tentar operação com snapshots do estado

**Fluxo**:
```
Inicia operação
    ↓
Cria snapshot imediato
    ├─ arquivo: trylist-{id}.json
    ├─ dados: {estado, timestamp, tentativa}
    └─ delay salva: 15 segundos
    ↓
Executa operação
    ↓
Sucesso?
    ├─ Sim → remove snapshots antigos
    └─ Não → cria novo snapshot
    ↓
Retry automático
```

**Configurações**:
```javascript
snapshotCount = 10        // Máximo 10 snapshots
snapshotPeriod = 2 * 60 * 1000  // Período 2 minutos
saveLimit = 15 * 1000     // Delay 15 segundos
purgeInterval = 10 * 60 * 1000  // Limpeza 10 minutos
```

### Banco de Dados Oracle

**Tabelas Principais**:

#### `events`
```sql
CREATE TABLE events (
  id INT PRIMARY KEY,      -- Evento ID
  r VARCHAR(50),            -- Estação/Room
  t INT,                    -- Tipo evento
  v INT,                    -- Versão
  st BIGINT,                -- Start time
  e BIGINT,                 -- End time
  l VARCHAR(50),            -- Linha/Location
  w INT,                    -- Turno/Week
  b VARCHAR(100),           -- Component
  s VARCHAR(50),            -- Status
  j VARCHAR(200),           -- Job/Reason
  u VARCHAR(50)             -- Usuário
);
```

#### `shifts`
```sql
CREATE TABLE shifts (
  k INT PRIMARY KEY,        -- Shift key
  l VARCHAR(50),            -- Localização
  w INT,                    -- Semana
  t INT,                    -- Tipo
  n VARCHAR(100),           -- Nome
  d TEXT,                   -- Descrição
  sd BIGINT,                -- Start date
  dd BIGINT,                -- End date
  sh INT, sm INT,           -- Start hour, minute
  eh INT, em INT,           -- End hour, minute
  rd INT,                   -- Repeat daily
  rw INT,                   -- Repeat weekly
  rm INT,                   -- Repeat monthly
  UNIQUE(l, w)
);
```

#### `qg_check_result` (Produção)
```sql
SELECT
  r.check_result_pk,
  l.engine_serial_number,
  e.arrangement_number,
  e.engine_description_full,
  r.check_end_tstamp,
  r.check_result
FROM qg_check_list l
JOIN qg_check_result r ON r.check_list_number = l.check_list_number
JOIN engines e ON e.engine_serial_number = l.engine_serial_number
```

---

## ⚙️ Fluxo de Dados Completo

### Exemplo: Parada de Produção

```
1. PLC detecta parada
   └─ Sinal em I1.0 (estação 01, botão 01)

2. plc.js captura via S7
   └─ Evento dispara callback para index.js

3. index.js processa
   ├─ Cria event object
   ├─ Validações
   └─ Dispara callbacks

4. Salva em arquivo (SURA)
   └─ eventos/perkins-plc-events.log

5. Salva em snapshot (trylist)
   └─ logs/snapshots/trylist-{id}.json

6. Insere em DB (sharkpool)
   └─ INSERT INTO events VALUES (...)

7. Verifica regras de turno
   └─ SELECT FROM shifts WHERE l=?

8. Envia alerta por email (nodemailer)
   └─ SMTP para gerentes

9. Transmite para cliente (transport3)
   └─ WebSocket /secure endpoint

10. Browser recebe (TTEvents.js)
    └─ Validação SHA-512
    └─ Descriptografia XXTEA

11. UI renderiza (TTUI.js)
    └─ Atualiza tela em tempo real
```

---

## 🔐 Segurança

### Camadas de Proteção

**Nível 1: Transporte**
- HTTPS/WSS (TLS)
- XXTEA encryption
- SHA-512 checksum

**Nível 2: Aplicação**
- Input validation
- SQL parameterized queries
- Rate limiting (blacklist timeout: 3s)

**Nível 3: Infraestrutura**
- Windows Firewall
- Service principal (não admin)
- Memory limit 4GB

### Fluxo de Validação

```
Requisição chega
    ↓
Check SHA-512
    ├─ Hash inválido? → Rejeita (401)
    └─ OK → Continua
    ↓
Descriptografa XZTEA
    ├─ Erro? → Rejeita (403)
    └─ OK → Continua
    ↓
Valida timestamp (expiry: 60s)
    ├─ Expirado? → Rejeita (401)
    └─ OK → Continua
    ↓
Valida blacklist
    ├─ Bloqueado? → Rejeita (429)
    └─ OK → Processa
```

---

## 📊 Performance & Tunning

### Otimizações Implementadas

**DB Connection Pool**:
```json
"DBmaxConnections": 10,
"DBwarmConnections": true,
"DBBatchDelay": 2000,
"DBRetryBatchSize": 40
```

**SURA Cache**:
```javascript
record_cache = 1024000  // 1MB read cache
max_length = 99999      // Limite registros
```

**Timeouts Inteligentes**:
```json
"DBexecuteTimeout": 60000,      // Query → 60s
"SMTPTimeout": 15000,           // Email → 15s
"alertMaxWait": 600000,         // Alerta → 10min
"blacklistTimeout": 3000        // Blacklist → 3s
```

### Métricas de Monitoramento

- Conexões ativas do pool
- Fila de queries pendentes
- Tempo de resposta PLC
- Taxa de erro
- Tamanho arquivo SURA

---

## 🔄 Ciclo de Vida

### Inicialização
```
1. service.js instala
2. Windows executa index.js
3. Carrega settings.json
4. Conecta PLC, DB, Email
5. Inicia HTTP (8080)
```

### Runtime
```
Loop infinito
├─ Aguarda eventos PLC
├─ Processa eventos
├─ Salva em SURA + DB
├─ Valida snapshots (trylist)
└─ Transmite para clientes
```

### Encerramento
```
1. SIGINT recebido
2. Fecha conexão PLC
3. Drena pool DB
4. Salva estado final
5. Finaliza processo
```

---

## 📚 Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5, CSS3, JavaScript (ES6) |
| Transporte | HTTP/1.1, WebSocket |
| Criptografia | XXTEA, SHA-512 |
| Backend | Node.js v14+ |
| Integração PLC | nodes7 (S7 protocol) |
| Banco Dados | Oracle Database |
| Driver DB | oracledb |
| Email | nodemailer |
| Serviço Windows | node-windows |
| Logger | Windows Event Logger |

---

**Documentação Técnica v2.0**
**Perkins TaktTime Andon System**
**Maio 2026**
