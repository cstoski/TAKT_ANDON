# TaktTime-Andon - Guia de Referência Rápida

## 📚 Índice de Arquivos

### 🔴 Arquivos Raiz

| Arquivo | Tipo | Função |
|---------|------|--------|
| `index.js` | JavaScript | **Aplicação principal** - Inicia servidor, gerencia eventos, PLC, DB |
| `log.js` | JavaScript | Sistema de log Windows Event Viewer |
| `service.js` | JavaScript | Instalador/desinstalador de serviço Windows |
| `report.js` | JavaScript | Gerador de relatórios de produção |
| `report.json` | JSON | Cache de configurações de relatórios |
| `settings.json` | JSON | **Arquivo de configuração central** |
| `takttime.bat` | Batch | Script de inicialização Windows |

---

## 📂 Estrutura por Responsabilidade

### Backend & Integração (`/`)
```
index.js         → Aplicação principal
  ├─ plc.js      → Comunicação PLC
  ├─ log.js      → Logging
  ├─ report.js   → Relatórios
  └─ service.js  → Serviço Windows
```

### Frontend (`/html`)
```
index.html       → Página web
  ├─ TTUI.js     → Controller UI
  ├─ TTEvents.js → Eventos
  ├─ TTUI.css    → Estilos
  ├─ transport3.js → WebSocket/HTTP
  └─ xxtea-custom.js → Criptografia
```

### Camada de Dados
```
/sharkpool       → Pool de conexões DB
/sura            → Archive de eventos
/trylist         → Snapshots & Retry
```

### Produção
```
/reports         → Templates (.xlsm)
  └─ /archive    → Histórico de relatórios
```

### Configuração
```
/daemon          → Config Windows Service
/instantclient_18_5 → Cliente Oracle
```

---

## ⚙️ Como Iniciar

### Opção 1: Serviço Windows (Produção)
```powershell
# Instalar
node service.js install

# Iniciar
net start "Perkins TaktTime 2"

# Parar
net stop "Perkins TaktTime 2"

# Desinstalar
node service.js uninstall
```

### Opção 2: Execução Direta
```bash
node index.js
```

### Opção 3: Arquivo Batch
```bash
takttime.bat
```

---

## 🔧 Configurações Principais (settings.json)

### Conectividade
```json
"port": 8080,                    // Porta HTTP
"PLCOnline": true,               // Habilitar PLC
"DBOnline": true,                // Habilitar DB Oracle
"SMTPOnline": true,              // Habilitar Email
"productionOnline": true         // Monitora dados de produção
```

### Performance
```json
"DBmaxConnections": 10,          // Pool conexões
"DBexecuteTimeout": 60000,       // Timeout Query (ms)
"DBRetryDelay": 15000,           // Delay retry (ms)
"alertInterval": 60000           // Intervalo alertas (ms)
```

### Comportamento
```json
"minimumTaktTime": 60,           // Tempo mínimo (segundos)
"dashboardPersistence": 1800,    // Persistência dashboard (s)
"hashExpiry": 60000              // Expiração hash (ms)
```

---

## 📡 Protocolo PLC

**Tipo**: Siemens S7 via `nodes7`

**Configuração**:
- Multiestação support
- Mapeamento de endereços em memória
- Retry automático

**Estrutura**:
```
Station
  └─ Button
      ├─ host: IP do PLC
      ├─ port: Porta (default 102)
      ├─ address: Endereço memória
      └─ offset: Offset na memória
```

---

## 🗄️ Banco de Dados

**Sistema**: Oracle Database

**Queries Principais** (em index.js):
- `INSERT_EVENT` - Inserir evento
- `END_EVENT` - Finalizar evento
- `SELECT_EVENT` - Buscar último evento
- `SHIFT_RULES` - Regras de turnos
- `PRODUCTION_SINCE` - Dados de produção

**Pool**: Máximo 10 conexões com warm start

---

## 📊 Armazenamento de Eventos

### SURA (sura.js)
- **Formato**: Binary com metadados estruturados
- **Local**: `logs/` folder
- **Estrutura**:
  - 5 bytes seek
  - 13 bytes ID
  - 5 bytes delimiter
- **Limite**: 99.999 registros

### Trylist (trylist.js)
- **Snapshots**: Até 10 por tentativa
- **Local**: `logs/snapshots/`
- **Período**: 2 minutos (configurável)
- **Delay**: 15 segundos (configurável)

---

## 🚨 Sistema de Alertas

**Canal**: Email via SMTP

**Configurações**:
```json
"alertInterval": 60000,       // Check a cada 60s
"alertMaxWait": 600000,       // Máx 10min de espera
"alertBackoffRate": 7         // Backoff exponencial
```

**Tipos**:
- Erros JavaScript (index.js line 11-14)
- Falhas de conexão DB
- Problemas PLC
- Timeouts

---

## 🔐 Segurança

### Criptografia
- **Transporte**: XXTEA (xxtea-custom.js)
- **Hash**: SHA-512 (sha-512.js)
- **Expiração**: 60 segundos

### Validação
- Check de certificados HTTPS
- Blacklist timeout: 3 segundos
- Timeout de fila: configurável

---

## 📈 Relatórios

### Templates Excel
- `Report_Template_31.xlsm`
- `Report_Template_32.xlsm`
- `Report_Template_33.xlsm`

### Arquivo
- Local: `/reports/archive/`
- Padrão: `YYYY-MM-DD_HH-MM-YYYY-MM-DD_HH-MM-{timestamp}-{id}.xlsm`
- Histórico: Desde 2020-12-01

---

## 🖥️ Interface Web

### Estrutura
```
index.html
  ├─ TTUI.js (controller)
  ├─ TTUI.css (styles)
  ├─ TTEvents.js (events)
  ├─ transport3.js (comms)
  └─ manifest.json (PWA)
```

### Telas
- Welcome Screen (início)
- Dashboard Shifts (turnos)
- Dashboard Stoppages (paradas)
- Timeout inativo: 10 minutos

### Características
- Progressive Web App
- Real-time updates via WebSocket
- Interface em Português
- Cache local de dados

---

## 🐛 Debug & Logs

### Windows Event Viewer
```
Applications and Services Logs
  └─ Perkins TaktTime (nome do app em log.js)
```

### JSON Logs
- Local: `logs/` e `logs/snapshots/`
- Formato: `{timestamp}-perkins.json`
- Snapshots: `trylist-*.json`

### Exceções
- Global error handler em index.js (linha 11-14)
- Limites: 10 erros em 60 segundos (configurável)

---

## 📚 Módulos Utilitários

| Módulo | Localização | Função |
|--------|-------------|--------|
| **sharkpool** | `/sharkpool/` | Connection pool DB |
| **sura** | `/sura/` | Event archive comprimido |
| **trylist** | `/trylist/` | Retry manager + snapshots |
| **sunk** | `/sunk/` | Sincronização de dados |
| **plc** | `/plc/` | Driver Siemens S7 |

---

## 📋 Checklist de Deploy

- [ ] Instalar Node.js v14+
- [ ] Instalar Oracle Client 18.5
- [ ] Copiar projeto para `d:\PERKINS\TaktTime-Andon`
- [ ] Configurar `settings.json`
- [ ] Configurar `daemon/perkinstakttime2.exe.config`
- [ ] Executar: `node service.js install`
- [ ] Iniciar serviço: `net start "Perkins TaktTime 2"`
- [ ] Testar em: `http://localhost:8080`

---

## 🔄 Cycle de Dados

```
1. PLC → S7 Protocol
2. plc.js captura eventos
3. index.js processa
4. sura.js arquiva
5. sharkpool.js salva BD
6. report.js gera excel
7. transport3.js envia browser
8. TTUI.js renderiza
9. Email alertas se erro
```

---

## 📞 Suporte

**Sistema**: TaktTime Andon v2
**Local**: Perkins Curitiba, Brasil
**Plataforma**: Windows + Node.js + Oracle
**Autor Original**: Chris Batt / Takt Time / TAKT World Inc.

---

## 📝 Notas Importantes

⚠️ **Backup Regular**:
- Histórico em `/old/backup`
- Relatórios em `/reports/archive`
- Eventos em `/logs`

⚠️ **Performance**:
- Max 10 conexões DB simultâneas
- Cache 1MB para SURA
- Período retry: 15 segundos

⚠️ **Segurança**:
- XXTEA para transporte
- SHA-512 para validação
- Expiração de hash: 60s

---

**Última Atualização**: Maio 2026
