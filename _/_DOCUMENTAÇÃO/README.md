# 📋 TaktTime-Andon - Sistema Andon Digital para Perkins

## 🎯 O que é?

**TaktTime-Andon** é um sistema de monitoramento de produção em tempo real desenvolvido para a fábrica Perkins em Curitiba, Brasil. Funciona como um **Andon Digital** que monitora:

- ⏱️ **Tempo Takt** (ritmo de produção)
- 🛑 **Paradas** (registro de paradas de produção)
- 👷 **Turnos** (horários e regras de trabalho)
- 🤖 **PLC Integration** (comunicação com máquinas Siemens)
- 📊 **Relatórios** (geração automática de reports Excel)
- 📡 **Dashboard Real-Time** (interface web com WebSocket)

---

## 📚 Documentação Disponível

### 1. **[DOCUMENTACAO.md](DOCUMENTACAO.md)** - Guia Completo
   - Visão geral do projeto
   - Descrição de todas as pastas
   - Explicação de cada arquivo
   - Fluxo de dados principal
   - Dependências e configurações
   
   **Para**: Entender a estrutura geral do projeto

### 2. **[GUIA_RAPIDO.md](GUIA_RAPIDO.md)** - Referência Rápida
   - Índice de arquivos por tipo
   - Tabelas de referência
   - Como iniciar o sistema
   - Configurações principais
   - Troubleshooting
   
   **Para**: Consultas rápidas e operação do sistema

### 3. **[ARQUITETURA_TECNICA.md](ARQUITETURA_TECNICA.md)** - Detalhes Técnicos
   - Arquitetura em 4 camadas
   - Fluxo completo de dados
   - Protocolo PLC (Siemens S7)
   - Esquema de banco de dados
   - Segurança e criptografia
   - Performance e otimizações
   
   **Para**: Desenvolvimento, debug e entendimento profundo

---

## 🚀 Quick Start

### Instalação

```bash
# 1. Instalar Node.js v14+
# (fazer download em nodejs.org)

# 2. Instalar Oracle Client 18.5
# (arquivo instantclient_18_5/ já está incluído)

# 3. Copiar projeto para C:\PERKINS\TaktTime-Andon\

# 4. Instalar como serviço Windows
cd d:\PERKINS\TaktTime-Andon
node service.js install

# 5. Iniciar serviço
net start "Perkins TaktTime 2"

# 6. Acessar interface
# Abrir navegador em: http://localhost:8080
```

### Execução Direta (Teste)

```bash
# Terminal PowerShell ou CMD
cd d:\PERKINS\TaktTime-Andon
node index.js

# Ou usar batch
takttime.bat
```

### Monitorar

```bash
# Ver logs no Windows Event Viewer
# Applications and Services Logs → Perkins TaktTime

# Ver status do serviço
sc query "Perkins TaktTime 2"

# Parar serviço
net stop "Perkins TaktTime 2"
```

---

## 📊 Arquitetura em Alto Nível

```
┌─────────────────────┐
│   WEB BROWSER       │  Interface em tempo real
│  (port 8080)        │  HTML5 + JavaScript
└──────────┬──────────┘
           │ WebSocket/HTTP (XXTEA encrypted)
┌──────────▼──────────┐
│   NODE.JS SERVER    │  Aplicação principal
│  (index.js)         │  Orquestração de tudo
└──────────┬──────────┘
     ├─────┼─────┐
     │     │     │
┌────▼──┐ ┌──▼──┐ ┌──▼────┐
│ PLC   │ │ DB  │ │ EMAIL │  Integrações externas
│(S7)   │ │     │ │(SMTP) │
└───────┘ └─────┘ └───────┘
```

---

## 🗂️ Estrutura de Pastas

```
TaktTime-Andon/
├── 📄 index.js              Main application
├── 📄 log.js                Windows logging
├── 📄 service.js            Service installer
├── 📄 report.js             Report generator
├── 📄 settings.json         Configuration
├── 🌐 html/
│   ├── index.html           Web interface
│   ├── TTUI.js              UI controller
│   ├── TTEvents.js          Event handler
│   ├── transport3.js        HTTP/WebSocket
│   └── TTUI.css             Styling
├── ⚙️ plc/
│   └── plc.js               Siemens S7 driver
├── 💾 sharkpool/
│   └── sharkpool.js         DB connection pool
├── 📦 sura/
│   └── sura.js              Event archive
├── 🔄 trylist/
│   └── trylist.js           Retry manager
├── 📊 reports/
│   ├── Report_Template_*.xlsm
│   └── archive/             Historical reports
└── 🔧 daemon/
    └── perkinstakttime2.exe.config
```

---

## 🔧 Configuração Principal (settings.json)

```json
{
  "port": 8080,                     // Porta web
  "DBOnline": true,                 // Conectar a Oracle
  "PLCOnline": true,                // Conectar a PLC
  "SMTPOnline": true,               // Enviar emails
  "productionOnline": true,         // Monitorar produção
  "DBmaxConnections": 10,           // Pool conexões
  "minimumTaktTime": 60,            // Tempo mínimo (segundos)
  "alertInterval": 60000            // Check alertas (ms)
}
```

---

## 📡 Fluxo de Dados

```
1. PLC Siemens S7
   └─ Evento de produção

2. plc.js captura
   └─ Via protocolo nodes7

3. index.js processa
   └─ Valida e enriquece

4. Persistência
   ├─ sura.js → arquivo /logs
   ├─ sharkpool → Oracle DB
   └─ trylist → snapshots

5. Relatórios
   └─ report.js → Excel

6. Interface Web
   ├─ transport3.js → HTTP/WS
   ├─ Criptografia XZTEA
   ├─ SHA-512 validation
   └─ TTUI.js renderiza

7. Dashboard Real-Time
   └─ Browser com WebSocket
```

---

## 🔐 Segurança

- 🔒 **Transporte**: XZTEA encryption + SHA-512 hash
- 🛡️ **DB**: Oracle com credenciais seguras
- ⏰ **Timeout**: 60 segundos para expiração de token
- 🚫 **Blacklist**: 3 segundos para block de IP suspeito
- 🔑 **HTTPS**: Suporte a certificados SSL/TLS

---

## 📈 Performance

- ⚡ **DB Pool**: 10 conexões simultâneas
- 💾 **Cache**: 1MB para SURA
- ⏱️ **Retry**: Backoff exponencial inteligente
- 🎯 **Batch**: 40 queries por lote

---

## 🐛 Troubleshooting

### Aplicação não inicia
```bash
# Verificar porta 8080 em uso
netstat -ano | findstr :8080

# Verificar Node.js instalado
node --version

# Limpar logs e tentar novamente
Remove-Item logs -Recurse
node index.js
```

### Erro de conexão Oracle
```bash
# Verificar Oracle Client 18.5
# Verificar TNS names
# Verificar credenciais em index.js
```

### Interface web em branco
```bash
# Limpar cache browser (Ctrl+Shift+Delete)
# Verificar console (F12 → Console)
# Verificar network (F12 → Network)
```

---

## 📞 Informações

| Item | Detalhes |
|------|----------|
| **Sistema** | TaktTime Andon v2 |
| **Local** | Perkins Curitiba, Brasil |
| **Plataforma** | Windows + Node.js + Oracle |
| **Idioma** | Português Brasileiro |
| **Autor Original** | Chris Batt / TAKT World Inc. |
| **Última Atualização** | Maio 2026 |

---

## 📚 Próximos Passos

1. **Leitura**: Comece com [DOCUMENTACAO.md](DOCUMENTACAO.md)
2. **Operação**: Consulte [GUIA_RAPIDO.md](GUIA_RAPIDO.md)
3. **Desenvolvimento**: Estude [ARQUITETURA_TECNICA.md](ARQUITETURA_TECNICA.md)
4. **Troubleshooting**: Veja a seção "🐛" acima

---

## 📋 Checklist de Operação

- [ ] Node.js v14+ instalado
- [ ] Oracle Client 18.5 presente
- [ ] settings.json configurado
- [ ] Serviço instalado: `node service.js install`
- [ ] Serviço iniciado: `net start "Perkins TaktTime 2"`
- [ ] Interface acessível: http://localhost:8080
- [ ] PLC conectado e respondendo
- [ ] Oracle DB conectado
- [ ] Email SMTP funcionando
- [ ] Logs sendo gerados

---

**Bem-vindo ao TaktTime-Andon!** 🚀

Para dúvidas, consulte a documentação detalhada ou entre em contato com o time de suporte.

