# 🏗️ Arquitetura do Sistema TaktTime-Andon

## Diagrama Técnico

```mermaid
graph TB
    subgraph "Hardware"
        PLC["🔧 PLC Siemens S7"]
    end
    
    subgraph "Backend Node.js"
        INDEX["index.js<br/>Main App"]
        PLC_DRV["plc.js<br/>PLC Driver<br/>nodes7"]
        LOG["log.js<br/>Windows Logger"]
        SRV["service.js<br/>Windows Service"]
        REPORT["report.js<br/>Report Generator"]
    end
    
    subgraph "Storage & Archives"
        SURA["sura.js<br/>Event Archive"]
        TRYLIST["trylist.js<br/>Snapshots"]
        LOGS["logs/ folder<br/>JSON Files"]
    end
    
    subgraph "Database Layer"
        SHARKPOOL["sharkpool.js<br/>Connection Pool"]
        ORACLE["🗄️ Oracle DB<br/>Production Data"]
    end
    
    subgraph "Communication"
        TRANSPORT["transport3.js<br/>HTTP/WebSocket"]
        EMAIL["nodemailer<br/>Email Alerts"]
    end
    
    subgraph "Frontend"
        HTML["index.html<br/>Web Page"]
        TTUI["TTUI.js<br/>UI Controller"]
        EVENTS["TTEvents.js<br/>Event Processor"]
        CRYPTO["xxtea-custom.js<br/>Encryption"]
    end
    
    subgraph "Config"
        SETTINGS["settings.json<br/>Configuration"]
        DAEMON["daemon/<br/>Service Config"]
    end
    
    PLC -->|S7 Protocol| PLC_DRV
    PLC_DRV -->|Events| INDEX
    INDEX -->|Config| SETTINGS
    INDEX -->|Error Logs| LOG
    INDEX -->|Events| SURA
    INDEX -->|Query| SHARKPOOL
    SHARKPOOL -->|SQL| ORACLE
    INDEX -->|Snapshot| TRYLIST
    TRYLIST -->|State| LOGS
    INDEX -->|Alert| EMAIL
    INDEX -->|WebSocket| TRANSPORT
    TRANSPORT -->|Encrypt| CRYPTO
    TRANSPORT -->|HTTP| HTML
    HTML -->|Load| TTUI
    TTUI -->|Handle| EVENTS
    EVENTS -->|Query| TRANSPORT
    INDEX -->|Generate| REPORT
    REPORT -->|Excel| ORACLE
    SRV -->|Install| DAEMON
    
    style PLC fill:#ff6b6b
    style ORACLE fill:#4c6ef5
    style INDEX fill:#228be6
    style TTUI fill:#40c057
    style SURA fill:#ffd43b
```

## 📋 Legenda

- **🔧 Hardware**: Equipamentos físicos
- **🟦 Backend**: Lógica de servidor (Node.js)
- **💾 Storage**: Armazenamento de eventos
- **🗄️ Database**: Persistência em Oracle
- **📡 Communication**: Transporte de dados
- **🌐 Frontend**: Interface web
- **⚙️ Config**: Configurações do sistema

## 🔄 Fluxo Principal

1. **PLC Siemens S7** → Envia eventos via protocolo S7
2. **plc.js** → Recebe e processa
3. **index.js** → Orquestra todo o sistema
4. **Persistência** → SURA (arquivo) + Oracle (DB)
5. **Relatórios** → report.js gera Excel
6. **Transport** → WebSocket com criptografia XZTEA
7. **Frontend** → TTUI.js renderiza interface
8. **Alertas** → Email via SMTP

---

**Para visualizar este diagrama:**
- Abra este arquivo no VS Code com a extensão Mermaid
- Pressione `Ctrl+Shift+V` para preview
- Ou acesse https://mermaid.live/ e cole o código
